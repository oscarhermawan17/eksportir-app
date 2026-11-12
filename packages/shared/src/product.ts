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
 * A category slug, e.g. `COFFEE_TEA`. Since T26 categories are rows in `product_categories`, managed by
 * the OWNER at /admin/categories, so this is deliberately a plain string: the API validates it against
 * the database, never against a constant. Labels come from the same row, not from the message files.
 */
export type ProductCategorySlug = string;

export const CATEGORY_LIMITS = {
  slugMax: 40,
  nameMin: 2,
  nameMax: 60,
  sortOrderMax: 10_000,
} as const;

/**
 * Slugs are SCREAMING_SNAKE_CASE because products store them and they end up in URLs and filters.
 * They are never edited once a product uses one; admins change the labels instead.
 */
export const CATEGORY_SLUG_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** One category as buyers and sellers see it: the slug plus its label in the requested language. */
export interface ProductCategoryView {
  slug: ProductCategorySlug;
  name: string;
}

/** One category in the OWNER's screen: every label, both switches, and whether it can be deleted. */
export interface AdminProductCategoryView {
  id: string;
  slug: ProductCategorySlug;
  nameEn: string;
  nameId: string;
  nameRu: string;
  /** Unchecked: its products disappear from the shop without their status changing. */
  active: boolean;
  /** Soft-deleted (archived): same effect, and hidden from the default admin list. */
  archivedAt: string | null;
  sortOrder: number;
  /** A category with products can only be archived — the foreign key refuses a real delete. */
  productCount: number;
}

/** Body of POST /api/admin/categories. */
export interface ProductCategoryCreateInput {
  slug: ProductCategorySlug;
  nameEn: string;
  nameId: string;
  nameRu: string;
  sortOrder?: number;
}

/** Body of PATCH /api/admin/categories/:id. Only the sent fields change; the slug is never editable. */
export interface ProductCategoryUpdateInput {
  nameEn?: string;
  nameId?: string;
  nameRu?: string;
  active?: boolean;
  sortOrder?: number;
  /** True archives (soft delete), false restores. */
  archived?: boolean;
}

/**
 * What `pnpm db:seed` puts in an empty database — the nine categories that used to be a constant here,
 * with the labels that used to live in apps/web/messages under `Products.categories`. Nothing validates
 * against this list: it is seed data, and the OWNER owns it from then on.
 */
export const SEED_PRODUCT_CATEGORIES: {
  slug: ProductCategorySlug;
  nameEn: string;
  nameId: string;
  nameRu: string;
}[] = [
  { slug: 'COFFEE_TEA', nameEn: 'Coffee & tea', nameId: 'Kopi & teh', nameRu: 'Кофе и чай' },
  { slug: 'FOOD_SPICES', nameEn: 'Food & spices', nameId: 'Makanan & rempah', nameRu: 'Еда и специи' },
  { slug: 'HANDICRAFTS', nameEn: 'Handicrafts', nameId: 'Kerajinan tangan', nameRu: 'Ремесленные изделия' },
  { slug: 'HOME_DECOR', nameEn: 'Home decor', nameId: 'Dekorasi rumah', nameRu: 'Декор для дома' },
  { slug: 'FASHION_APPAREL', nameEn: 'Fashion & apparel', nameId: 'Fashion & pakaian', nameRu: 'Одежда и мода' },
  { slug: 'BAGS_ACCESSORIES', nameEn: 'Bags & accessories', nameId: 'Tas & aksesori', nameRu: 'Сумки и аксессуары' },
  { slug: 'BEAUTY_WELLNESS', nameEn: 'Beauty & wellness', nameId: 'Kecantikan & kesehatan', nameRu: 'Красота и здоровье' },
  { slug: 'FURNITURE', nameEn: 'Furniture', nameId: 'Furnitur', nameRu: 'Мебель' },
  { slug: 'OTHER', nameEn: 'Other', nameId: 'Lainnya', nameRu: 'Другое' },
];

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
  category: ProductCategorySlug;
  /** Label of that category in the viewer's language; the category may be inactive (see categoryActive). */
  categoryName: string;
  /** False when an admin unchecked the category: the listing is not visible in the shop any more. */
  categoryActive: boolean;
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
  category: ProductCategorySlug;
  /** Label of that category in the language the catalog was asked for. */
  categoryName: string;
  unit: ProductUnit;
  priceIdr: number;
  /** Price per unit in USD ("6.80"): priceIdr ÷ current rate, rounded to cents. Null until an exchange rate is set. */
  priceUsd: string | null;
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
  /** Must be an active, non-archived category (the API checks the database, not a constant). */
  category: ProductCategorySlug;
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

/** Public seller page (no login): who the seller is and what they sell. No contact details, no ratings yet (MVP 1.1). */
export interface PublicSellerProfile {
  id: string;
  displayName: string;
  about: string | null;
  /** Bali regency/city. */
  location: string | null;
  /** ISO date the seller was approved or joined. */
  memberSince: string;
  products: CatalogProduct[];
}

/** Limits of the public catalog query (GET /api/products). */
export const CATALOG_LIMITS = {
  searchMax: 100,
  /** Products returned at most per request (pagination comes when the catalog grows). */
  pageSize: 48,
} as const;
