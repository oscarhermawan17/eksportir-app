import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProductsModule } from '../products/products.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { AdminController } from './admin.controller.js';
import { AdminProductsController } from './admin-products.controller.js';
import { AdminSellersController } from './admin-sellers.controller.js';

@Module({
  imports: [AuthModule, SellersModule, ProductsModule],
  controllers: [AdminController, AdminSellersController, AdminProductsController],
})
export class AdminModule {}
