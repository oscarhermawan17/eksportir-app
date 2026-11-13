import { Module } from '@nestjs/common';
import { ORDER_LIMITS } from '@balitrade/shared';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { FxModule } from '../fx/fx.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [AuthModule, ChatModule, FxModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    // A separate limiter instance for order requests (per hour), distinct from the chat message limiter.
    { provide: MessageRateLimiter, useFactory: () => new MessageRateLimiter(ORDER_LIMITS.requestsPerHour, Date.now, 3_600_000, 'Too many order requests. Please try again later.') },
  ],
  // AdminModule's orders table uses it; without this Nest fails at startup, not at compile time.
  exports: [OrdersService],
})
export class OrdersModule {}
