import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { TRANSLATION_LOCALES } from '@balitrade/shared';
import type { AdminProductView, ProductStatus, TranslationLocale } from '@balitrade/shared';
import { categoryLabel } from '../categories/category-label.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductTranslationsDto } from './dto/admin-product.dto.js';
import { nextStatus } from './product-status.js';

const reviewInclude = {
  translations: true,
  media: { orderBy: { sort: 'asc' } },
  seller: { include: { user: true } },
  category: true,
} satisfies Prisma.ProductInclude;
type ReviewProduct = Prisma.ProductGetPayload<{ include: typeof reviewInclude }>;

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
  ) {}

  async list(status?: ProductStatus): Promise<AdminProductView[]> {
    const products = await this.prisma.product.findMany({
      // Drafts are the seller's private work and never appear in the admin queue.
      where: status ? { status } : { status: { not: 'DRAFT' } },
      include: reviewInclude,
      orderBy: { updatedAt: 'asc' },
      take: 200,
    });
    // A seller or user deleted between the reads leaves a relation null; skip such a row instead of failing the whole list.
    return products
      .filter((product) => (product.seller?.user as ReviewProduct['seller']['user'] | null | undefined) != null)
      .map((product) => this.toView(product));
  }

  async get(productId: string): Promise<AdminProductView> {
    return this.toView(await this.find(productId));
  }

  /** Manual translation: the admin writes or polishes the text for any of en / id / ru. */
  async saveTranslations(productId: string, dto: ProductTranslationsDto): Promise<AdminProductView> {
    const product = await this.find(productId);
    if (product.status !== 'PENDING_REVIEW' && product.status !== 'APPROVED') {
      throw new ConflictException('Translations can only be edited while the product is in review or live');
    }
    const entries = TRANSLATION_LOCALES.flatMap((locale) => (dto[locale] ? [[locale, dto[locale]] as const] : []));
    if (entries.length === 0) {
      throw new BadRequestException('Send at least one language');
    }

    await this.prisma.$transaction(
      entries.map(([locale, text]) =>
        this.prisma.productTranslation.upsert({
          where: { productId_locale: { productId, locale } },
          update: { title: text.title, description: text.description, isAuto: false },
          create: { productId, locale, title: text.title, description: text.description },
        }),
      ),
    );
    return this.get(productId);
  }

  async approve(productId: string, adminId: string): Promise<AdminProductView> {
    const product = await this.find(productId);
    const next = this.requireTransition(product.status, 'approve');

    const missing = TRANSLATION_LOCALES.filter(
      (locale) => !product.translations.some((t) => t.locale === locale && t.title.trim() && t.description.trim()),
    );
    if (missing.length > 0) {
      throw new BadRequestException(`Add the ${missing.join(', ')} translation before approving`);
    }
    return this.review(productId, adminId, next, null);
  }

  async reject(productId: string, adminId: string, reason: string): Promise<AdminProductView> {
    const product = await this.find(productId);
    return this.review(productId, adminId, this.requireTransition(product.status, 'reject'), reason);
  }

  private requireTransition(current: ProductStatus, action: 'approve' | 'reject'): ProductStatus {
    const next = nextStatus(current, action);
    if (!next) {
      throw new ConflictException('Only a product that is waiting for review can be approved or rejected');
    }
    return next;
  }

  private async review(
    productId: string,
    adminId: string,
    status: ProductStatus,
    rejectionReason: string | null,
  ): Promise<AdminProductView> {
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { status, rejectionReason, reviewedById: adminId, reviewedAt: new Date() },
      include: reviewInclude,
    });
    return this.toView(product);
  }

  private async find(productId: string): Promise<ReviewProduct> {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: reviewInclude });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private toView(product: ReviewProduct): AdminProductView {
    const translations: AdminProductView['translations'] = {};
    for (const item of product.translations) {
      if ((TRANSLATION_LOCALES as readonly string[]).includes(item.locale)) {
        translations[item.locale as TranslationLocale] = {
          title: item.title,
          description: item.description,
          isAuto: item.isAuto,
        };
      }
    }
    return {
      id: product.id,
      type: product.type,
      category: product.categorySlug,
      // English, not the admin's language: the review screen already shows the listing in all three
      // languages next to each other, and the slug is right beside this label. Threading a locale through
      // five admin endpoints to translate one chip was not worth it.
      categoryName: categoryLabel(product.category, 'en'),
      categoryActive: product.category.active && product.category.archivedAt === null,
      unit: product.unit as AdminProductView['unit'],
      priceIdr: product.priceIdr,
      moq: product.moq,
      stockQty: product.stockQty,
      leadTimeDays: product.leadTimeDays,
      sourceLocale: product.sourceLocale as AdminProductView['sourceLocale'],
      status: product.status,
      rejectionReason: product.rejectionReason,
      media: product.media.map((item) => ({
        key: item.r2Key,
        type: item.type,
        url: this.media.publicUrlFor(item.r2Key),
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      seller: {
        id: product.seller.id,
        displayName: product.seller.displayName,
        email: product.seller.user.email,
      },
      translations,
    };
  }
}
