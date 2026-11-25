import { Injectable, NotFoundException } from '@nestjs/common';
import type { AdminContentItemView, ContentItemView, ContentKind, TranslationLocale } from '@balitrade/shared';
import type { ContentItem } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateContentDto, UpdateContentDto } from './content.dto.js';

/** Gap between positions, so a new item goes after the last one without renumbering the others. */
const STEP = 10;

const toAdminView = (row: ContentItem): AdminContentItemView => ({
  id: row.id,
  kind: row.kind,
  titleEn: row.titleEn,
  titleId: row.titleId,
  titleRu: row.titleRu,
  bodyEn: row.bodyEn,
  bodyId: row.bodyId,
  bodyRu: row.bodyRu,
  active: row.active,
  sortOrder: row.sortOrder,
  updatedAt: row.updatedAt.toISOString(),
});

/**
 * The editable page content (2026-11-26). Visitors get the active items of one kind in one language; the OWNER gets
 * everything. The text is stored and served as plain text — the web renders it as text, never as HTML.
 */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(kind: ContentKind, locale: TranslationLocale = 'en'): Promise<ContentItemView[]> {
    const rows = await this.prisma.contentItem.findMany({
      where: { kind, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    // An empty translation falls back to English rather than showing a blank step.
    const pick = (row: ContentItem, field: 'title' | 'body') => {
      const value = { en: row[`${field}En`], id: row[`${field}Id`], ru: row[`${field}Ru`] }[locale];
      return value?.trim() || row[`${field}En`];
    };
    return rows.map((row) => ({ id: row.id, title: pick(row, 'title'), body: pick(row, 'body') }));
  }

  async listForAdmin(kind: ContentKind): Promise<AdminContentItemView[]> {
    const rows = await this.prisma.contentItem.findMany({ where: { kind }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return rows.map(toAdminView);
  }

  async create(dto: CreateContentDto, adminId: string): Promise<AdminContentItemView> {
    const last = await this.prisma.contentItem.findFirst({
      where: { kind: dto.kind },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const row = await this.prisma.contentItem.create({
      data: { ...dto, sortOrder: (last?.sortOrder ?? 0) + STEP, updatedById: adminId },
    });
    return toAdminView(row);
  }

  async update(id: string, dto: UpdateContentDto, adminId: string): Promise<AdminContentItemView> {
    await this.mustExist(id);
    const row = await this.prisma.contentItem.update({ where: { id }, data: { ...dto, updatedById: adminId } });
    return toAdminView(row);
  }

  /**
   * Swaps the item with its neighbour of the same kind, in one transaction. At either end it is a no-op (the buttons
   * are disabled there anyway). Positions are swapped rather than renumbered, so nothing else moves.
   */
  async move(id: string, direction: 'up' | 'down', adminId: string): Promise<AdminContentItemView[]> {
    const item = await this.mustExist(id);
    await this.prisma.$transaction(async (tx) => {
      const neighbour = await tx.contentItem.findFirst({
        where: {
          kind: item.kind,
          id: { not: item.id },
          sortOrder: direction === 'up' ? { lte: item.sortOrder } : { gte: item.sortOrder },
        },
        orderBy: [{ sortOrder: direction === 'up' ? 'desc' : 'asc' }, { createdAt: direction === 'up' ? 'desc' : 'asc' }],
      });
      if (!neighbour) return;
      // Equal positions (never written by this service, but possible by hand) would make a swap a no-op; separate them.
      const [a, b] =
        neighbour.sortOrder === item.sortOrder
          ? direction === 'up'
            ? [item.sortOrder - 1, item.sortOrder]
            : [item.sortOrder + 1, item.sortOrder]
          : [neighbour.sortOrder, item.sortOrder];
      await tx.contentItem.update({ where: { id: item.id }, data: { sortOrder: a, updatedById: adminId } });
      await tx.contentItem.update({ where: { id: neighbour.id }, data: { sortOrder: b } });
    });
    return this.listForAdmin(item.kind);
  }

  async remove(id: string): Promise<void> {
    await this.mustExist(id);
    await this.prisma.contentItem.delete({ where: { id } });
  }

  private async mustExist(id: string): Promise<ContentItem> {
    const row = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Content item not found');
    return row;
  }
}
