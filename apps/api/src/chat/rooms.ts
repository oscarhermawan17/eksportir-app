/** Socket.IO room names shared by the chat and notification gateways. */
export const conversationRoom = (conversationId: string): string => `conversation:${conversationId}`;
/** Everything meant for one user, on every tab and device they have open. */
export const userRoom = (userId: string): string => `user:${userId}`;
export const MODERATORS_ROOM = 'moderators';
