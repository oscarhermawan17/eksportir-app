import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { AdminController } from './admin.controller.js';
import { AdminSellersController } from './admin-sellers.controller.js';

@Module({
  imports: [AuthModule, SellersModule],
  controllers: [AdminController, AdminSellersController],
})
export class AdminModule {}
