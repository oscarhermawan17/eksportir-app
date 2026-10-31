import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { ChatController } from './chat.controller.js';
import { ChatEvents } from './chat.events.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';
import { MessageRateLimiter } from './message-rate-limiter.js';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [ChatController],
  providers: [ChatService, ChatEvents, ChatGateway, { provide: MessageRateLimiter, useFactory: () => new MessageRateLimiter() }],
  exports: [ChatService, ChatEvents],
})
export class ChatModule {}
