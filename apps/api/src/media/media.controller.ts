import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser, PresignedDownload, PresignedUpload } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PresignUploadDto } from './dto/presign-upload.dto.js';
import { MediaService } from './media.service.js';
import { UploadThrottleGuard } from './upload-throttle.guard.js';

const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS;

/**
 * Presigning is the one endpoint where a single signed-in account could run up a storage bill: the API
 * never sees the bytes, so nothing else stands between an approved seller (or a stolen session) and an
 * unbounded number of objects in R2. The signature already pins the content type and the exact byte
 * count, so a URL cannot be turned into a bigger or different file — but it says nothing about **how
 * many** URLs are asked for, which is what these two limits cover.
 *
 * Both are counted per user (UploadThrottleGuard), not per IP.
 */
@Controller('media')
@UseGuards(JwtAuthGuard, UploadThrottleGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * A listing takes at most 10 files, so 40 a minute covers re-tries and a fast connection while still
   * refusing a script. 400 a day is far above a working day of real listing and far below a bill worth
   * noticing: at the 100 MB video ceiling it caps one account at ~40 GB, and at the 200 KB image limit
   * at ~80 MB.
   */
  @Post('presign-upload')
  @Throttle({
    default: { limit: 40, ttl: ONE_MINUTE_MS },
    daily: { limit: 400, ttl: ONE_DAY_MS },
  })
  presignUpload(@CurrentUser() user: AuthUser, @Body() dto: PresignUploadDto): Promise<PresignedUpload> {
    return this.media.createUploadUrl(user, dto);
  }

  /** Reading costs nothing to store, so this only needs a limit loose enough to stop a scraping loop. */
  @Get('download-url')
  @Throttle({
    default: { limit: 60, ttl: ONE_MINUTE_MS },
    daily: { limit: 2000, ttl: ONE_DAY_MS },
  })
  downloadUrl(@CurrentUser() user: AuthUser, @Query('key') key = ''): Promise<PresignedDownload> {
    return this.media.createDownloadUrl(user, key);
  }
}
