import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApprovedSellerGuard } from './approved-seller.guard.js';
import { SellersController } from './sellers.controller.js';
import { SellersService } from './sellers.service.js';

@Module({
  imports: [AuthModule],
  controllers: [SellersController],
  providers: [SellersService, ApprovedSellerGuard],
  exports: [SellersService, ApprovedSellerGuard],
})
export class SellersModule {}
