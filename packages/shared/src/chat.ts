/** Keep ConversationType in sync with the enum in apps/api/prisma/schema.prisma. */
export const ConversationType = {
  PRODUCT_INQUIRY: 'PRODUCT_INQUIRY',
  ORDER: 'ORDER',
} as const;
export type ConversationType = (typeof ConversationType)[keyof typeof ConversationType];

export const CHAT_LIMITS = {
  bodyMax: 2000,
  /** Messages returned per request (older ones are fetched with `before`). */
  pageSize: 50,
  /** Messages one user may send per minute (all conversations together). */
  messagesPerMinute: 20,
} as const;

/** Socket.IO events (the API pushes; the browser only joins and leaves rooms, messages are written through REST). */
export const CHAT_EVENTS = {
  /** Client → server, payload: conversation id; the acknowledgement is a `ChatJoinAck`. */
  join: 'conversation:join',
  /** Client → server, payload: conversation id. */
  leave: 'conversation:leave',
  /** Server → clients in the conversation room, payload: `ChatMessageView`. */
  message: 'message:new',
  /** Server → the conversation's buyer and seller and the moderating admins, payload: `{ conversationId }`. */
  updated: 'conversation:updated',
} as const;

export interface ChatJoinAck {
  ok: boolean;
}

/** Which side wrote a message. BaliTrade admins take part in every conversation; SYSTEM messages (order events) have no author. */
export type ChatRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'SYSTEM';

export interface ChatMessageView {
  id: string;
  conversationId: string;
  body: string;
  /** ISO timestamp. */
  createdAt: string;
  /** Sellers appear under their shop name, everyone else under their own name; `id` is null for SYSTEM messages. */
  sender: { id: string | null; name: string; role: ChatRole };
}

export interface ConversationView {
  id: string;
  type: ConversationType;
  /** The product the buyer asked about (null for conversations without one, or once the product is gone). */
  product: { id: string; title: string; coverUrl: string | null } | null;
  buyer: { id: string; name: string };
  seller: { id: string; displayName: string };
  /** Set for the chat of an order (then `product` is null). */
  order: { id: string; code: string } | null;
  lastMessage: { body: string; senderRole: ChatRole; createdAt: string } | null;
  lastMessageAt: string | null;
  createdAt: string;
}

/** Body of POST /api/conversations. */
export interface StartInquiryInput {
  productId: string;
}

/** Body of POST /api/conversations/:id/messages. */
export interface SendMessageInput {
  body: string;
}
