import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { isAdmin, nextOrderStatus, orderCode } from '@balitrade/shared';
import type { AuthUser, OrderAction, OrderStatus } from '@balitrade/shared';
import { AuditService } from '../audit/audit.service.js';
import { ChatService } from '../chat/chat.service.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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

/**
 * The end of an order (T20, owner's decisions of 2026-11-21). Nothing completes by itself: the buyer confirms receipt,
 * or the OWNER completes the order by hand with a note — for a buyer who went quiet, or a problem settled in the chat.
 * A problem after arrival is a discussion (DELIVERY_ISSUE), not a cancellation; refunds and buyer credit are T31.
 * Same pattern as QcService: `nextOrderStatus` decides, the update is conditional on the status (409 otherwise), the
 * change, its history row, its audit row and the chat message are one transaction, and notifications follow the commit.
 */
@Injectable()
export class CompletionService {
  private readonly logger = new Logger(CompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly limiter: MessageRateLimiter,
  ) {}

  /** The buyer says the goods arrived as expected. */
  async confirmReceived(user: AuthUser, orderId: string): Promise<{ status: OrderStatus }> {
    const order = await this.findForBuyer(user, orderId);
    const next = this.nextOrConflict(order, 'CONFIRM_RECEIVED');
    const code = orderCode(order.number);
    const chat = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      return this.systemMessage(tx, order, `Buyer confirmed receiving order ${code}. The order is complete; BaliTrade now pays the seller.`);
    });
    await this.announce(chat, order, next, [order.seller.userId]);
    return { status: next };
  }

  /** The buyer found a problem after delivery: it is talked through before the order is completed. */
  async reportIssue(user: AuthUser, orderId: string, reason: string): Promise<{ status: OrderStatus }> {
    const order = await this.findForBuyer(user, orderId);
    const next = this.nextOrConflict(order, 'REPORT_DELIVERY_ISSUE');
    this.limiter.consume(user.id);
    const code = orderCode(order.number);
    const chat = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      await tx.deliveryIssue.create({ data: { orderId: order.id, reason, reportedById: user.id } });
      return this.systemMessage(
        tx,
        order,
        `Buyer reported a problem after delivery of order ${code}: ${reason}\n` +
          'BaliTrade will talk it through here with the buyer and the seller before the order is completed.',
      );
    });
    await this.announce(chat, order, next, [order.seller.userId]);
    return { status: next };
  }

  /** The OWNER completes an order by hand. The note goes into the chat and, with who did it, into the audit log. */
  async completeByAdmin(admin: AuthUser, orderId: string, note: string): Promise<{ status: OrderStatus }> {
    const order = await this.findOrder(orderId);
    const next = this.nextOrConflict(order, 'ADMIN_COMPLETE');
    const code = orderCode(order.number);
    const chat = await this.prisma.$transaction(async (tx) => {
      await this.moveOrder(tx, order, next);
      await this.audit.record(tx, {
        actorId: admin.id,
        action: 'ORDER_COMPLETED_BY_ADMIN',
        entity: 'order',
        entityId: order.id,
        data: { code, from: order.status, note },
      });
      return this.systemMessage(tx, order, `BaliTrade completed order ${code}. Note: ${note}`);
    });
    await this.announce(chat, order, next, [order.buyerId, order.seller.userId]);
    return { status: next };
  }

  private async findOrder(orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  /** Outsiders get 404 (the order "does not exist" for them); the seller and admins read it but cannot answer for the buyer. */
  private async findForBuyer(user: AuthUser, orderId: string): Promise<OrderRow> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: orderSelect });
    if (!order || !(isAdmin(user.roles) || order.buyerId === user.id || order.seller.userId === user.id)) {
      throw new NotFoundException('Order not found');
    }
    if (order.buyerId !== user.id) {
      throw new ForbiddenException('Only the buyer of this order can do this');
    }
    return order;
  }

  private nextOrConflict(order: OrderRow, action: OrderAction): OrderStatus {
    const next = nextOrderStatus(order.status, action);
    if (!next) {
      throw new ConflictException(`This is not possible while the order is ${order.status}`);
    }
    return next;
  }

  private async moveOrder(tx: Prisma.TransactionClient, order: OrderRow, next: OrderStatus): Promise<void> {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: next, ...(next === 'COMPLETED' ? { completedAt: new Date() } : {}) },
    });
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
    recipients: string[],
  ): Promise<void> {
    try {
      if (chat) await this.chat.publishSystemMessage(chat);
      const item = order.items[0];
      if (!item) return;
      for (const userId of recipients) {
        await this.notifications.notifyOrderStatus(userId, { orderId: order.id, code: orderCode(order.number), status, productTitle: item.title, qty: item.qty });
      }
    } catch (error) {
      this.logger.error('Could not announce the completion step', error);
    }
  }
}
