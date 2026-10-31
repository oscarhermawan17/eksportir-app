import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { CHAT_EVENTS } from '@balitrade/shared';
import type { AuthUser, ChatJoinAck } from '@balitrade/shared';
import type { Server, Socket } from 'socket.io';
import type { Subscription } from 'rxjs';
import { SESSION_COOKIE } from '../auth/auth.constants.js';
import { AuthService } from '../auth/auth.service.js';
import type { Env } from '../config/env.js';
import { ChatEvents, type MessageCreatedEvent } from './chat.events.js';
import { ChatService } from './chat.service.js';
import { conversationRoom, MODERATORS_ROOM, userRoom } from './rooms.js';


/** Reads one cookie from a raw `Cookie` header. */
function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/**
 * Pushes new messages to the browsers that have the conversation open. Messages are written through the REST API only;
 * sockets can join and leave rooms and nothing else. Who may join is decided by the same rule as the REST routes.
 */
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private subscription?: Subscription;

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly chat: ChatService,
    private readonly events: ChatEvents,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events.messageCreated.subscribe((event) => this.broadcast(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Authentication runs as Socket.IO middleware, so a client counts as connected only after it passed: it can send `join`
   * right away, and a rejected client fails at the handshake (`connect_error`).
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.authenticate(socket).then(
        (user) => {
          socket.data.user = user;
          next();
        },
        () => next(new Error('unauthorized')),
      );
    });
  }

  handleConnection(client: Socket): void {
    const user = client.data.user as AuthUser;
    void client.join(userRoom(user.id));
    if (user.roles.includes('ADMIN_OPS') || user.roles.includes('ADMIN_OWNER')) void client.join(MODERATORS_ROOM);
  }

  private async authenticate(client: Socket): Promise<AuthUser> {
    // Browsers always send their Origin; a page on another origin must not ride on the visitor's cookie.
    const origin = client.handshake.headers.origin;
    if (origin && origin !== this.config.get('WEB_ORIGIN', { infer: true })) {
      throw new Error('origin not allowed');
    }
    const token = readCookie(client.handshake.headers.cookie, SESSION_COOKIE);
    if (!token) {
      throw new Error('no session');
    }
    return this.auth.authenticate(token);
  }

  @SubscribeMessage(CHAT_EVENTS.join)
  async join(@ConnectedSocket() client: Socket, @MessageBody() conversationId: unknown): Promise<ChatJoinAck> {
    const user = client.data.user as AuthUser | undefined;
    if (!user || typeof conversationId !== 'string' || conversationId.length === 0 || conversationId.length > 64) {
      return { ok: false };
    }
    if (!(await this.chat.canAccess(user, conversationId))) {
      return { ok: false };
    }
    await client.join(conversationRoom(conversationId));
    return { ok: true };
  }

  @SubscribeMessage(CHAT_EVENTS.leave)
  async leave(@ConnectedSocket() client: Socket, @MessageBody() conversationId: unknown): Promise<void> {
    if (typeof conversationId === 'string' && conversationId.length <= 64) {
      await client.leave(conversationRoom(conversationId));
    }
  }

  private broadcast(event: MessageCreatedEvent): void {
    if (!this.server) return;
    this.server.to(conversationRoom(event.conversationId)).emit(CHAT_EVENTS.message, event.message);
    // Only the conversation id is sent to the lists: the browser re-reads it through REST, which checks access again.
    this.server
      .to([userRoom(event.buyerId), userRoom(event.sellerUserId), MODERATORS_ROOM])
      .emit(CHAT_EVENTS.updated, { conversationId: event.conversationId });
    this.logger.debug(`message in ${event.conversationId} delivered`);
  }
}
