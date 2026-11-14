/** Keep NotificationType in sync with the enum in apps/api/prisma/schema.prisma (more order events are added in T16+). */
export const NotificationType = {
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  ORDER_REQUESTED: 'ORDER_REQUESTED',
  ORDER_STATUS: 'ORDER_STATUS',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_LIMITS = {
  /** Notifications returned by GET /api/notifications (newest first). */
  listSize: 30,
  /** Characters of the message text kept in a chat notification. */
  previewMax: 100,
} as const;

/** Socket.IO events pushed to the owner's private room. */
export const NOTIFICATION_EVENTS = {
  /** A notification was created or updated, payload: `NotificationPush`. */
  created: 'notification:new',
  /** The unread count changed elsewhere (another tab marked something read), payload: `NotificationCount`. */
  count: 'notification:count',
} as const;

/** Several unread messages of one conversation are folded into one notification. */
export interface ChatMessageNotificationPayload {
  conversationId: string;
  /** Product title in the recipient's language (null when the conversation has no product). */
  productTitle: string | null;
  /** Who wrote the latest message (sellers appear under their shop name). */
  senderName: string;
  /** Start of the latest message. */
  preview: string;
  /** Unread messages folded into this notification. */
  count: number;
}

/** A buyer asked a seller to supply an order; sent to the seller. */
export interface OrderRequestedNotificationPayload {
  orderId: string;
  code: string;
  buyerName: string;
  productTitle: string;
  qty: number;
}

/** An order moved to a new status because of the other side (accepted, declined, change proposed, cancelled, ...). */
export interface OrderStatusNotificationPayload {
  orderId: string;
  code: string;
  /** The new status (an `OrderStatus`). */
  status: string;
  productTitle: string;
  qty: number;
}

interface NotificationBase {
  id: string;
  /** ISO timestamp, or null while unread. */
  readAt: string | null;
  /** ISO timestamp of the latest update (a new message refreshes an unread notification). */
  updatedAt: string;
}

/** Discriminated by `type`, so the payload shape is known after checking it. */
export type NotificationView =
  | (NotificationBase & { type: 'CHAT_MESSAGE'; payload: ChatMessageNotificationPayload })
  | (NotificationBase & { type: 'ORDER_REQUESTED'; payload: OrderRequestedNotificationPayload })
  | (NotificationBase & { type: 'ORDER_STATUS'; payload: OrderStatusNotificationPayload });

/** Response of GET /api/notifications. */
export interface NotificationsResponse {
  items: NotificationView[];
  unreadCount: number;
  /**
   * Unread notifications per type, every type present (0 when there are none. The seller dashboard
   * shows "unread messages" on its own, and `items` only carries the newest `listSize`, so counting
   * them there would quietly understate the number as soon as a person has more than that.
   */
  unreadByType: Record<NotificationType, number>;
}

export interface NotificationPush {
  item: NotificationView;
  unreadCount: number;
}

export interface NotificationCount {
  unreadCount: number;
}
