import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminProductCategoryView } from '@balitrade/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CategoriesService } from './categories.service.js';
import { AdminCategoryQueryDto, CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

/**
 * Categories decide what may be sold at all — switching one off hides every product in it — so this is
 * the owner's call, like the exchange rate (T26, ARCHITECTURE §4).
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

  /** Only possible while no product uses the category; otherwise archive it (PATCH archived: true). */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.categories.remove(id);
  }
}
