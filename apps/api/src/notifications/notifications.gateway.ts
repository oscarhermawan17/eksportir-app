import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { NOTIFICATION_EVENTS } from '@balitrade/shared';
import type { Server } from 'socket.io';
import type { Subscription } from 'rxjs';
import { userRoom } from '../chat/rooms.js';
import { NotificationEvents } from './notification.events.js';

/**
 * Pushes notifications to the private room of their owner. Sockets are authenticated by the middleware of the chat gateway
 * (same Socket.IO server), which also puts every socket into its user room.
 */
@WebSocketGateway()
export class NotificationsGateway implements OnModuleInit, OnModuleDestroy {
  private subscription?: Subscription;

  @WebSocketServer()
  private server!: Server;

  constructor(private readonly events: NotificationEvents) {}

  onModuleInit(): void {
    this.subscription = this.events.stream.subscribe((event) => {
      if (!this.server) return;
      if (event.kind === 'created') {
        this.server.to(userRoom(event.userId)).emit(NOTIFICATION_EVENTS.created, event.push);
      } else {
        this.server.to(userRoom(event.userId)).emit(NOTIFICATION_EVENTS.count, event.count);
      }
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
