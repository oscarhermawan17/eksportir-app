import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { AdminProductView, AuthUser, PageResult } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminProductsService } from '../products/admin-products.service.js';
import { AdminProductQueryDto } from '../products/dto/admin-product-query.dto.js';
import { ProductTranslationsDto, RejectProductDto } from '../products/dto/admin-product.dto.js';

/** Listing review is an ADMIN_OPS task (ARCHITECTURE §4); the owner can do everything. */
@Controller('admin/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OPS', 'ADMIN_OWNER')
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list(@Query() query: AdminProductQueryDto): Promise<PageResult<AdminProductView>> {
    return this.products.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<AdminProductView> {
    return this.products.get(id);
  }

  @Put(':id/translations')
  saveTranslations(@Param('id') id: string, @Body() dto: ProductTranslationsDto): Promise<AdminProductView> {
    return this.products.saveTranslations(id, dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: AuthUser): Promise<AdminProductView> {
    return this.products.approve(id, admin.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() admin: AuthUser, @Body() dto: RejectProductDto): Promise<AdminProductView> {
    return this.products.reject(id, admin.id, dto.reason);
  }
}
