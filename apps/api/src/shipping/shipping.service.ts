import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MILESTONE_ACTION, TRACKING_LIMITS, isAdmin, nextOrderStatus, orderCode, trackingMilestoneProblem } from '@balitrade/shared';
import type {
  AuthUser,
  OrderStatus,
  ShippingBillLine,
  ShippingBillResponse,
  ShippingBillView,
  TrackingEventView,
  TrackingMilestone,
  TrackingResponse,
} from '@balitrade/shared';
import { ChatService } from '../chat/chat.service.js';
import { FxService } from '../fx/fx.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService, parsePrivateKey } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddTrackingEventDto, IssueShippingBillDto } from './dto/shipping.dto.js';

const orderSelect = {
  id: true,
  number: true,
  status: true,
  buyerId: true,
  seller: { select: { userId: true } },
  conversation: { select: { id: true } },
  items: { select: { title: true, qty: true } },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

const creator = { createdBy: { select: { id: true, name: true } } } satisfies Prisma.ShippingBillInclude;

/** How a milestone reads in the order chat (English, like every system message). */
const MILESTONE_TEXT: Record<TrackingMilestone, string> = {
  PACKED: 'packed',
  HANDED_TO_CARGO: 'handed to the air cargo',
  DEPARTED_BALI: 'departed from Bali',
  ARRIVED_DESTINATION_AIRPORT: 'arrived at the destination airport',
  CUSTOMS: 'in customs processing',
  WITH_LOCAL_PARTNER: 'with our local partner',
  DELIVERED: 'delivered to the buyer',
};

/** A little room for a clock that runs slightly ahead of the server's. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Shipping (T19): the shipping bill OPS issues after packing and weighing, and the manual tracking timeline. The
 * shipping money itself goes through PaymentsService (same table, purpose SHIPPING). Same pattern as QcService:
 * `nextOrderStatus` decides, the order moves only if its status did not change meanwhile (409 otherwise), the row and
 * the system message are one transaction, and notifications follow the commit.
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
    private readonly fx: FxService,
  ) {}

  /** The bill that is due. Buyer and admins; the seller is not a party to the shipping money (owner, 2026-11-20). */
  async bill(user: AuthUser, orderId: string): Promise<ShippingBillResponse> {
    const order = await this.findOrder(orderId);
    if (!(isAdmin(user.roles) || order.buyerId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    return this.billOf(order.id);
  }

  /**
   * OPS bills the shipping (QC_APPROVED → AWAITING_SHIPPING_PAYMENT), or revises the bill while nothing has been paid
   * towards it. The total is the sum of the lines, computed here; the rupiah rate is the one in force now.
   */
  async issueBill(admin: AuthUser, orderId: string, dto: IssueShippingBillDto): Promise<ShippingBillResponse> {
    const order = await this.findOrder(orderId);
    const action = order.status === 'AWAITING_SHIPPING_PAYMENT' ? 'REVISE_SHIPPING_BILL' : 'ISSUE_SHIPPING_BILL';
    const next = this.nextOrConflict(order, action);
    const rate = await this.fx.latest();
    if (!rate) {
      throw new ConflictException('The exchange rate is not set yet, so the shipping bill cannot be priced in rupiah');
    }
    if (dto.photoKey) this.assertOwnPhoto(admin, dto.photoKey);

    const lines: ShippingBillLine[] = dto.lines.map((line) => ({ label: line.label, amountUsd: new Prisma.Decimal(line.amountUsd).toFixed(2) }));
    const total = lines.reduce((sum, line) => sum.add(line.amountUsd), new Prisma.Decimal(0));
    const code = orderCode(order.number);

    const result = await this.prisma.$transaction(async (tx) => {
      if (action === 'REVISE_SHIPPING_BILL') {
        // Inside the transaction, so a payment that arrives while the admin edits cannot slip past the check.
        const paid = await tx.payment.count({ where: { orderId: order.id, purpose: 'SHIPPING', status: { in: ['SUBMITTED', 'VERIFIED'] } } });
        if (paid > 0) {
          throw new ConflictException('A shipping payment was already sent for this bill, so it can no longer be revised');
        }
      }
      await this.moveOrder(tx, order, next);
      await tx.shippingBill.updateMany({ where: { orderId: order.id, supersededAt: null }, data: { supersededAt: new Date() } });
      await tx.shippingBill.create({
        data: {
          orderId: order.id,
          lines: lines as unknown as Prisma.InputJsonValue,
          totalUsd: total,
          fxRate: rate.rate,
          weightKg: new Prisma.Decimal(dto.weightKg),
          cartons: dto.cartons,
          photoKey: dto.photoKey ?? null,
          note: dto.note ?? null,
          createdById: admin.id,
        },
      });
      const detail = lines.map((line) => `${line.label} $${line.amountUsd}`).join(', ');
      const message =
        (action === 'REVISE_SHIPPING_BILL' ? `BaliTrade revised the shipping bill for order ${code}: ` : `BaliTrade packed order ${code}: `) +
        `${dto.cartons} carton(s), ${new Prisma.Decimal(dto.weightKg).toFixed(2)} kg. Shipping: $${total.toFixed(2)} (${detail}). ` +
        'Next step: the buyer pays the shipping; the goods are handed to the air cargo once it is verified.';
      return this.systemMessage(tx, order, message);
    });

    await this.announce(result, order, next, 'BUYER');
    return this.billOf(order.id);
  }

  /** The timeline: the buyer, the seller (they want to know their goods left) and admins. */
  async tracking(user: AuthUser, orderId: string): Promise<TrackingResponse> {
    const order = await this.findOrder(orderId);
    if (!(isAdmin(user.roles) || order.buyerId === user.id || order.seller.userId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    return this.trackingOf(order.id);
  }

  /** OPS records a milestone. The hand-over to the cargo and the delivery also move the order (SHIP, DELIVER). */
  async addEvent(admin: AuthUser, orderId: string, dto: AddTrackingEventDto): Promise<TrackingResponse> {
    const order = await this.findOrder(orderId);
    const existing = await this.prisma.trackingEvent.findMany({ where: { orderId: order.id }, select: { milestone: true } });
    const problem = trackingMilestoneProblem(order.status, existing.map((row) => row.milestone), dto.milestone);
    if (problem === 'ALREADY_ADDED') throw new ConflictException('This milestone was already recorded');
    if (problem === 'NOT_NOW') throw new ConflictException(`This milestone is not possible while the order is ${order.status}`);

    if (dto.milestone === 'HANDED_TO_CARGO' && !dto.awb) {
      throw new BadRequestException('The air waybill number is required when the goods are handed to the cargo');
    }
    if (dto.milestone !== 'HANDED_TO_CARGO' && dto.awb) {
      throw new BadRequestException('An air waybill number belongs to the hand-over to the cargo only');
    }
    const occurredAt = this.occurredAt(dto.occurredAt);
    if (dto.photoKey) this.assertOwnPhoto(admin, dto.photoKey);

    const action = MILESTONE_ACTION[dto.milestone];
    const next = action ? this.nextOrConflict(order, action) : null;
    const awb = dto.awb ? `${dto.awb.replace('-', '').slice(0, 3)}-${dto.awb.replace('-', '').slice(3)}` : null;
    const code = orderCode(order.number);

    const result = await this.prisma.$transaction(async (tx) => {
      if (next) await this.moveOrder(tx, order, next);
      try {
        await tx.trackingEvent.create({
          data: {
            orderId: order.id,
            milestone: dto.milestone,
            occurredAt,
            note: dto.note ?? null,
            awb,
            photoKey: dto.photoKey ?? null,
            createdById: admin.id,
          },
        });
      } catch (error) {
        // Two admins recording the same milestone at once: the unique (order, milestone) index keeps one.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('This milestone was already recorded');
        }
        throw error;
      }
      const message =
        `Tracking update for order ${code}: ${MILESTONE_TEXT[dto.milestone]}` +
        `${awb ? ` (air waybill ${awb})` : ''}.${dto.note ? ` ${dto.note}` : ''}` +
        (dto.milestone === 'DELIVERED' ? ' Please check the goods and tell us here if anything is wrong.' : '');
      return this.systemMessage(tx, order, message);
    });

    // The seller hears when their goods leave and when they arrive; the steps in between are for the buyer.
    await this.announce(result, order, next ?? order.status, action ? 'BOTH' : 'BUYER');
    return this.trackingOf(order.id);
  }

  /** A milestone is often recorded afterwards, but never in the future and not implausibly long ago. */
  private occurredAt(iso?: string): Date {
    if (!iso) return new Date();
    const at = new Date(iso);
    const now = Date.now();
    if (at.getTime() > now + FUTURE_TOLERANCE_MS) {
      throw new BadRequestException('A milestone cannot be dated in the future');
    }
    if (at.getTime() < now - TRACKING_LIMITS.maxDaysBack * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(`A milestone cannot be dated more than ${TRACKING_LIMITS.maxDaysBack} days back`);
    }
    return at;
  }

  /** Photos on the bill and the timeline are private files the writing admin uploaded, like QC media (T18). */
  private assertOwnPhoto(admin: AuthUser, key: string): void {
    const parsed = parsePrivateKey(key);
    if (!parsed || parsed.uploaderId !== admin.id || parsed.kind !== 'IMAGE') {
      throw new BadRequestException('The photo must be an image you uploaded yourself');
    }
  }

  private async findOrder(orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private nextOrConflict(order: OrderRow, action: Parameters<typeof nextOrderStatus>[1]): OrderStatus {
    const next = nextOrderStatus(order.status, action);
    if (!next) {
      throw new ConflictException(`This is not possible while the order is ${order.status}`);
    }
    return next;
  }

  private async moveOrder(tx: Prisma.TransactionClient, order: OrderRow, next: OrderStatus): Promise<void> {
    const updated = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: next } });
    if (updated.count === 0) {
      throw new ConflictException('The order was changed in the meantime. Please reload it.');
    }
  }

  private systemMessage(tx: Prisma.TransactionClient, order: OrderRow, body: string) {
    return order.conversation ? this.chat.createSystemMessage(tx, order.conversation.id, body) : Promise.resolve(null);
  }

  /** Live chat update and notifications, after the commit. A failure here must never undo the step. */
  private async announce(
    chat: Awaited<ReturnType<ChatService['createSystemMessage']>> | null,
    order: OrderRow,
    status: OrderStatus,
    audience: 'BUYER' | 'BOTH',
  ): Promise<void> {
    try {
      if (chat) await this.chat.publishSystemMessage(chat);
      const item = order.items[0];
      if (!item) return;
      const recipients = audience === 'BOTH' ? [order.buyerId, order.seller.userId] : [order.buyerId];
      for (const userId of recipients) {
        await this.notifications.notifyOrderStatus(userId, {
          orderId: order.id,
          code: orderCode(order.number),
          status,
          productTitle: item.title,
          qty: item.qty,
        });
      }
    } catch (error) {
      this.logger.error('Could not announce the shipping change', error);
    }
  }

  private async billOf(orderId: string): Promise<ShippingBillResponse> {
    const rows = await this.prisma.shippingBill.findMany({ where: { orderId }, include: creator, orderBy: { createdAt: 'desc' }, take: 2 });
    const active = rows[0];
    if (!active || active.supersededAt) return { bill: null };
    const view: ShippingBillView = {
      id: active.id,
      lines: active.lines as unknown as ShippingBillLine[],
      totalUsd: active.totalUsd.toFixed(2),
      fxRate: active.fxRate.toFixed(4),
      weightKg: active.weightKg.toFixed(2),
      cartons: active.cartons,
      photoUrl: active.photoKey ? await this.media.signPrivateRead(active.photoKey) : null,
      note: active.note,
      createdAt: active.createdAt.toISOString(),
      createdBy: active.createdBy,
      revised: rows.length > 1,
    };
    return { bill: view };
  }

  private async trackingOf(orderId: string): Promise<TrackingResponse> {
    const rows = await this.prisma.trackingEvent.findMany({
      where: { orderId },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
    });
    const events: TrackingEventView[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        milestone: row.milestone,
        occurredAt: row.occurredAt.toISOString(),
        note: row.note,
        awb: row.awb,
        photoUrl: row.photoKey ? await this.media.signPrivateRead(row.photoKey) : null,
        createdBy: row.createdBy,
      })),
    );
    return { events };
  }
}
