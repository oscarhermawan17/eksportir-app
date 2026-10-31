/** Keep NotificationType in sync with the enum in apps/api/prisma/schema.prisma (order events are added in T15+). */
export const NotificationType = {
  CHAT_MESSAGE: 'CHAT_MESSAGE',
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

export interface NotificationView {
  id: string;
  type: NotificationType;
  payload: ChatMessageNotificationPayload;
  /** ISO timestamp, or null while unread. */
  readAt: string | null;
  /** ISO timestamp of the latest update (a new message refreshes an unread notification). */
  updatedAt: string;
}

/** Response of GET /api/notifications. */
export interface NotificationsResponse {
  items: NotificationView[];
  unreadCount: number;
}

export interface NotificationPush {
  item: NotificationView;
  unreadCount: number;
}

export interface NotificationCount {
  unreadCount: number;
}
