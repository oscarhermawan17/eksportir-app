import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminPayoutsController, PayoutsController } from './payouts.controller.js';
import { PayoutsService } from './payouts.service.js';

@Module({
  imports: [AuthModule, MediaModule, NotificationsModule, AuditModule],
  controllers: [PayoutsController, AdminPayoutsController],
  providers: [PayoutsService],
})
export class PayoutsModule {}
