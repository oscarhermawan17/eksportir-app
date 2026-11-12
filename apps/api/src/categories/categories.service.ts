import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminProductCategoryView,
  ProductCategoryView,
  TranslationLocale,
} from '@balitrade/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { toCategoryView } from './category-label.js';
import type { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

/** A category is only offered to sellers and buyers while it is switched on and not archived. */
export const SELECTABLE_CATEGORY = { active: true, archivedAt: null } as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public and seller-facing list: what may be chosen and filtered on, in the requested language. */
  async listSelectable(locale: TranslationLocale = 'en'): Promise<ProductCategoryView[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: SELECTABLE_CATEGORY,
      orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }],
    });
    return rows.map((row) => toCategoryView(row, locale));
  }

  /** OWNER screen. `productCount` decides whether a real delete is offered at all. */
  async listForAdmin(includeArchived = false): Promise<AdminProductCategoryView[]> {
    const rows = await this.prisma.productCategory.findMany({
      where: includeArchived ? {} : { archivedAt: null },
      orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }, { slug: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameEn: row.nameEn,
      nameId: row.nameId,
      nameRu: row.nameRu,
      active: row.active,
      archivedAt: row.archivedAt?.toISOString() ?? null,
      sortOrder: row.sortOrder,
      productCount: row._count.products,
    }));
  }

  async create(dto: CreateCategoryDto): Promise<AdminProductCategoryView> {
    const existing = await this.prisma.productCategory.findUnique({ where: { slug: dto.slug } });
    if (existing) {
      // Re-creating an archived slug would silently un-hide its old products, so say what happened.
      throw new ConflictException(
        existing.archivedAt
          ? `Category ${dto.slug} already exists but is archived. Restore it instead of creating it again.`
          : `Category ${dto.slug} already exists`,
      );
    }
    const created = await this.prisma.productCategory.create({
      data: {
        slug: dto.slug,
        nameEn: dto.nameEn,
        nameId: dto.nameId,
        nameRu: dto.nameRu,
        sortOrder: dto.sortOrder ?? (await this.nextSortOrder()),
      },
    });
    return this.one(created.id);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<AdminProductCategoryView> {
    await this.mustExist(id);
    await this.prisma.productCategory.update({
      where: { id },
      data: {
        nameEn: dto.nameEn,
        nameId: dto.nameId,
        nameRu: dto.nameRu,
        active: dto.active,
        sortOrder: dto.sortOrder,
        // `archived` is a switch in the API and a timestamp in the database, so the admin screen never
        // has to send a date and the row keeps a record of when it was archived.
        ...(dto.archived === undefined ? {} : { archivedAt: dto.archived ? new Date() : null }),
      },
    });
    return this.one(id);
  }

  /**
   * Permanent delete, offered only for a category no product has ever used. The foreign key is
   * ON DELETE RESTRICT, so Postgres would refuse anyway; this check turns that into a clear message.
   */
  async remove(id: string): Promise<void> {
    const row = await this.mustExist(id);
    const products = await this.prisma.product.count({ where: { categorySlug: row.slug } });
    if (products > 0) {
      throw new ConflictException(
        `${products} product(s) still use ${row.slug}. Archive the category instead — its products then ` +
          `disappear from the shop and come back if you restore it.`,
      );
    }
    await this.prisma.productCategory.delete({ where: { id } });
  }

  /**
   * Called before a seller stores a category on a product. Categories are data now, so this is the only
   * place that decides whether a slug is allowed — there is no constant left to validate against.
   */
  async assertSelectable(slug: string): Promise<void> {
    const row = await this.prisma.productCategory.findFirst({
      where: { slug, ...SELECTABLE_CATEGORY },
      select: { id: true },
    });
    if (!row) throw new BadRequestException(`Unknown or disabled category: ${slug}`);
  }

  private async one(id: string): Promise<AdminProductCategoryView> {
    const [view] = (await this.listForAdmin(true)).filter((row) => row.id === id);
    if (!view) throw new NotFoundException('Category not found');
    return view;
  }

  private async mustExist(id: string): Promise<{ slug: string }> {
    const row = await this.prisma.productCategory.findUnique({ where: { id }, select: { slug: true } });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  /** New categories land at the end of the list rather than jumbled in with sortOrder 0. */
  private async nextSortOrder(): Promise<number> {
    const last = await this.prisma.productCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return (last?.sortOrder ?? 0) + 10;
  }
}
