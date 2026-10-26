import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';
import { SellersModule } from '../sellers/sellers.module.js';
import { AdminProductsService } from './admin-products.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [AuthModule, SellersModule, MediaModule],
  controllers: [ProductsController, CatalogController],
  providers: [ProductsService, AdminProductsService, CatalogService],
  exports: [ProductsService, AdminProductsService],
})
export class ProductsModule {}
