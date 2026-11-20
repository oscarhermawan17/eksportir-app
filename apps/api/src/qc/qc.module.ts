import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { MediaModule } from '../media/media.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminQcController } from './admin-qc.controller.js';
import { QcAutoApproveService } from './qc-auto-approve.service.js';
import { QcController } from './qc.controller.js';
import { QcService } from './qc.service.js';

/** Buyer problem reports per hour; each one posts into the order chat and notifies the seller. */
const ISSUE_REPORTS_PER_HOUR = 10;

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, MediaModule],
  controllers: [QcController, AdminQcController],
  providers: [
    QcService,
    QcAutoApproveService,
    {
      provide: MessageRateLimiter,
      useFactory: () => new MessageRateLimiter(ISSUE_REPORTS_PER_HOUR, Date.now, 3_600_000, 'Too many problem reports. Please try again later.'),
    },
  ],
  exports: [QcService],
})
export class QcModule {}
