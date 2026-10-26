/** Keep ProductType / ProductStatus in sync with the enums in apps/api/prisma/schema.prisma. */
export const ProductType = {
  READY_STOCK: 'READY_STOCK',
  MADE_TO_ORDER: 'MADE_TO_ORDER',
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];
export const PRODUCT_TYPES = Object.values(ProductType);

export const ProductStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type ProductStatus = (typeof ProductStatus)[keyof typeof ProductStatus];

/**
 * Product categories. The final list (and the list of forbidden goods) is still an open business
 * decision (BRAINSTORMING.md); labels live in apps/web/messages under `Products.categories`.
 */
export const PRODUCT_CATEGORIES = [
  'COFFEE_TEA',
  'FOOD_SPICES',
  'HANDICRAFTS',
  'HOME_DECOR',
  'FASHION_APPAREL',
  'BAGS_ACCESSORIES',
  'BEAUTY_WELLNESS',
  'FURNITURE',
  'OTHER',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Selling units; labels under `Products.units`. */
export const PRODUCT_UNITS = ['PCS', 'KG', 'PACK', 'SET', 'BOX', 'METER', 'LITER'] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

/** Sellers write their listing in English or Indonesian (other languages are added by admin/translation). */
export const SOURCE_LOCALES = ['en', 'id'] as const;
export type SourceLocale = (typeof SOURCE_LOCALES)[number];

export const PRODUCT_LIMITS = {
  titleMin: 3,
  titleMax: 120,
  descriptionMax: 5000,
  /** Rupiah, whole numbers (fits a Postgres INTEGER). */
  priceIdrMax: 2_000_000_000,
  moqMax: 1_000_000,
  stockMax: 10_000_000,
  leadTimeDaysMax: 365,
  mediaMax: 10,
} as const;

export interface ProductMediaView {
  /** Storage key, as returned by the upload. */
  key: string;
  type: 'IMAGE' | 'VIDEO';
  /** Public URL; null when media storage is not configured. */
  url: string | null;
}

/** A product as the seller sees it (title/description in the language they wrote it in). */
export interface ProductView {
  id: string;
  type: ProductType;
  category: ProductCategory;
  unit: ProductUnit;
  priceIdr: number;
  moq: number;
  /** READY_STOCK only. */
  stockQty: number | null;
  /** MADE_TO_ORDER only. */
  leadTimeDays: number | null;
  sourceLocale: SourceLocale;
  title: string;
  description: string;
  status: ProductStatus;
  /** Why an admin rejected the listing (status REJECTED). */
  rejectionReason: string | null;
  media: ProductMediaView[];
  createdAt: string;
  updatedAt: string;
}

/** Languages a listing is shown in. */
export const TRANSLATION_LOCALES = ['en', 'id', 'ru'] as const;
export type TranslationLocale = (typeof TRANSLATION_LOCALES)[number];

export interface ProductTranslationView {
  title: string;
  description: string;
  /** Machine-translated and not reviewed yet (automatic translation is MVP 1.1). */
  isAuto: boolean;
}

/** A listing in the admin review screens: everything the seller sent plus all translations. */
export interface AdminProductView extends Omit<ProductView, 'title' | 'description'> {
  seller: { id: string; displayName: string; email: string };
  /** Missing key = not translated yet. */
  translations: Partial<Record<TranslationLocale, ProductTranslationView>>;
}

/** Body of PUT /api/admin/products/:id/translations. Only the sent languages are changed. */
export type ProductTranslationsInput = Partial<
  Record<TranslationLocale, { title: string; description: string }>
>;

/** A product as buyers see it in one language (public catalog). */
export interface CatalogProduct {
  id: string;
  type: ProductType;
  category: ProductCategory;
  unit: ProductUnit;
  priceIdr: number;
  moq: number;
  stockQty: number | null;
  leadTimeDays: number | null;
  title: string;
  description: string;
  /** True when the text shown is machine-translated (label "Auto-translated"). */
  isAuto: boolean;
  /** Language the text is actually in (falls back to the seller's language if not translated). */
  textLocale: TranslationLocale;
  media: ProductMediaView[];
  seller: { id: string; displayName: string; location: string | null };
}

/** Body of POST /api/seller/products and PUT /api/seller/products/:id (full replacement). */
export interface ProductInput {
  type: ProductType;
  category: ProductCategory;
  unit: ProductUnit;
  priceIdr: number;
  moq: number;
  stockQty?: number;
  leadTimeDays?: number;
  sourceLocale: SourceLocale;
  title: string;
  description: string;
  /** Uploaded files in display order; the first image is the cover. */
  media: { key: string }[];
}
