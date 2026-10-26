import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthUser, ProductView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ApprovedSellerGuard } from '../sellers/approved-seller.guard.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

/** A seller's own listings. Only APPROVED sellers may list (T07 rule). */
@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovedSellerGuard)
@Roles('SELLER')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ProductView[]> {
    return this.products.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: ProductDto): Promise<ProductView> {
    return this.products.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductView> {
    return this.products.get(user.id, id);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProductDto): Promise<ProductView> {
    return this.products.update(user.id, id, dto);
  }

  @Post(':id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductView> {
    return this.products.submit(user.id, id);
  }

  @Post(':id/archive')
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductView> {
    return this.products.archive(user.id, id);
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ProductView> {
    return this.products.restore(user.id, id);
  }
}
