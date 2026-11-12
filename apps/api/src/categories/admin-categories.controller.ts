import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminProductCategoryView } from '@balitrade/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CategoriesService } from './categories.service.js';
import { AdminCategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

/**
 * Categories decide what may be sold at all — switching one off hides every product in it — so this is
 * the owner's call, like the exchange rate (T26, ARCHITECTURE §4).
 *
 * There is **no delete**, by the owner's decision (2026-11-12): switching a category off and archiving it
 * already cover every real case, and both are reversible. A category that products reference could not be
 * deleted anyway — the foreign key is ON DELETE RESTRICT — so the only thing a delete endpoint added was a
 * third concept to explain and one irreversible button.
 */
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OWNER')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@Query() query: AdminCategoryQueryDto): Promise<AdminProductCategoryView[]> {
    return this.categories.listForAdmin(query.archived ?? false);
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<AdminProductCategoryView> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<AdminProductCategoryView> {
    return this.categories.update(id, dto);
  }
}
