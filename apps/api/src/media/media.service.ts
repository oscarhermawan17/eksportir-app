import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAdmin, maxBytesFor, mediaKindOf } from '@balitrade/shared';
import type {
  AuthUser,
  MediaContentType,
  PresignedDownload,
  PresignedUpload,
} from '@balitrade/shared';
import { randomUUID } from 'node:crypto';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { PresignUploadDto } from './dto/presign-upload.dto.js';

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** The extension comes from the (validated) content type, never from a file name sent by the client. */
const EXTENSIONS: Record<MediaContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const PRIVATE_KEY_PATTERN = /^private\/([A-Za-z0-9]+)\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/;

/** "100 MB" or "500 KB" — the image limit is under a megabyte, so always using MB read as "0.488 MB". */
function describeLimit(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${bytes / (1024 * 1024)} MB` : `${bytes / 1024} KB`;
}

interface R2Settings {
  client: S3Client;
  publicBucket: string;
  privateBucket: string;
  publicBaseUrl: string;
}

@Injectable()
export class MediaService {
  private readonly r2: R2Settings | null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    const accessKeyId = config.get('R2_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('R2_SECRET_ACCESS_KEY', { infer: true });
    const publicBucket = config.get('R2_PUBLIC_BUCKET', { infer: true });
    const privateBucket = config.get('R2_PRIVATE_BUCKET', { infer: true });
    const publicBaseUrl = config.get('R2_PUBLIC_BASE_URL', { infer: true });

    this.r2 =
      accountId && accessKeyId && secretAccessKey && publicBucket && privateBucket && publicBaseUrl
        ? {
            client: new S3Client({
              region: 'auto',
              endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
              credentials: { accessKeyId, secretAccessKey },
              // R2 rejects the extra checksum headers the SDK adds by default to presigned PUTs.
              requestChecksumCalculation: 'WHEN_REQUIRED',
              responseChecksumValidation: 'WHEN_REQUIRED',
            }),
            publicBucket,
            privateBucket,
            publicBaseUrl: publicBaseUrl.replace(/\/+$/, ''),
          }
        : null;
  }

  /**
   * Returns a short-lived URL the browser PUTs the file to directly (the API never handles the bytes).
   * Type and exact size are part of the signature, so the storage rejects anything else.
   */
  async createUploadUrl(user: AuthUser, dto: PresignUploadDto): Promise<PresignedUpload> {
    const r2 = this.requireR2();

    if (dto.size > maxBytesFor(dto.contentType)) {
      throw new BadRequestException(
        `${mediaKindOf(dto.contentType).toLowerCase()} files can be at most ${describeLimit(maxBytesFor(dto.contentType))}`,
      );
    }

    const isPublic = dto.purpose === 'PRODUCT_MEDIA';
    if (isPublic) {
      await this.assertApprovedSeller(user.id);
    }

    const folder = isPublic ? 'products' : 'private';
    const key = `${folder}/${user.id}/${randomUUID()}.${EXTENSIONS[dto.contentType]}`;

    const uploadUrl = await getSignedUrl(
      r2.client,
      new PutObjectCommand({
        Bucket: isPublic ? r2.publicBucket : r2.privateBucket,
        Key: key,
        ContentType: dto.contentType,
        ContentLength: dto.size,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) },
    );

    return {
      key,
      uploadUrl,
      headers: { 'Content-Type': dto.contentType },
      publicUrl: isPublic ? `${r2.publicBaseUrl}/${key}` : null,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  /**
   * Short-lived read link for a private file. For now only the uploader and admins may read;
   * later tasks (payment proofs, QC, chat) add order/conversation participants.
   */
  async createDownloadUrl(user: AuthUser, key: string): Promise<PresignedDownload> {
    const r2 = this.requireR2();

    const match = PRIVATE_KEY_PATTERN.exec(key);
    if (!match) {
      throw new BadRequestException('Not a private file key');
    }
    if (match[1] !== user.id && !isAdmin(user.roles)) {
      throw new ForbiddenException('You cannot open this file');
    }

    const url = await getSignedUrl(r2.client, new GetObjectCommand({ Bucket: r2.privateBucket, Key: key }), {
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    });
    return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
  }

  /** Permanent URL of a public object, or null when media storage is not configured. */
  publicUrlFor(key: string): string | null {
    return this.r2 ? `${this.r2.publicBaseUrl}/${key}` : null;
  }

  private requireR2(): R2Settings {
    if (!this.r2) {
      throw new ServiceUnavailableException('Media storage is not configured');
    }
    return this.r2;
  }

  private async assertApprovedSeller(userId: string): Promise<void> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId }, select: { status: true } });
    if (profile?.status !== 'APPROVED') {
      throw new ForbiddenException('Only approved sellers can upload product media');
    }
  }
}
