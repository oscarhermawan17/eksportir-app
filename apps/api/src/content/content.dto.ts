import { CONTENT_KINDS, CONTENT_LIMITS, TRANSLATION_LOCALES } from '@balitrade/shared';
import type { ContentKind, TranslationLocale } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** GET /api/content: which list, in which language. */
export class ContentQueryDto {
  @IsIn(CONTENT_KINDS)
  kind!: ContentKind;

  @IsOptional()
  @IsIn(TRANSLATION_LOCALES)
  locale?: TranslationLocale;
}

/** GET /api/admin/content: which list. */
export class AdminContentQueryDto {
  @IsIn(CONTENT_KINDS)
  kind!: ContentKind;
}

/** All three languages at once (owner's request, 2026-11-26): a title and a body each, none empty. */
export class CreateContentDto {
  @IsIn(CONTENT_KINDS)
  kind!: ContentKind;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleEn!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleRu!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyEn!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyId!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyRu!: string;
}

/** Only the fields sent change. The kind is fixed: a step does not turn into a question. */
export class UpdateContentDto {
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleEn?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.titleMax) titleRu?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyEn?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyId?: string;
  @IsOptional() @Transform(trim) @IsString() @MinLength(1) @MaxLength(CONTENT_LIMITS.bodyMax) bodyRu?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class MoveContentDto {
  @IsIn(['up', 'down'])
  direction!: 'up' | 'down';
}
