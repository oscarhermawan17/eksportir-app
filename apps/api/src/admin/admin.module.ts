import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FxModule } from '../fx/fx.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { ProductsModule } from '../products/products.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { AdminController } from './admin.controller.js';
import { AdminExchangeRatesController } from './admin-exchange-rates.controller.js';
import { AdminOrdersController } from './admin-orders.controller.js';
import { AdminProductsController } from './admin-products.controller.js';
import { AdminSellersController } from './admin-sellers.controller.js';

@Module({
  imports: [AuthModule, SellersModule, ProductsModule, FxModule, OrdersModule],
  controllers: [
    AdminController,
    AdminSellersController,
    AdminProductsController,
    AdminOrdersController,
    AdminExchangeRatesController,
  ],
})
export class AdminModule {}
