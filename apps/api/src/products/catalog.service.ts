import { Injectable, NotFoundException } from '@nestjs/common';
import { CATALOG_LIMITS } from '@balitrade/shared';
import type { CatalogProduct, PublicSellerProfile, TranslationLocale } from '@balitrade/shared';
import { toCategoryView } from '../categories/category-label.js';
import { SELECTABLE_CATEGORY } from '../categories/categories.service.js';
import { idrToUsd } from '../fx/fx-math.js';
import { FxService } from '../fx/fx.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CatalogQueryDto } from './dto/catalog-query.dto.js';

const catalogInclude = {
  translations: true,
  media: { orderBy: { sort: 'asc' } },
  seller: { include: { qcZone: true } },
  category: true,
} satisfies Prisma.ProductInclude;

type CatalogRow = Prisma.ProductGetPayload<{ include: typeof catalogInclude }>;

/** `contains` passes the text to LIKE as is, so "%" and "_" would act as wildcards; escape them to match literally. */
const escapeLike = (text: string): string => text.replace(/[\\%_]/g, '\\$&');

/**
 * Relations are read in separate queries, so a seller deleted in between leaves `product.seller` null although the type says
 * otherwise (it made the list answer 500). Such a product is skipped instead of failing the whole response.
 */
const hasSeller = (product: CatalogRow): boolean => (product.seller as CatalogRow['seller'] | null) !== null;

/**
 * Buyers only ever see APPROVED products from APPROVED sellers in a category that is switched on (T26).
 * The category clause is what makes unchecking a category hide its listings everywhere at once — this
 * constant is used by the list, the detail (so /products/[id] answers 404) and the seller page — without
 * changing a single ProductStatus, so checking the box again brings them all back.
 */
const visibleToBuyers: Prisma.ProductWhereInput = {
  status: 'APPROVED',
  seller: { status: 'APPROVED' },
  category: SELECTABLE_CATEGORY,
};

/** Public read side: list with search and filters, product detail, seller page. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly fx: FxService,
  ) {}

  async list(locale: TranslationLocale, query: Omit<CatalogQueryDto, 'locale'> = {}): Promise<CatalogProduct[]> {
    const where: Prisma.ProductWhereInput = { ...visibleToBuyers };
    if (query.category) where.categorySlug = query.category;
    if (query.type) where.type = query.type;
    if (query.q) {
      // Words must all appear (in the title or description, in any language), so "rattan bag" narrows the result.
      where.AND = query.q
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => ({
          translations: {
            some: {
              OR: [
                { title: { contains: escapeLike(word), mode: 'insensitive' } },
                { description: { contains: escapeLike(word), mode: 'insensitive' } },
              ],
            },
          },
        }));
    }
    const products = await this.prisma.product.findMany({
      where,
      include: catalogInclude,
      orderBy: { updatedAt: 'desc' },
      take: CATALOG_LIMITS.pageSize,
    });
    return this.toCatalog(products, locale);
  }

  async detail(id: string, locale: TranslationLocale): Promise<CatalogProduct> {
    const product = await this.prisma.product.findFirst({ where: { id, ...visibleToBuyers }, include: catalogInclude });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const [view] = await this.toCatalog([product], locale);
    return view!;
  }

  async sellerProfile(id: string, locale: TranslationLocale): Promise<PublicSellerProfile> {
    const seller = await this.prisma.sellerProfile.findFirst({
      where: { id, status: 'APPROVED' },
      include: { qcZone: true },
    });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    const products = await this.prisma.product.findMany({
      where: { ...visibleToBuyers, sellerId: seller.id },
      include: catalogInclude,
      orderBy: { updatedAt: 'desc' },
      take: CATALOG_LIMITS.pageSize,
    });
    return {
      id: seller.id,
      displayName: seller.displayName,
      about: seller.about,
      location: seller.qcZone?.name ?? null,
      memberSince: (seller.reviewedAt ?? seller.createdAt).toISOString(),
      products: await this.toCatalog(products, locale),
    };
  }

  private async toCatalog(products: CatalogRow[], locale: TranslationLocale): Promise<CatalogProduct[]> {
    // One rate for the whole response, so every price in it uses the same rate.
    const rate = await this.fx.latest();
    return products.filter(hasSeller).map((product) => {
      // Fall back to the seller's own language when this language has no translation.
      const text =
        product.translations.find((t) => t.locale === locale) ??
        product.translations.find((t) => t.locale === product.sourceLocale);
      return {
        id: product.id,
        type: product.type,
        category: product.categorySlug,
        categoryName: toCategoryView(product.category, locale).name,
        unit: product.unit as CatalogProduct['unit'],
        priceIdr: product.priceIdr,
        priceUsd: rate ? idrToUsd(product.priceIdr, rate.rate) : null,
        moq: product.moq,
        stockQty: product.stockQty,
        leadTimeDays: product.leadTimeDays,
        title: text?.title ?? '',
        description: text?.description ?? '',
        isAuto: text?.isAuto ?? false,
        textLocale: (text?.locale ?? product.sourceLocale) as TranslationLocale,
        media: product.media.map((item) => ({
          key: item.r2Key,
          type: item.type,
          url: this.media.publicUrlFor(item.r2Key),
        })),
        seller: {
          id: product.seller.id,
          displayName: product.seller.displayName,
          location: product.seller.qcZone?.name ?? null,
        },
      };
    });
  }
}
