import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { FxModule } from '../fx/fx.module.js';
import { MediaModule } from '../media/media.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminShippingController } from './admin-shipping.controller.js';
import { ShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';

@Module({
  imports: [AuthModule, ChatModule, NotificationsModule, MediaModule, FxModule],
  controllers: [ShippingController, AdminShippingController],
  providers: [ShippingService],
})
export class ShippingModule {}
