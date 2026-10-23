import { MAX_VIDEO_BYTES, MEDIA_CONTENT_TYPES, MEDIA_PURPOSES } from '@balitrade/shared';
import type { MediaContentType, MediaPurpose } from '@balitrade/shared';
import { IsIn, IsInt, Max, Min } from 'class-validator';

export class PresignUploadDto {
  @IsIn(MEDIA_PURPOSES)
  purpose: MediaPurpose;

  @IsIn(MEDIA_CONTENT_TYPES)
  contentType: MediaContentType;

  /** The per-type limit (10 MB photo / 50 MB video) is checked in MediaService. */
  @IsInt()
  @Min(1)
  @Max(MAX_VIDEO_BYTES)
  size: number;
}
