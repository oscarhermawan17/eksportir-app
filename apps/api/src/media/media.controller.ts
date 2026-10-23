import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { AuthUser, PresignedDownload, PresignedUpload } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PresignUploadDto } from './dto/presign-upload.dto.js';
import { MediaService } from './media.service.js';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign-upload')
  presignUpload(@CurrentUser() user: AuthUser, @Body() dto: PresignUploadDto): Promise<PresignedUpload> {
    return this.media.createUploadUrl(user, dto);
  }

  @Get('download-url')
  downloadUrl(@CurrentUser() user: AuthUser, @Query('key') key = ''): Promise<PresignedDownload> {
    return this.media.createDownloadUrl(user, key);
  }
}
