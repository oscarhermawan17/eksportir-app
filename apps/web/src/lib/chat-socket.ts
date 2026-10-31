import { CHAT_EVENTS, NOTIFICATION_EVENTS } from '@balitrade/shared';
import type { ChatMessageView, NotificationCount, NotificationPush } from '@balitrade/shared';
import { io, type Socket } from 'socket.io-client';

// The socket lives on the API server (same origin as the REST API, without the /api path).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const SOCKET_URL = new URL(API_URL).origin;

let socket: Socket | null = null;
let subscribers = 0;

/** One shared connection while at least one chat component is mounted; it closes when the last one goes away. */
function acquire(): Socket {
  subscribers += 1;
  if (!socket) {
    // The session cookie travels with the handshake; the server checks it and the Origin.
    socket = io(SOCKET_URL, { withCredentials: true });
  }
  return socket;
}

function release(): void {
  subscribers -= 1;
  if (subscribers <= 0 && socket) {
    socket.disconnect();
    socket = null;
    subscribers = 0;
  }
}

interface Handlers<T> {
  onEvent: (payload: T) => void;
  /** Called with the connection state: right after subscribing, on every (re)connect and on every disconnect. */
  onStatus: (connected: boolean) => void;
}

/** Live messages of one conversation. Returns the unsubscribe function. */
export function subscribeToConversation(conversationId: string, { onEvent, onStatus }: Handlers<ChatMessageView>): () => void {
  const current = acquire();
  const join = () => current.emit(CHAT_EVENTS.join, conversationId);
  const onMessage = (message: ChatMessageView) => {
    if (message.conversationId === conversationId) onEvent(message);
  };
  const onConnect = () => {
    join(); // rooms are lost on reconnect, so join again
    onStatus(true);
  };
  const onDown = () => onStatus(false);

  current.on(CHAT_EVENTS.message, onMessage);
  current.on('connect', onConnect);
  current.on('disconnect', onDown);
  current.on('connect_error', onDown);
  if (current.connected) join();
  queueMicrotask(() => onStatus(current.connected));

  return () => {
    current.off(CHAT_EVENTS.message, onMessage);
    current.off('connect', onConnect);
    current.off('disconnect', onDown);
    current.off('connect_error', onDown);
    if (current.connected) current.emit(CHAT_EVENTS.leave, conversationId);
    release();
  };
}

/** Signals that a conversation of the user changed (a new message), so the inbox can re-read its list. */
export function subscribeToInbox({ onEvent, onStatus }: Handlers<{ conversationId: string }>): () => void {
  const current = acquire();
  const onUpdated = (payload: { conversationId: string }) => onEvent(payload);
  const onUp = () => onStatus(true);
  const onDown = () => onStatus(false);

  current.on(CHAT_EVENTS.updated, onUpdated);
  current.on('connect', onUp);
  current.on('disconnect', onDown);
  current.on('connect_error', onDown);
  queueMicrotask(() => onStatus(current.connected));

  return () => {
    current.off(CHAT_EVENTS.updated, onUpdated);
    current.off('connect', onUp);
    current.off('disconnect', onDown);
    current.off('connect_error', onDown);
    release();
  };
}

/** Live notifications of the logged-in user: new ones, and the unread count after something was read in another tab. */
export function subscribeToNotifications({
  onCreated,
  onCount,
  onStatus,
}: {
  onCreated: (push: NotificationPush) => void;
  onCount: (count: NotificationCount) => void;
  onStatus: (connected: boolean) => void;
}): () => void {
  const current = acquire();
  const onUp = () => onStatus(true);
  const onDown = () => onStatus(false);

  current.on(NOTIFICATION_EVENTS.created, onCreated);
  current.on(NOTIFICATION_EVENTS.count, onCount);
  current.on('connect', onUp);
  current.on('disconnect', onDown);
  current.on('connect_error', onDown);
  queueMicrotask(() => onStatus(current.connected));

  return () => {
    current.off(NOTIFICATION_EVENTS.created, onCreated);
    current.off(NOTIFICATION_EVENTS.count, onCount);
    current.off('connect', onUp);
    current.off('disconnect', onDown);
    current.off('connect_error', onDown);
    release();
  };
}
