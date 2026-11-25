import { Module } from '@nestjs/common';
import { PAYMENT_LIMITS } from '@balitrade/shared';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { MessageRateLimiter } from '../chat/message-rate-limiter.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminOrderPaymentsController } from './admin-order-payments.controller.js';
import { AdminPaymentSettingsController } from './admin-payment-settings.controller.js';
import { AdminPaymentsController } from './admin-payments.controller.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentSettingsService } from './payment-settings.service.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, AuditModule],
  controllers: [PaymentsController, AdminPaymentsController, AdminOrderPaymentsController, AdminPaymentSettingsController],
  providers: [
    PaymentsService,
    PaymentSettingsService,
    // Its own limiter instance (per hour), separate from the chat and order-request limiters.
    {
      provide: MessageRateLimiter,
      useFactory: () => new MessageRateLimiter(PAYMENT_LIMITS.perHour, Date.now, 3_600_000, 'Too many payment submissions. Please try again later.'),
    },
  ],
})
export class PaymentsModule {}
