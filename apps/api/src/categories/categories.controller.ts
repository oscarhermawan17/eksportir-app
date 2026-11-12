import { Controller, Get, Query } from '@nestjs/common';
import type { ProductCategoryView } from '@balitrade/shared';
import { CategoriesService } from './categories.service.js';
import { CategoryLocaleQueryDto } from './dto/category.dto.js';

/** Public (no login): the categories buyers can filter by and sellers can choose from. */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Query() query: CategoryLocaleQueryDto): Promise<ProductCategoryView[]> {
    return this.categories.listSelectable(query.locale ?? 'en');
  }
}
