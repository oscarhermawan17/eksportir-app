import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PAYMENT_LIMITS,
  PAYMENT_REFERENCE_FIELD,
  isAdmin,
  nextOrderStatus,
  orderCode,
  paymentCurrency,
} from '@balitrade/shared';
import type {
  AuthUser,
  OrderAction,
  PaymentInstructions,
  PaymentMethod,
  PaymentStatus,
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
import type { SubmitPaymentDto } from './dto/submit-payment.dto.js';

const paymentInclude = {
  submittedBy: { select: { id: true, name: true } },
  decidedBy: { select: { id: true, name: true } },
  order: { select: { id: true, number: true } },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

const ADMIN_LIST_LIMIT = 200;

/** A buyer may only send money while the order is waiting for it. */
const PAYABLE_STATUSES = new Set(['AWAITING_PAYMENT', 'PAYMENT_SUBMITTED']);

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

  /** The buyer's payments for an order, with what is still open. Admins see the same; the seller is not a party to the money. */
  async summary(user: AuthUser, orderId: string): Promise<PaymentSummary> {
    const order = await this.findOrderForMoney(user, orderId);
    const rows = await this.prisma.payment.findMany({
      where: { orderId: order.id, purpose: 'GOODS' },
      include: paymentInclude,
      orderBy: { submittedAt: 'desc' },
    });
    return this.toSummary(order.itemsUsd.add(order.qcFeeUsd), rows);
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
    if (!PAYABLE_STATUSES.has(order.status)) {
      throw new ConflictException(`This order cannot be paid while it is ${order.status}`);
    }
    // The uploader is part of the key (media.service.ts), so this also stops a buyer attaching someone else's file.
    if (!dto.proofKey.startsWith(`private/${user.id}/`)) {
      throw new BadRequestException('The proof must be a file you uploaded yourself');
    }
    this.assertReference(dto);
    const amount = this.assertAmount(dto.method, dto.amount);
    this.limiter.consume(user.id);

    const amountIdr = paymentCurrency(dto.method) === 'IDR' ? Math.round(dto.amount) : null;
    const amountUsd = amountIdr === null ? amount.toFixed(2) : idrToUsd(amountIdr, order.fxRate);

    const next = nextOrderStatus(order.status, 'SUBMIT_PAYMENT');
    if (!next) {
      throw new ConflictException(`This order cannot be paid while it is ${order.status}`);
    }

    const code = orderCode(order.number);
    const message = `Buyer submitted a payment for order ${code}: ${this.amountLabel(dto.method, amountIdr, amountUsd)} via ${this.methodLabel(dto.method)}${
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
          purpose: 'GOODS',
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
    return this.summary(user, order.id);
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
  async adminList(status?: PaymentStatus): Promise<PaymentView[]> {
    const rows = await this.prisma.payment.findMany({
      where: status ? { status } : {},
      include: paymentInclude,
      orderBy: { submittedAt: 'desc' },
      take: ADMIN_LIST_LIMIT,
    });
    return rows.map((row) => this.toView(row));
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

  /** The goods are with BaliTrade and quality control begins (ADMIN_OPS). T18 adds the report itself. */
  async startQc(admin: AuthUser, orderId: string): Promise<PaymentSummary> {
    return this.advance(admin, orderId, 'START_QC', (code) => `Order ${code} is now in quality control at BaliTrade.`);
  }

  private async advance(
    admin: AuthUser,
    orderId: string,
    action: Extract<OrderAction, 'CONFIRM_PAID' | 'START_QC'>,
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
    if (action === 'CONFIRM_PAID') {
      // A guard against a mis-click, not an amount rule: there must be at least something verified to confirm.
      const verified = await this.prisma.payment.count({ where: { orderId: order.id, purpose: 'GOODS', status: 'VERIFIED' } });
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
    return this.summary(admin, order.id);
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
    // Rejecting returns the order to AWAITING_PAYMENT; verifying leaves the status alone (the class comment explains why).
    const next = status === 'REJECTED' ? nextOrderStatus(row.order.status, 'REJECT_PAYMENT') : null;
    const message =
      status === 'VERIFIED'
        ? `BaliTrade confirmed receiving ${amount} for order ${code}.`
        : `BaliTrade could not confirm a payment of ${amount} for order ${code}.${reason ? ` Reason: ${reason}` : ''} You can submit another proof.`;

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
      select: { id: true, buyerId: true, itemsUsd: true, qcFeeUsd: true },
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

  private toSummary(dueUsd: Prisma.Decimal, rows: PaymentRow[]): PaymentSummary {
    const verified = rows
      .filter((row) => row.status === 'VERIFIED')
      .reduce((sum, row) => sum.add(row.amountUsd), new Prisma.Decimal(0));
    const remaining = Prisma.Decimal.max(dueUsd.sub(verified), new Prisma.Decimal(0));
    return {
      dueUsd: dueUsd.toFixed(2),
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
