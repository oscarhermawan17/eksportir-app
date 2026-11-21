import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BANK_LIMITS, COMPLETION_LIMITS, maskAccount, orderCode, payoutBreakdown } from '@balitrade/shared';
import type { AuthUser, OrderPayoutView, PayoutBreakdown, PayoutPreview, PayoutRecordView, SellerBankView } from '@balitrade/shared';
import { AuditService } from '../audit/audit.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService, parsePrivateKey } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RecordPayoutDto, SellerBankDto } from './dto/payouts.dto.js';

const orderSelect = {
  id: true,
  number: true,
  status: true,
  buyerId: true,
  sellerId: true,
  commissionRate: true,
  seller: { select: { id: true, userId: true, displayName: true, user: { select: { name: true } } } },
  items: { select: { qty: true, unitPriceIdr: true } },
  payout: { include: { recordedBy: { select: { id: true, name: true } } } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

/** Roles that may read payouts and bank details for a transfer; recording one is the OWNER's alone (the controller). */
const MONEY_ROLES = new Set(['ADMIN_FINANCE', 'ADMIN_OWNER']);

/**
 * Paying sellers (T20). BaliTrade transfers the goods money by hand and records it here; nothing moves money
 * automatically. Rules that keep it safe:
 *
 * - **Every amount is computed here**, from the order's own frozen snapshot (quantity × the seller's rupiah price, and
 *   the commission rate frozen when the order was requested). No route accepts an amount.
 * - **Bank details live in their own table and are read only by this service**, so nothing that loads a seller profile
 *   can leak them. The seller sees their own; FINANCE and OWNER see them to make a transfer; every other view masks them.
 * - **A payout is a snapshot and is never edited**: one per order, with the bank details as they were, so a later change
 *   of account or rate never rewrites history. It is written with its audit row in one transaction.
 * - A recently changed account is flagged on the OWNER's form: a hijacked seller account would change it first.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The seller's own bank details, or null before they are filled in. */
  async myBank(user: AuthUser): Promise<SellerBankView | null> {
    const profile = await this.ownProfile(user);
    const bank = await this.prisma.sellerBankAccount.findUnique({ where: { sellerId: profile.id } });
    return bank ? { bankName: bank.bankName, accountNumber: bank.accountNumber, accountHolder: bank.accountHolder, updatedAt: bank.updatedAt.toISOString() } : null;
  }

  /** The seller sets or replaces their bank details. Audited, with masked numbers only. */
  async setMyBank(user: AuthUser, dto: SellerBankDto): Promise<SellerBankView> {
    const profile = await this.ownProfile(user);
    const saved = await this.prisma.$transaction(async (tx) => {
      const before = await tx.sellerBankAccount.findUnique({ where: { sellerId: profile.id } });
      const data = { bankName: dto.bankName, accountNumber: dto.accountNumber, accountHolder: dto.accountHolder, updatedById: user.id };
      const row = await tx.sellerBankAccount.upsert({ where: { sellerId: profile.id }, create: { sellerId: profile.id, ...data }, update: data });
      await this.audit.record(tx, {
        actorId: user.id,
        action: 'SELLER_BANK_UPDATED',
        entity: 'seller',
        entityId: profile.id,
        data: {
          bankName: row.bankName,
          account: maskAccount(row.accountNumber),
          holder: row.accountHolder,
          previous: before ? { bankName: before.bankName, account: maskAccount(before.accountNumber), holder: before.accountHolder } : null,
        },
      });
      return row;
    });
    return { bankName: saved.bankName, accountNumber: saved.accountNumber, accountHolder: saved.accountHolder, updatedAt: saved.updatedAt.toISOString() };
  }

  /** What the seller receives for an order, and the payout once recorded. The order's seller, FINANCE and OWNER only. */
  async forOrder(user: AuthUser, orderId: string): Promise<OrderPayoutView> {
    const order = await this.findOrder(orderId);
    const isSeller = order.seller.userId === user.id;
    if (!isSeller && !user.roles.some((role) => MONEY_ROLES.has(role))) {
      // The buyer, OPS and outsiders: the payout is between BaliTrade and the seller.
      throw new NotFoundException('Order not found');
    }
    return { breakdown: this.breakdownOf(order), payout: order.payout ? await this.toRecordView(order.payout) : null };
  }

  /** Everything the OWNER needs to make the transfer, bank details in full. FINANCE and OWNER (the controller checks). */
  async preview(orderId: string): Promise<PayoutPreview> {
    const order = await this.findOrder(orderId);
    const bank = await this.prisma.sellerBankAccount.findUnique({ where: { sellerId: order.sellerId } });
    const recentLimit = Date.now() - BANK_LIMITS.recentChangeDays * 24 * 60 * 60 * 1000;
    return {
      breakdown: this.breakdownOf(order),
      payout: order.payout ? await this.toRecordView(order.payout) : null,
      bank: bank
        ? {
            bankName: bank.bankName,
            accountNumber: bank.accountNumber,
            accountHolder: bank.accountHolder,
            updatedAt: bank.updatedAt.toISOString(),
            changedRecently: bank.updatedAt.getTime() > recentLimit,
          }
        : null,
      shop: { id: order.seller.id, displayName: order.seller.displayName, ownerName: order.seller.user.name },
    };
  }

  /** The OWNER records the transfer they made. Amounts and bank details are computed and snapshotted here. */
  async record(admin: AuthUser, orderId: string, dto: RecordPayoutDto): Promise<OrderPayoutView> {
    const order = await this.findOrder(orderId);
    if (order.status !== 'COMPLETED') {
      throw new ConflictException('A seller is paid only once the order is completed');
    }
    if (order.payout) {
      throw new ConflictException('This order was already paid out');
    }
    const bank = await this.prisma.sellerBankAccount.findUnique({ where: { sellerId: order.sellerId } });
    if (!bank) {
      throw new ConflictException('The seller has not filled in their bank details yet');
    }
    const parsed = parsePrivateKey(dto.proofKey);
    if (!parsed || parsed.uploaderId !== admin.id || parsed.kind !== 'IMAGE') {
      throw new BadRequestException('The transfer receipt must be an image you uploaded yourself');
    }
    const paidAt = this.paidAt(dto.paidAt);
    const breakdown = this.breakdownOf(order);
    if (breakdown.netIdr <= 0) {
      throw new ConflictException('There is nothing to pay out for this order');
    }
    const code = orderCode(order.number);

    try {
      await this.prisma.$transaction(async (tx) => {
        const created = await tx.payout.create({
          data: {
            orderId: order.id,
            sellerId: order.sellerId,
            grossIdr: breakdown.grossIdr,
            commissionRate: order.commissionRate,
            commissionIdr: breakdown.commissionIdr,
            netIdr: breakdown.netIdr,
            bankName: bank.bankName,
            accountNumber: bank.accountNumber,
            accountHolder: bank.accountHolder,
            transferReference: dto.transferReference ?? null,
            proofKey: dto.proofKey,
            note: dto.note ?? null,
            paidAt,
            recordedById: admin.id,
          },
        });
        await this.audit.record(tx, {
          actorId: admin.id,
          action: 'PAYOUT_RECORDED',
          entity: 'order',
          entityId: order.id,
          data: {
            code,
            payoutId: created.id,
            ...breakdown,
            commissionRate: order.commissionRate.toFixed(4),
            bankName: bank.bankName,
            account: maskAccount(bank.accountNumber),
            holder: bank.accountHolder,
            reference: dto.transferReference ?? null,
            paidAt: paidAt.toISOString(),
          },
        });
      });
    } catch (error) {
      // Two OWNER tabs recording the same payout at once: the unique order index keeps one.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This order was already paid out');
      }
      throw error;
    }

    // Deliberately not in the order chat: the buyer reads it, and the payout is between BaliTrade and the seller.
    try {
      await this.notifications.notifyPayout(order.seller.userId, { orderId: order.id, code, netIdr: breakdown.netIdr });
    } catch (error) {
      this.logger.error('Could not notify the seller about the payout', error);
    }
    return this.forOrder(admin, order.id);
  }

  private breakdownOf(order: OrderRow): PayoutBreakdown & { commissionRate: string } {
    const grossIdr = order.items.reduce((sum, item) => sum + item.qty * item.unitPriceIdr, 0);
    const rate = order.commissionRate.toFixed(4);
    return { ...payoutBreakdown(grossIdr, rate), commissionRate: rate };
  }

  private async toRecordView(row: NonNullable<OrderRow['payout']>): Promise<PayoutRecordView> {
    return {
      grossIdr: row.grossIdr,
      commissionIdr: row.commissionIdr,
      netIdr: row.netIdr,
      commissionRate: row.commissionRate.toFixed(4),
      bankName: row.bankName,
      accountMasked: maskAccount(row.accountNumber),
      accountHolder: row.accountHolder,
      transferReference: row.transferReference,
      note: row.note,
      paidAt: row.paidAt.toISOString(),
      proofUrl: await this.media.signPrivateRead(row.proofKey),
      recordedBy: row.recordedBy,
    };
  }

  /** A transfer is often recorded afterwards, but never in the future and not implausibly long ago. */
  private paidAt(iso: string): Date {
    const at = new Date(iso);
    const now = Date.now();
    if (at.getTime() > now + 5 * 60 * 1000) {
      throw new BadRequestException('A transfer cannot be dated in the future');
    }
    if (at.getTime() < now - COMPLETION_LIMITS.paidAtMaxDaysBack * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`A transfer cannot be dated more than ${COMPLETION_LIMITS.paidAtMaxDaysBack} days back`);
    }
    return at;
  }

  private async findOrder(orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** The caller's own seller profile; only sellers have bank details. */
  private async ownProfile(user: AuthUser) {
    if (!user.roles.includes('SELLER')) {
      throw new ForbiddenException('Only sellers have payout bank details');
    }
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!profile) {
      throw new ForbiddenException('Only sellers have payout bank details');
    }
    return profile;
  }
}
