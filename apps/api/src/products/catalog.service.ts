import { Injectable } from '@nestjs/common';
import type { CatalogProduct, TranslationLocale } from '@balitrade/shared';
import { idrToUsd } from '../fx/fx-math.js';
import { FxService } from '../fx/fx.service.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Public read side. Buyers only ever see APPROVED products from APPROVED sellers.
 * T12 extends this with search, filters and detail.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly fx: FxService,
  ) {}

  async list(locale: TranslationLocale): Promise<CatalogProduct[]> {
    // One rate for the whole response, so every price in it uses the same rate.
    const rate = await this.fx.latest();
    const products = await this.prisma.product.findMany({
      where: { status: 'APPROVED', seller: { status: 'APPROVED' } },
      include: { translations: true, media: { orderBy: { sort: 'asc' } }, seller: { include: { qcZone: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return products.map((product) => {
      // Fall back to the seller's own language when this language has no translation.
      const text =
        product.translations.find((t) => t.locale === locale) ??
        product.translations.find((t) => t.locale === product.sourceLocale);
      return {
        id: product.id,
        type: product.type,
        category: product.category as CatalogProduct['category'],
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
