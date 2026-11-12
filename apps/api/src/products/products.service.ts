import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ProductStatus, ProductView, TranslationLocale } from '@balitrade/shared';
import { categoryLabel } from '../categories/category-label.js';
import { CategoriesService } from '../categories/categories.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { MediaService } from '../media/media.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ProductDto } from './dto/product.dto.js';
import { nextStatus, type SellerProductAction } from './product-status.js';

const productInclude = {
  translations: true,
  media: { orderBy: { sort: 'asc' } },
  category: true,
} satisfies Prisma.ProductInclude;
type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const MEDIA_EXTENSIONS: Record<string, 'IMAGE' | 'VIDEO'> = {
  jpg: 'IMAGE',
  png: 'IMAGE',
  webp: 'IMAGE',
  mp4: 'VIDEO',
  webm: 'VIDEO',
  mov: 'VIDEO',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly categories: CategoriesService,
  ) {}

  async list(userId: string, locale: TranslationLocale = 'en'): Promise<ProductView[]> {
    const sellerId = await this.sellerIdOf(userId);
    const products = await this.prisma.product.findMany({
      where: { sellerId },
      include: productInclude,
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });
    return products.map((product) => this.toView(product, locale));
  }

  async get(userId: string, productId: string, locale: TranslationLocale = 'en'): Promise<ProductView> {
    return this.toView(await this.findOwned(userId, productId), locale);
  }

  async create(userId: string, dto: ProductDto, locale: TranslationLocale = 'en'): Promise<ProductView> {
    const sellerId = await this.sellerIdOf(userId);
    // Categories are data since T26, so the DTO only checked the shape of the slug: this is what refuses
    // a category that does not exist or that an admin has switched off.
    await this.categories.assertSelectable(dto.category);
    const media = this.parseMedia(userId, dto);
    try {
      const product = await this.prisma.product.create({
        data: {
          sellerId,
          ...this.coreFields(dto),
          translations: { create: { locale: dto.sourceLocale, title: dto.title, description: dto.description } },
          media: { create: media },
        },
        include: productInclude,
      });
      return this.toView(product, locale);
    } catch (error) {
      throw this.mapMediaConflict(error);
    }
  }

  async update(
    userId: string,
    productId: string,
    dto: ProductDto,
    locale: TranslationLocale = 'en',
  ): Promise<ProductView> {
    const current = await this.findOwned(userId, productId);
    const status = this.transition(current.status, 'edit');
    // Editing a listing whose category an admin has since switched off means picking a different one;
    // leaving it unchecked here would let a seller quietly keep selling in a forbidden category.
    await this.categories.assertSelectable(dto.category);
    const media = this.parseMedia(userId, dto);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.productMedia.deleteMany({ where: { productId } });
        return tx.product.update({
          where: { id: productId },
          data: {
            ...this.coreFields(dto),
            status,
            // Only the seller's own language is rewritten. Other languages (added in review, T10) are kept
            // and re-checked by the admin when the edited product is reviewed again.
            translations: {
              upsert: {
                where: { productId_locale: { productId, locale: dto.sourceLocale } },
                update: { title: dto.title, description: dto.description, isAuto: false },
                create: { locale: dto.sourceLocale, title: dto.title, description: dto.description },
              },
            },
            media: { create: media },
          },
          include: productInclude,
        });
      });
      return this.toView(updated, locale);
    } catch (error) {
      throw this.mapMediaConflict(error);
    }
  }

  async submit(userId: string, productId: string, locale: TranslationLocale = 'en'): Promise<ProductView> {
    const current = await this.findOwned(userId, productId);
    const status = this.transition(current.status, 'submit');
    if (!current.media.some((item) => item.type === 'IMAGE')) {
      throw new BadRequestException('Add at least one photo before submitting for review');
    }
    return this.setStatus(productId, status, locale, { rejectionReason: null });
  }

  async archive(
    userId: string,
    productId: string,
    locale: TranslationLocale = 'en',
  ): Promise<ProductView> {
    const current = await this.findOwned(userId, productId);
    return this.setStatus(productId, this.transition(current.status, 'archive'), locale);
  }

  async restore(
    userId: string,
    productId: string,
    locale: TranslationLocale = 'en',
  ): Promise<ProductView> {
    const current = await this.findOwned(userId, productId);
    return this.setStatus(productId, this.transition(current.status, 'restore'), locale);
  }

  private transition(current: ProductStatus, action: SellerProductAction): ProductStatus {
    const next = nextStatus(current, action);
    if (!next) {
      throw new ConflictException(`A ${current.toLowerCase().replace('_', ' ')} product cannot be ${action}ed this way`);
    }
    return next;
  }

  private async setStatus(
    productId: string,
    status: ProductStatus,
    locale: TranslationLocale,
    extra: { rejectionReason?: string | null } = {},
  ): Promise<ProductView> {
    const product = await this.prisma.product.update({
      where: { id: productId },
      data: { status, ...extra },
      include: productInclude,
    });
    return this.toView(product, locale);
  }

  private coreFields(dto: ProductDto) {
    return {
      type: dto.type,
      categorySlug: dto.category,
      unit: dto.unit,
      priceIdr: dto.priceIdr,
      moq: dto.moq,
      // Only the field that belongs to the product type is stored.
      stockQty: dto.type === 'READY_STOCK' ? (dto.stockQty ?? 0) : null,
      leadTimeDays: dto.type === 'MADE_TO_ORDER' ? (dto.leadTimeDays ?? null) : null,
      sourceLocale: dto.sourceLocale,
    };
  }

  /** Keys must be files this seller uploaded for PRODUCT_MEDIA; the media type is derived from the extension. */
  private parseMedia(userId: string, dto: ProductDto) {
    const pattern = new RegExp(`^products/${userId}/[0-9a-f-]{36}\\.(jpg|png|webp|mp4|webm|mov)$`);
    const seen = new Set<string>();
    return dto.media.map((item, index) => {
      const match = pattern.exec(item.key);
      if (!match || seen.has(item.key)) {
        throw new BadRequestException('Invalid media file');
      }
      seen.add(item.key);
      return { r2Key: item.key, type: MEDIA_EXTENSIONS[match[1]!]!, sort: index };
    });
  }

  private mapMediaConflict(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new BadRequestException('A media file is already used by another product');
    }
    return error;
  }

  private async sellerIdOf(userId: string): Promise<string> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) {
      throw new NotFoundException('Seller profile not found');
    }
    return profile.id;
  }

  /** Other sellers' products answer 404, so ids cannot be probed. */
  private async findOwned(userId: string, productId: string): Promise<ProductWithRelations> {
    const sellerId = await this.sellerIdOf(userId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId },
      include: productInclude,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  private toView(product: ProductWithRelations, locale: TranslationLocale): ProductView {
    const source = product.translations.find((t) => t.locale === product.sourceLocale);
    return {
      id: product.id,
      type: product.type,
      category: product.categorySlug,
      categoryName: categoryLabel(product.category, locale),
      // Shown as a badge in the seller's list: an admin switched the category off, so the listing is not
      // in the shop any more even though its status still says APPROVED.
      categoryActive: product.category.active && product.category.archivedAt === null,
      unit: product.unit as ProductView['unit'],
      priceIdr: product.priceIdr,
      moq: product.moq,
      stockQty: product.stockQty,
      leadTimeDays: product.leadTimeDays,
      sourceLocale: product.sourceLocale as ProductView['sourceLocale'],
      title: source?.title ?? '',
      description: source?.description ?? '',
      status: product.status,
      rejectionReason: product.rejectionReason,
      media: product.media.map((item) => ({
        key: item.r2Key,
        type: item.type,
        url: this.media.publicUrlFor(item.r2Key),
      })),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}
