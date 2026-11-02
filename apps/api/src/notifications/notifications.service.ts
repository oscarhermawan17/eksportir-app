import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NOTIFICATION_LIMITS, NotificationType } from '@balitrade/shared';
import type {
  AuthUser,
  ChatMessageNotificationPayload,
  NotificationCount,
  OrderRequestedNotificationPayload,
  NotificationsResponse,
  NotificationView,
} from '@balitrade/shared';
import type { Subscription } from 'rxjs';
import { ChatEvents, type MessageCreatedEvent } from '../chat/chat.events.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationEvents } from './notification.events.js';

type NotificationRow = Prisma.NotificationGetPayload<object>;

const conversationSubject = (conversationId: string): string => `conversation:${conversationId}`;

/** One line of the message, cut to a fixed length. */
export function makePreview(body: string, max: number = NOTIFICATION_LIMITS.previewMax): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/**
 * In-app notifications. A new chat message notifies the other side of the conversation (the admin writes to both
 * buyer and seller); unread messages of one conversation share one notification with a counter.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private subscription?: Subscription;

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatEvents: ChatEvents,
    private readonly events: NotificationEvents,
  ) {}

  onModuleInit(): void {
    this.subscription = this.chatEvents.messageCreated.subscribe((event) => {
      // A failing notification must never break sending the message itself.
      this.onMessage(event).catch((error: unknown) => this.logger.error('Could not create chat notifications', error));
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async list(user: AuthUser): Promise<NotificationsResponse> {
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: NOTIFICATION_LIMITS.listSize,
      }),
      this.unreadCount(user.id),
    ]);
    return { items: rows.map(toView), unreadCount };
  }

  async markRead(user: AuthUser, notificationId: string): Promise<NotificationView> {
    const row = await this.prisma.notification.findFirst({ where: { id: notificationId, userId: user.id } });
    if (!row) {
      throw new NotFoundException('Notification not found');
    }
    const updated = row.readAt ? row : await this.prisma.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
    await this.announceCount(user.id);
    return toView(updated);
  }

  async markAllRead(user: AuthUser): Promise<NotificationCount> {
    await this.prisma.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    return this.announceCount(user.id);
  }

  /** Called when the user opens a conversation: its unread notification is no longer news. */
  async markConversationRead(user: AuthUser, conversationId: string): Promise<NotificationCount> {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: user.id, type: NotificationType.CHAT_MESSAGE, subject: conversationSubject(conversationId), readAt: null },
      data: { readAt: new Date() },
    });
    // The chat panel calls this for every message it shows; only tell the other tabs when something really changed.
    return count > 0 ? this.announceCount(user.id) : { unreadCount: await this.unreadCount(user.id) };
  }

  /** Tells a seller that a buyer asked them to supply an order. */
  async notifyOrderRequested(sellerUserId: string, payload: OrderRequestedNotificationPayload): Promise<void> {
    const row = await this.prisma.notification.create({
      data: {
        userId: sellerUserId,
        type: NotificationType.ORDER_REQUESTED,
        subject: `order:${payload.orderId}`,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    this.events.stream.next({ userId: sellerUserId, kind: 'created', push: { item: toView(row), unreadCount: await this.unreadCount(sellerUserId) } });
  }

  private unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  /** Tells every open tab of the user the new unread count. */
  private async announceCount(userId: string): Promise<NotificationCount> {
    const count = { unreadCount: await this.unreadCount(userId) };
    this.events.stream.next({ userId, kind: 'count', count });
    return count;
  }

  private async onMessage(event: MessageCreatedEvent): Promise<void> {
    // Order events have their own notifications; a system message must not also create a chat one.
    if (event.message.sender.role === 'SYSTEM') return;
    const recipients = [event.buyerId, event.sellerUserId].filter((id) => id !== event.message.sender.id);
    if (recipients.length === 0) return;

    const [conversation, users] = await Promise.all([
      this.prisma.conversation.findUnique({
        where: { id: event.conversationId },
        select: { product: { select: { sourceLocale: true, translations: { select: { locale: true, title: true } } } } },
      }),
      this.prisma.user.findMany({ where: { id: { in: recipients } }, select: { id: true, locale: true } }),
    ]);

    for (const user of users) {
      const product = conversation?.product;
      // The product title in the recipient's language, else the seller's own language.
      const title = product
        ? (product.translations.find((t) => t.locale === user.locale) ?? product.translations.find((t) => t.locale === product.sourceLocale))?.title
        : undefined;
      await this.upsertChatNotification(user.id, event, title ?? null);
    }
  }

  private async upsertChatNotification(userId: string, event: MessageCreatedEvent, productTitle: string | null): Promise<void> {
    const subject = conversationSubject(event.conversationId);
    const existing = await this.prisma.notification.findFirst({
      where: { userId, type: NotificationType.CHAT_MESSAGE, subject, readAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    const previousCount = existing ? (existing.payload as unknown as ChatMessageNotificationPayload).count : 0;
    const payload: ChatMessageNotificationPayload = {
      conversationId: event.conversationId,
      productTitle,
      senderName: event.message.sender.name,
      preview: makePreview(event.message.body),
      count: previousCount + 1,
    };
    const data = { payload: payload as unknown as Prisma.InputJsonValue };
    const row = existing
      ? await this.prisma.notification.update({ where: { id: existing.id }, data })
      : await this.prisma.notification.create({ data: { userId, type: NotificationType.CHAT_MESSAGE, subject, ...data } });
    this.events.stream.next({ userId, kind: 'created', push: { item: toView(row), unreadCount: await this.unreadCount(userId) } });
  }
}

function toView(row: NotificationRow): NotificationView {
  // `payload` is stored as JSON; its shape is fixed by `type` (packages/shared/src/notifications.ts).
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    readAt: row.readAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  } as unknown as NotificationView;
}
