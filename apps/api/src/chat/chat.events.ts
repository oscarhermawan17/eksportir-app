import { Injectable } from '@nestjs/common';
import type { ChatMessageView } from '@balitrade/shared';
import { Subject } from 'rxjs';

export interface MessageCreatedEvent {
  conversationId: string;
  buyerId: string;
  sellerUserId: string;
  message: ChatMessageView;
}

/** Lets ChatService announce new messages without knowing about Socket.IO (the gateway listens). */
@Injectable()
export class ChatEvents {
  readonly messageCreated = new Subject<MessageCreatedEvent>();
}
