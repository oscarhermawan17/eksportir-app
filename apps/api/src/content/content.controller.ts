import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { AdminContentItemView, AuthUser, ContentItemView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminContentQueryDto, ContentQueryDto, CreateContentDto, MoveContentDto, UpdateContentDto } from './content.dto.js';
import { ContentService } from './content.service.js';

/** Public (no login): the shown steps or questions of /how-it-works, in one language. */
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: ContentQueryDto): Promise<ContentItemView[]> {
    return this.content.listPublic(query.kind, query.locale ?? 'en');
  }
}

/** What the site says about how BaliTrade works is the owner's word, like the categories (2026-11-26). */
@Controller('admin/content')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OWNER')
export class AdminContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: AdminContentQueryDto): Promise<AdminContentItemView[]> {
    return this.content.listForAdmin(query.kind);
  }

  @Post()
  create(@Body() dto: CreateContentDto, @CurrentUser() admin: AuthUser): Promise<AdminContentItemView> {
    return this.content.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContentDto, @CurrentUser() admin: AuthUser): Promise<AdminContentItemView> {
    return this.content.update(id, dto, admin.id);
  }

  @Post(':id/move')
  @HttpCode(200)
  move(@Param('id') id: string, @Body() dto: MoveContentDto, @CurrentUser() admin: AuthUser): Promise<AdminContentItemView[]> {
    return this.content.move(id, dto.direction, admin.id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): Promise<void> {
    return this.content.remove(id);
  }
}
