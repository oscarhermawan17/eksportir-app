/**
 * Editable page content (2026-11-26): the steps and the questions on /how-it-works, written by the OWNER in all three
 * languages at once on /admin/content. Keep in sync with the `ContentKind` enum in apps/api/prisma/schema.prisma.
 */
export const ContentKind = {
  HOW_IT_WORKS_STEP: 'HOW_IT_WORKS_STEP',
  FAQ: 'FAQ',
} as const;
export type ContentKind = (typeof ContentKind)[keyof typeof ContentKind];
export const CONTENT_KINDS = Object.values(ContentKind);

export const CONTENT_LIMITS = {
  titleMax: 120,
  bodyMax: 1000,
} as const;

/** One item as a visitor gets it: the title and body in the requested language (English when that one is empty). */
export interface ContentItemView {
  id: string;
  title: string;
  body: string;
}

/** One item in the OWNER's screen: every language, and whether it is shown. */
export interface AdminContentItemView {
  id: string;
  kind: ContentKind;
  titleEn: string;
  titleId: string;
  titleRu: string;
  bodyEn: string;
  bodyId: string;
  bodyRu: string;
  active: boolean;
  sortOrder: number;
  updatedAt: string;
}

/** Body of POST /api/admin/content. All three languages at once. */
export interface ContentItemInput {
  kind: ContentKind;
  titleEn: string;
  titleId: string;
  titleRu: string;
  bodyEn: string;
  bodyId: string;
  bodyRu: string;
}

/** Body of PATCH /api/admin/content/:id. Only the sent fields change; the kind is fixed. */
export type ContentItemUpdate = Partial<Omit<ContentItemInput, 'kind'>> & { active?: boolean };
