import { Controller, Get, Query } from '@nestjs/common';
import { TRANSLATION_LOCALES } from '@balitrade/shared';
import type { CatalogProduct, TranslationLocale } from '@balitrade/shared';
import { IsIn, IsOptional } from 'class-validator';
import { CatalogService } from './catalog.service.js';

class CatalogQuery {
  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;
}

/** Public (no login): the product list buyers can browse. */
@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: CatalogQuery): Promise<CatalogProduct[]> {
    return this.catalog.list(query.locale ?? 'en');
  }
}
