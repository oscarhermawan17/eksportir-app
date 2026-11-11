import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '@balitrade/shared';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '@balitrade/shared';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from './media.service.js';

// Presigned URLs are computed locally (no network), so fake credentials are enough here.
const FAKE_R2: Partial<Env> = {
  R2_ACCOUNT_ID: 'acc123',
  R2_ACCESS_KEY_ID: 'AKIAFAKE',
  R2_SECRET_ACCESS_KEY: 'fake-secret',
  R2_PUBLIC_BUCKET: 'bt-public',
  R2_PRIVATE_BUCKET: 'bt-private',
  R2_PUBLIC_BASE_URL: 'https://pub-test.r2.dev/',
};

const seller: AuthUser = { id: 'user1', email: 's@x.com', name: 'S', phone: null, locale: 'en', roles: ['SELLER'] };
const buyer: AuthUser = { ...seller, id: 'user2', roles: ['BUYER'] };
const admin: AuthUser = { ...seller, id: 'user3', roles: ['ADMIN_OPS'] };

function makeService(options: { configured?: boolean; sellerStatus?: string | null } = {}) {
  const { configured = true, sellerStatus = 'APPROVED' } = options;
  // A stub rather than a real ConfigService: that one falls back to process.env, so the "not configured"
  // case would quietly pass or fail depending on whatever R2 variables happen to be set in the shell.
  const config = { get: (key: keyof Env) => (configured ? FAKE_R2[key] : undefined) } as unknown as ConfigService<Env, true>;
  const prisma = {
    sellerProfile: {
      findUnique: async () => (sellerStatus ? { status: sellerStatus } : null),
    },
  } as unknown as PrismaService;
  return new MediaService(config, prisma);
}

describe('MediaService', () => {
  it('signs a product photo upload into the public bucket', async () => {
    const result = await makeService().createUploadUrl(seller, {
      purpose: 'PRODUCT_MEDIA',
      contentType: 'image/jpeg',
      size: 1234,
    });

    expect(result.key).toMatch(/^products\/user1\/[0-9a-f-]{36}\.jpg$/);
    expect(result.publicUrl).toBe(`https://pub-test.r2.dev/${result.key}`);
    expect(result.headers).toEqual({ 'Content-Type': 'image/jpeg' });

    const url = new URL(result.uploadUrl);
    expect(url.hostname).toContain('bt-public');
    expect(url.pathname).toContain(result.key);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    // Type and size are part of the signature, so R2 rejects any other file.
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false);
  });

  it('puts private files in the private bucket without a public URL', async () => {
    const result = await makeService().createUploadUrl(buyer, {
      purpose: 'PRIVATE_FILE',
      contentType: 'image/png',
      size: 10,
    });
    expect(result.key).toMatch(/^private\/user2\/[0-9a-f-]{36}\.png$/);
    expect(result.publicUrl).toBeNull();
    expect(new URL(result.uploadUrl).hostname).toContain('bt-private');
  });

  it('enforces 10 MB for photos and 50 MB for videos', async () => {
    const service = makeService();
    const upload = (contentType: 'image/webp' | 'video/mp4', size: number) =>
      service.createUploadUrl(seller, { purpose: 'PRODUCT_MEDIA', contentType, size });

    await expect(upload('image/webp', MAX_IMAGE_BYTES + 1)).rejects.toThrow(/at most 10 MB/);
    await expect(upload('image/webp', MAX_IMAGE_BYTES)).resolves.toBeDefined();
    await expect(upload('video/mp4', MAX_VIDEO_BYTES + 1)).rejects.toThrow(/at most 50 MB/);
    await expect(upload('video/mp4', MAX_VIDEO_BYTES)).resolves.toBeDefined();
  });

  it.each([null, 'PENDING', 'REJECTED'])('refuses product media from a seller who is %s', async (status) => {
    await expect(
      makeService({ sellerStatus: status }).createUploadUrl(seller, {
        purpose: 'PRODUCT_MEDIA',
        contentType: 'image/jpeg',
        size: 1,
      }),
    ).rejects.toThrow(/approved sellers/);
  });

  it('answers 503 when R2 is not configured', async () => {
    const service = makeService({ configured: false });
    await expect(
      service.createUploadUrl(seller, { purpose: 'PRODUCT_MEDIA', contentType: 'image/jpeg', size: 1 }),
    ).rejects.toThrow(/not configured/);
    await expect(service.createDownloadUrl(seller, 'private/user1/x')).rejects.toThrow(/not configured/);
  });

  describe('private downloads', () => {
    const key = 'private/user2/123e4567-e89b-12d3-a456-426614174000.png';

    it('lets the uploader and admins open a private file', async () => {
      const service = makeService();
      for (const user of [buyer, admin]) {
        const result = await service.createDownloadUrl(user, key);
        const url = new URL(result.url);
        expect(url.hostname).toContain('bt-private');
        expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
      }
    });

    it('blocks other users and malformed or public keys', async () => {
      const service = makeService();
      await expect(service.createDownloadUrl(seller, key)).rejects.toThrow(/cannot open/);
      await expect(service.createDownloadUrl(buyer, 'private/user2/../user1/x.png')).rejects.toThrow(/Not a private/);
      await expect(
        service.createDownloadUrl(buyer, 'products/user2/123e4567-e89b-12d3-a456-426614174000.png'),
      ).rejects.toThrow(/Not a private/);
    });
  });
});
