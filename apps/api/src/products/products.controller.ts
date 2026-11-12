import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AuthUser, ProductView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ApprovedSellerGuard } from '../sellers/approved-seller.guard.js';
import { LocaleQueryDto } from './dto/catalog-query.dto.js';
import { ProductDto } from './dto/product.dto.js';
import { ProductsService } from './products.service.js';

/**
 * A seller's own listings. Only APPROVED sellers may list (T07 rule).
 *
 * Every endpoint takes `?locale=`: a listing now carries its category's label, and since T26 that label
 * lives in the database, so the web side can no longer look it up in the message files.
 */
@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard, ApprovedSellerGuard)
@Roles('SELLER')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: LocaleQueryDto): Promise<ProductView[]> {
    return this.products.list(user.id, query.locale ?? 'en');
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: ProductDto,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.create(user.id, dto, query.locale ?? 'en');
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.get(user.id, id, query.locale ?? 'en');
  }

  @Put(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ProductDto,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.update(user.id, id, dto, query.locale ?? 'en');
  }

  @Post(':id/submit')
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.submit(user.id, id, query.locale ?? 'en');
  }

  @Post(':id/archive')
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.archive(user.id, id, query.locale ?? 'en');
  }

  @Post(':id/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query() query: LocaleQueryDto,
  ): Promise<ProductView> {
    return this.products.restore(user.id, id, query.locale ?? 'en');
  }
}
