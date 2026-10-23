import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { hashPassword } from '../src/common/password.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

// Fake R2 settings: presigned URLs are computed locally, nothing is sent to Cloudflare.
Object.assign(process.env, {
  R2_ACCOUNT_ID: 'acc123',
  R2_ACCESS_KEY_ID: 'AKIAFAKE',
  R2_SECRET_ACCESS_KEY: 'fake-secret',
  R2_PUBLIC_BUCKET: 'bt-public',
  R2_PRIVATE_BUCKET: 'bt-private',
  R2_PUBLIC_BASE_URL: 'https://pub-test.r2.dev',
});

// Test users use the prefix "media-e2e-" so other spec files' cleanup (parallel) does not delete them.
// Requires the database from docker-compose.yml (`pnpm db:up`) and apps/api/.env.
describe('Media (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    buyer: `media-e2e-buyer-${stamp}@example.com`,
    pending: `media-e2e-pending-${stamp}@example.com`,
    seller: `media-e2e-seller-${stamp}@example.com`,
  };
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) {
      return cached;
    }
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };

  beforeAll(async () => {
    // Imported after the env above is set, because the config is read when AppModule loads.
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    await prisma.user.create({ data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] } });
    await prisma.user.create({
      data: {
        email: emails.pending,
        passwordHash,
        name: 'Pending',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Pending Shop', qcZoneId: zone.id } },
      },
    });
    await prisma.user.create({
      data: {
        email: emails.seller,
        passwordHash,
        name: 'Seller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Approved Shop', qcZoneId: zone.id, status: 'APPROVED' } },
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'media-e2e-' } } });
    await app.close();
  });

  const photo = { purpose: 'PRODUCT_MEDIA', contentType: 'image/jpeg', size: 2048 };

  it('requires login', async () => {
    await request(app.getHttpServer()).post('/api/media/presign-upload').send(photo).expect(401);
    await request(app.getHttpServer()).get('/api/media/download-url?key=x').expect(401);
  });

  it('gives an approved seller a signed upload URL for product media', async () => {
    const seller = await agentFor(emails.seller);
    const res = await seller.post('/api/media/presign-upload').send(photo).expect(201);
    expect(res.body.key).toMatch(/^products\/[A-Za-z0-9]+\/[0-9a-f-]{36}\.jpg$/);
    expect(res.body.publicUrl).toBe(`https://pub-test.r2.dev/${res.body.key}`);
    expect(res.body.uploadUrl).toContain('X-Amz-Signature=');
    expect(res.body.headers).toEqual({ 'Content-Type': 'image/jpeg' });
  });

  it('refuses product media from buyers and sellers who are not approved (403)', async () => {
    await (await agentFor(emails.buyer)).post('/api/media/presign-upload').send(photo).expect(403);
    await (await agentFor(emails.pending)).post('/api/media/presign-upload').send(photo).expect(403);
  });

  it('rejects bad type, size and purpose (400)', async () => {
    const seller = await agentFor(emails.seller);
    const post = (body: object) => seller.post('/api/media/presign-upload').send(body);
    await post({ ...photo, contentType: 'application/pdf' }).expect(400);
    await post({ ...photo, contentType: 'image/svg+xml' }).expect(400);
    await post({ ...photo, size: 0 }).expect(400);
    await post({ ...photo, size: 11 * 1024 * 1024 }).expect(400); // photo > 10 MB
    await post({ ...photo, contentType: 'video/mp4', size: 51 * 1024 * 1024 }).expect(400); // video > 50 MB
    await post({ ...photo, purpose: 'ADMIN_ONLY' }).expect(400);
    await post({ ...photo, extra: 'x' }).expect(400);
    await post({ ...photo, contentType: 'video/mp4', size: 40 * 1024 * 1024 }).expect(201);
  });

  it('private files: only the uploader (or an admin) gets a download URL', async () => {
    const buyer = await agentFor(emails.buyer);
    const upload = await buyer
      .post('/api/media/presign-upload')
      .send({ purpose: 'PRIVATE_FILE', contentType: 'image/png', size: 500 })
      .expect(201);
    expect(upload.body.publicUrl).toBeNull();
    expect(upload.body.key).toMatch(/^private\//);

    const download = await buyer.get(`/api/media/download-url?key=${encodeURIComponent(upload.body.key)}`).expect(200);
    expect(download.body.url).toContain('bt-private');
    expect(download.body.expiresInSeconds).toBe(300);

    const other = await agentFor(emails.seller);
    await other.get(`/api/media/download-url?key=${encodeURIComponent(upload.body.key)}`).expect(403);
    await buyer.get('/api/media/download-url?key=products/x/y.jpg').expect(400);
    await buyer.get('/api/media/download-url').expect(400);
  });
});
