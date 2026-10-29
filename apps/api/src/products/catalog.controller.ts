import { Controller, Get, Param, Query } from '@nestjs/common';
import type { CatalogProduct, PublicSellerProfile } from '@balitrade/shared';
import { CatalogService } from './catalog.service.js';
import { CatalogQueryDto, LocaleQueryDto } from './dto/catalog-query.dto.js';

/** Public (no login): what buyers can browse. */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  list(@Query() { locale, ...filters }: CatalogQueryDto): Promise<CatalogProduct[]> {
    return this.catalog.list(locale ?? 'en', filters);
  }

  @Get('products/:id')
  detail(@Param('id') id: string, @Query() { locale }: LocaleQueryDto): Promise<CatalogProduct> {
    return this.catalog.detail(id, locale ?? 'en');
  }

  @Get('public/sellers/:id')
  seller(@Param('id') id: string, @Query() { locale }: LocaleQueryDto): Promise<PublicSellerProfile> {
    return this.catalog.sellerProfile(id, locale ?? 'en');
  }
}
