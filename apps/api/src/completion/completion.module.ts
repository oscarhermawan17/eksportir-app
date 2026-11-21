import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminCompletionController, CompletionController } from './completion.controller.js';
import { CompletionService } from './completion.service.js';

/** Problem reports per buyer per hour; each one posts into the order chat and notifies the seller. */
const ISSUE_REPORTS_PER_HOUR = 10;

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, AuditModule],
  controllers: [CompletionController, AdminCompletionController],
  providers: [
    CompletionService,
    {
      provide: MessageRateLimiter,
      useFactory: () => new MessageRateLimiter(ISSUE_REPORTS_PER_HOUR, Date.now, 3_600_000, 'Too many problem reports. Please try again later.'),
    },
  ],
})
export class CompletionModule {}
