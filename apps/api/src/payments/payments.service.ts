import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_PAGE_SIZE,
  PAYMENT_LIMITS,
  PAYMENT_REFERENCE_FIELD,
  isAdmin,
  nextOrderStatus,
  orderCode,
  orderNumberFromCode,
  paymentCurrency,
  paymentPurposeFor,
} from '@balitrade/shared';
import type {
  AuthUser,
  OrderAction,
  PaymentInstructions,
  PageResult,
  PageSize,
  PaymentMethod,
  PaymentPurpose,
  PaymentSummary,
  PaymentView,
} from '@balitrade/shared';
import { ChatService } from '../chat/chat.service.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import type { Env } from '../config/env.js';
import { idrToUsd } from '../fx/fx-math.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { endOfBusinessDay, startOfBusinessDay } from '../common/business-day.js';
import { escapeLike } from '../common/escape-like.js';
import type { AdminPaymentQueryDto } from './dto/admin-payment-query.dto.js';
import type { SubmitPaymentDto } from './dto/submit-payment.dto.js';

const paymentInclude = {
  submittedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  order: { select: { id: true, number: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;


/** How a payment's purpose reads in the order chat. */
const PURPOSE_LABEL: Record<PaymentPurpose, string> = { GOODS: 'a payment', SHIPPING: 'a shipping payment' };

/**
 * Manual payments (T17). There is no gateway: the buyer transfers the money themselves and uploads a proof, and a
 * FINANCE admin checks it against the bank statement or the wallet. Two rules from docs/BRAINSTORMING.md §11 shape
 * everything here:
 *
 * - **Rows are never edited or replaced.** Partial transfers are accepted on purpose, so one order has several
 *   payments and a new proof is a new row. Nothing is overwritten, so the admin always reads the full history.
 * - **`PAYMENT_VERIFIED` is the admin's judgement.** Verifying one payment only says "this money arrived"; the order
 *   moves on when the admin confirms that enough has arrived (`confirmPaid`). No sum in this file decides that.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly limiter: MessageRateLimiter,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Where buyers send their money, from config. A method whose fields are not all filled in is left out, so a
   * half-configured `.env` cannot show a buyer an incomplete instruction (a wrong USDT network loses their funds).
   */
  instructions(): PaymentInstructions {
    const value = (key: keyof Env): string => (this.config.get(key, { infer: true }) as string | undefined) ?? '';
    const all = (...keys: (keyof Env)[]): boolean => keys.every((key) => value(key) !== '');

    return {
      bank: all('PAY_BANK_NAME', 'PAY_BANK_ACCOUNT_NUMBER', 'PAY_BANK_ACCOUNT_HOLDER')
        ? {
            name: value('PAY_BANK_NAME'),
            accountNumber: value('PAY_BANK_ACCOUNT_NUMBER'),
            accountHolder: value('PAY_BANK_ACCOUNT_HOLDER'),
          }
        : null,
      usdt: all('PAY_USDT_NETWORK', 'PAY_USDT_ADDRESS')
        ? { network: value('PAY_USDT_NETWORK'), address: value('PAY_USDT_ADDRESS') }
        : null,
      exchange: all('PAY_EXCHANGE_NAME', 'PAY_EXCHANGE_CONTACT', 'PAY_EXCHANGE_INSTRUCTIONS')
        ? {
            name: value('PAY_EXCHANGE_NAME'),
            contact: value('PAY_EXCHANGE_CONTACT'),
            instructions: value('PAY_EXCHANGE_INSTRUCTIONS'),
          }
        : null,
      mock: value('PAY_MOCK').toLowerCase() === 'true',
    };
  }

  /**
   * The buyer's payments for an order, with what is still open. Admins see the same; the seller is not a party to the
   * money. `purpose` defaults to what the order is waiting for now (shipping once a shipping bill is out), else GOODS.
   */
  async summary(user: AuthUser, orderId: string, purpose?: PaymentPurpose): Promise<PaymentSummary> {
    const order = await this.findOrderForMoney(user, orderId);
    const chosen = purpose ?? paymentPurposeFor(order.status) ?? 'GOODS';
    const rows = await this.prisma.payment.findMany({
      where: { orderId: order.id, purpose: chosen },
      include: paymentInclude,
      orderBy: { submittedAt: 'desc' },
    });
    if (chosen === 'GOODS') {
      return this.toSummary('GOODS', order.itemsUsd.add(order.qcFeeUsd), order.fxRate, rows);
    }
    // Shipping is due only once a bill exists, and its rupiah rate is the bill's own (owner's decision, T19).
    const bill = await this.activeShippingBill(order.id);
    return this.toSummary('SHIPPING', bill?.totalUsd ?? new Prisma.Decimal(0), bill?.fxRate ?? order.fxRate, rows);
  }

  /** The shipping bill that is due: the newest one that was not revised (T19). */
  private activeShippingBill(orderId: string) {
    return this.prisma.shippingBill.findFirst({
      where: { orderId, supersededAt: null },
      orderBy: { createdAt: 'desc' },
      select: { totalUsd: true, fxRate: true },
    });
  }

  /**
   * The buyer says they paid. The proof is a file they uploaded themselves, so the key must be theirs; the amount is
   * taken at face value — the admin is the one who compares it with the account.
   */
  async submit(user: AuthUser, orderId: string, dto: SubmitPaymentDto): Promise<PaymentSummary> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { conversation: { select: { id: true } }, items: { select: { title: true, qty: true } } },
    });
    if (!order || order.buyerId !== user.id) {
      throw new NotFoundException('Order not found');
    }
    // What the money is for follows from the order, never from the request: goods while the order waits for its
    // payment, shipping while a shipping bill is out (T19).
    const purpose = paymentPurposeFor(order.status);
    if (!purpose) {
      throw new ConflictException(`This order cannot be paid while it is ${order.status}`);
    }
    // Rupiah is converted with the rate the buyer was quoted: the order's for the goods, the bill's for shipping.
    let rate = order.fxRate;
    if (purpose === 'SHIPPING') {
      const bill = await this.activeShippingBill(order.id);
      if (!bill) {
        throw new ConflictException('There is no shipping bill to pay yet');
      }
      rate = bill.fxRate;
    }
    // The uploader is part of the key (media.service.ts), so this also stops a buyer attaching someone else's file.
    if (!dto.proofKey.startsWith(`private/${user.id}/`)) {
      throw new BadRequestException('The proof must be a file you uploaded yourself');
    }
    this.assertReference(dto);
    const amount = this.assertAmount(dto.method, dto.amount);
    this.limiter.consume(user.id);

    const amountIdr = paymentCurrency(dto.method) === 'IDR' ? Math.round(dto.amount) : null;
    const amountUsd = amountIdr === null ? amount.toFixed(2) : idrToUsd(amountIdr, rate);

    const next = nextOrderStatus(order.status, 'SUBMIT_PAYMENT');
    if (!next) {
      throw new ConflictException(`This order cannot be paid while it is ${order.status}`);
    }

    const code = orderCode(order.number);
    const message = `Buyer submitted ${PURPOSE_LABEL[purpose]} for order ${code}: ${this.amountLabel(dto.method, amountIdr, amountUsd)} via ${this.methodLabel(dto.method)}${
      dto.reference ? ` (reference ${dto.reference})` : ''
    }. BaliTrade is checking it.`;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: next } });
      if (updated.count === 0) {
        throw new ConflictException('The order was changed in the meantime. Please reload it.');
      }
      await tx.payment.create({
        data: {
          orderId: order.id,
          purpose,
          method: dto.method,
          amountUsd: new Prisma.Decimal(amountUsd),
          amountIdr,
          senderName: dto.senderName ?? null,
          txHash: dto.txHash ?? null,
          exchangeName: dto.exchangeName ?? null,
          reference: dto.reference ?? null,
          note: dto.note ?? null,
          proofKey: dto.proofKey,
          submittedById: user.id,
        },
      });
      const chat = order.conversation ? await this.chat.createSystemMessage(tx, order.conversation.id, message) : null;
      return { chat };
    });

    await this.announce(result.chat, null, order.id, code, next, order.items[0]);
    return this.summary(user, order.id, purpose);
  }

  /** A FINANCE admin found the money. The order itself does not move: see the class comment. */
  async verify(admin: AuthUser, paymentId: string): Promise<PaymentView> {
    const row = await this.decide(admin, paymentId, 'VERIFIED');
    return this.toView(row);
  }

  /** Not found in the account, or the proof does not match. The order goes back to waiting so the buyer can retry. */
  async reject(admin: AuthUser, paymentId: string, reason?: string): Promise<PaymentView> {
    const row = await this.decide(admin, paymentId, 'REJECTED', reason);
    return this.toView(row);
  }

  /** Payments waiting for a decision (or another status), newest first — the FINANCE admin's work list. */
  /**
   * The FINANCE queue (T27): every payment attempt, paged on the server — the old `take: 200` silently dropped the
   * oldest rows. Search matches an order code exactly or the buyer's name; the day range is on the submission date.
   * `statusCounts` ignores the status filter, so each tab can say how many rows it would list.
   */
  async adminList(query: AdminPaymentQueryDto = {}): Promise<PageResult<PaymentView>> {
    const size: PageSize = query.size ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;
    const base: Prisma.PaymentWhereInput = {};
    if (query.q) {
      const number = orderNumberFromCode(query.q);
      base.OR = [
        ...(number === null ? [] : [{ order: { number } }]),
        { order: { buyer: { name: { contains: escapeLike(query.q), mode: 'insensitive' as const } } } },
      ];
    }
    const from = startOfBusinessDay(query.from);
    const to = endOfBusinessDay(query.to);
    if (from || to) base.submittedAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const where: Prisma.PaymentWhereInput = query.status ? { ...base, status: query.status } : base;

    const [total, rows, byStatus] = await this.prisma.$transaction(
      [
        this.prisma.payment.count({ where }),
        this.prisma.payment.findMany({
          where,
          include: paymentInclude,
          // `id` breaks ties so offset paging never repeats or skips a row with the same timestamp.
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          skip: (page - 1) * size,
          take: size,
        }),
        this.prisma.payment.groupBy({ by: ['status'], where: base, orderBy: { status: 'asc' }, _count: { _all: true } }),
      ],
      // One snapshot for all three reads, so the tab counts always add up to the total.
      { isolationLevel: 'RepeatableRead' },
    );

    const statusCounts = Object.fromEntries(byStatus.map((row) => [row.status, (row._count as { _all: number })._all]));
    return { items: rows.map((row) => this.toView(row)), total, page, size, statusCounts };
  }

  /**
   * The FINANCE admin confirms that enough has arrived for the order to go ahead. This is the one place where an
   * order becomes PAYMENT_VERIFIED, and it is a judgement: partial payments are allowed, so no sum can decide it.
   */
  async confirmPaid(admin: AuthUser, orderId: string): Promise<PaymentSummary> {
    return this.advance(admin, orderId, 'CONFIRM_PAID', (code) =>
      `BaliTrade verified the payment for order ${code}. The payment is held by BaliTrade until delivery. Next step: quality control.`,
    );
  }

  /** The goods are with BaliTrade and quality control begins (ADMIN_OPS). The report itself is QcService (T18). */
  async startQc(admin: AuthUser, orderId: string): Promise<PaymentSummary> {
    return this.advance(admin, orderId, 'START_QC', (code) => `Order ${code} is now in quality control at BaliTrade.`);
  }

  /** The FINANCE admin confirms the shipping bill is paid (T19); the goods can then be handed to the air cargo. */
  async confirmShippingPaid(admin: AuthUser, orderId: string): Promise<PaymentSummary> {
    return this.advance(admin, orderId, 'CONFIRM_SHIPPING_PAID', (code) =>
      `BaliTrade verified the shipping payment for order ${code}. Next step: handing the goods to the air cargo.`,
    );
  }

  private async advance(
    admin: AuthUser,
    orderId: string,
    action: Extract<OrderAction, 'CONFIRM_PAID' | 'START_QC' | 'CONFIRM_SHIPPING_PAID'>,
    messageFor: (code: string) => string,
  ): Promise<PaymentSummary> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { conversation: { select: { id: true } }, items: { select: { title: true, qty: true } } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const next = nextOrderStatus(order.status, action);
    if (!next) {
      throw new ConflictException(`This is not possible while the order is ${order.status}`);
    }
    if (action === 'CONFIRM_PAID' || action === 'CONFIRM_SHIPPING_PAID') {
      // A guard against a mis-click, not an amount rule: there must be at least something verified to confirm.
      const purpose = action === 'CONFIRM_PAID' ? 'GOODS' : 'SHIPPING';
      const verified = await this.prisma.payment.count({ where: { orderId: order.id, purpose, status: 'VERIFIED' } });
      if (verified === 0) {
        throw new ConflictException('Verify at least one payment of this order first');
      }
    }

    const code = orderCode(order.number);
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: next } });
      if (updated.count === 0) {
        throw new ConflictException('The order was changed in the meantime. Please reload it.');
      }
      const chat = order.conversation ? await this.chat.createSystemMessage(tx, order.conversation.id, messageFor(code)) : null;
      return { chat };
    });

    await this.announce(result.chat, order.buyerId, order.id, code, next, order.items[0]);
    return this.summary(admin, order.id, action === 'CONFIRM_SHIPPING_PAID' ? 'SHIPPING' : 'GOODS');
  }

  private async decide(admin: AuthUser, paymentId: string, status: 'VERIFIED' | 'REJECTED', reason?: string): Promise<PaymentRow> {
    const row = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { ...paymentInclude, order: { select: { id: true, number: true, status: true, buyerId: true, conversation: { select: { id: true } }, items: { select: { title: true, qty: true } } } } },
    });
    if (!row) {
      throw new NotFoundException('Payment not found');
    }
    if (row.status !== 'SUBMITTED') {
      throw new ConflictException(`This payment was already ${row.status.toLowerCase()}`);
    }

    const code = orderCode(row.order.number);
    const amount = this.amountLabel(row.method, row.amountIdr, row.amountUsd.toFixed(2));
    // Rejecting a goods payment returns the order to AWAITING_PAYMENT; a rejected shipping payment leaves it waiting in
    // AWAITING_SHIPPING_PAYMENT, which has no REJECT_PAYMENT transition. Verifying never moves it (see the class comment).
    const next = status === 'REJECTED' ? nextOrderStatus(row.order.status, 'REJECT_PAYMENT') : null;
    const what = row.purpose === 'SHIPPING' ? ' (shipping)' : '';
    const message =
      status === 'VERIFIED'
        ? `BaliTrade confirmed receiving ${amount} for order ${code}${what}.`
        : `BaliTrade could not confirm a payment of ${amount} for order ${code}${what}.${reason ? ` Reason: ${reason}` : ''} You can submit another proof.`;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: row.id, status: 'SUBMITTED' },
        data: {
          status,
          decidedById: admin.id,
          decidedAt: new Date(),
          rejectionReason: status === 'REJECTED' ? (reason ?? null) : null,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException('This payment was decided in the meantime. Please reload it.');
      }
      if (next) {
        await tx.order.updateMany({ where: { id: row.order.id, status: row.order.status }, data: { status: next } });
      }
      const chat = row.order.conversation ? await this.chat.createSystemMessage(tx, row.order.conversation.id, message) : null;
      return { chat, payment: await tx.payment.findUniqueOrThrow({ where: { id: row.id }, include: paymentInclude }) };
    });

    await this.announce(result.chat, row.order.buyerId, row.order.id, code, next ?? row.order.status, row.order.items[0]);
    return result.payment;
  }

  /** Live chat update and the buyer's notification. A failure here must never undo the money decision. */
  private async announce(
    chat: Awaited<ReturnType<ChatService['createSystemMessage']>> | null,
    buyerId: string | null,
    orderId: string,
    code: string,
    status: string,
    item: { title: string; qty: number } | undefined,
  ): Promise<void> {
    try {
      if (chat) await this.chat.publishSystemMessage(chat);
      if (buyerId && item) {
        await this.notifications.notifyOrderStatus(buyerId, {
          orderId,
          code,
          status: status as never,
          productTitle: item.title,
          qty: item.qty,
        });
      }
    } catch (error) {
      this.logger.error('Could not announce the payment change', error);
    }
  }

  /** The buyer and the admins see the money of an order; the seller does not (they are paid by BaliTrade, T20). */
  private async findOrderForMoney(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, buyerId: true, status: true, itemsUsd: true, qcFeeUsd: true, fxRate: true },
    });
    if (!order || !(isAdmin(user.roles) || order.buyerId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private assertReference(dto: SubmitPaymentDto): void {
    const field = PAYMENT_REFERENCE_FIELD[dto.method];
    if (!dto[field]) {
      throw new BadRequestException(`${field} is required for ${dto.method} payments`);
    }
    // Without it the incoming rupiah cannot be matched to this buyer: the money arrives from the exchange, not from them.
    if (dto.method === 'EXCHANGE' && !dto.reference) {
      throw new BadRequestException('reference is required for EXCHANGE payments');
    }
  }

  /** Sanity bounds per currency; they only catch a missing or extra zero. */
  private assertAmount(method: PaymentMethod, amount: number): Prisma.Decimal {
    const [min, max] =
      paymentCurrency(method) === 'IDR' ? [PAYMENT_LIMITS.minIdr, PAYMENT_LIMITS.maxIdr] : [PAYMENT_LIMITS.minUsd, PAYMENT_LIMITS.maxUsd];
    if (amount < min || amount > max) {
      throw new BadRequestException(`The amount must be between ${min} and ${max} ${paymentCurrency(method)}`);
    }
    return new Prisma.Decimal(amount);
  }

  private methodLabel(method: PaymentMethod): string {
    return method === 'BANK_IDR' ? 'bank transfer' : method === 'USDT' ? 'USDT' : 'a partner exchange';
  }

  private amountLabel(method: PaymentMethod, amountIdr: number | null, amountUsd: string): string {
    if (method === 'USDT') return `${amountUsd} USDT`;
    return amountIdr === null ? `$${amountUsd}` : `Rp ${amountIdr.toLocaleString('en-US')} (about $${amountUsd})`;
  }

  private toSummary(purpose: PaymentPurpose, dueUsd: Prisma.Decimal, fxRate: Prisma.Decimal, rows: PaymentRow[]): PaymentSummary {
    const verified = rows
      .filter((row) => row.status === 'VERIFIED')
      .reduce((sum, row) => sum.add(row.amountUsd), new Prisma.Decimal(0));
    const remaining = Prisma.Decimal.max(dueUsd.sub(verified), new Prisma.Decimal(0));
    return {
      purpose,
      dueUsd: dueUsd.toFixed(2),
      fxRate: fxRate.toFixed(4),
      verifiedUsd: verified.toFixed(2),
      remainingUsd: remaining.toFixed(2),
      submittedCount: rows.filter((row) => row.status === 'SUBMITTED').length,
      payments: rows.map((row) => this.toView(row)),
    };
  }

  private toView(row: PaymentRow): PaymentView {
    return {
      id: row.id,
      orderId: row.orderId,
      orderCode: orderCode(row.order.number),
      purpose: row.purpose,
      method: row.method,
      status: row.status,
      amountUsd: row.amountUsd.toFixed(2),
      amountIdr: row.amountIdr,
      senderName: row.senderName,
      txHash: row.txHash,
      exchangeName: row.exchangeName,
      reference: row.reference,
      note: row.note,
      proofKey: row.proofKey,
      submittedBy: row.submittedBy,
      submittedAt: row.submittedAt.toISOString(),
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      rejectionReason: row.rejectionReason,
    };
  }
}
