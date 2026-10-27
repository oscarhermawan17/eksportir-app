import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "products-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Seller products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    seller: `products-e2e-seller-${stamp}@example.com`,
    other: `products-e2e-other-${stamp}@example.com`,
    pending: `products-e2e-pending-${stamp}@example.com`,
    buyer: `products-e2e-buyer-${stamp}@example.com`,
  };
  const ids: Record<string, string> = {};
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) return cached;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };

  const mediaKey = (owner: string, ext = 'jpg') => `products/${owner}/123e4567-e89b-12d3-a456-${String(Math.floor(Math.random() * 1e12)).padStart(12, '0')}.${ext}`;

  const readyStock = (overrides: object = {}) => ({
    type: 'READY_STOCK',
    category: 'HANDICRAFTS',
    unit: 'PCS',
    priceIdr: 150000,
    moq: 10,
    stockQty: 200,
    sourceLocale: 'en',
    title: 'Handwoven rattan bag',
    description: 'Made by hand in Gianyar.',
    media: [],
    ...overrides,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    const makeSeller = async (email: string, status: 'APPROVED' | 'PENDING') => {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: email.split('@')[0]!,
          roles: [Role.SELLER],
          sellerProfile: { create: { displayName: `Shop ${email}`, qcZoneId: zone.id, status } },
        },
      });
      ids[email] = user.id;
    };
    await makeSeller(emails.seller, 'APPROVED');
    await makeSeller(emails.other, 'APPROVED');
    await makeSeller(emails.pending, 'PENDING');
    ids[emails.buyer] = (
      await prisma.user.create({ data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] } })
    ).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'products-e2e-' } } });
    await app.close();
  });

  it('only approved sellers can use the product endpoints (401/403)', async () => {
    await request(app.getHttpServer()).get('/api/seller/products').expect(401);
    await (await agentFor(emails.buyer)).get('/api/seller/products').expect(403);
    await (await agentFor(emails.pending)).get('/api/seller/products').expect(403);
    await (await agentFor(emails.pending)).post('/api/seller/products').send(readyStock()).expect(403);
  });

  let productId = '';

  it('creates a DRAFT product with the right fields for its type', async () => {
    const seller = await agentFor(emails.seller);
    const key = mediaKey(ids[emails.seller]!);
    const res = await seller.post('/api/seller/products').send(readyStock({ media: [{ key }] })).expect(201);
    productId = res.body.id;
    expect(res.body).toMatchObject({
      status: 'DRAFT',
      type: 'READY_STOCK',
      priceIdr: 150000,
      moq: 10,
      stockQty: 200,
      leadTimeDays: null,
      title: 'Handwoven rattan bag',
      sourceLocale: 'en',
    });
    // `url` depends on whether R2 is configured in apps/api/.env (null when it is not), so it is not asserted here.
    expect(res.body.media).toMatchObject([{ key, type: 'IMAGE' }]);

    const made = await seller
      .post('/api/seller/products')
      .send(readyStock({ type: 'MADE_TO_ORDER', leadTimeDays: 14, stockQty: 5, title: 'Custom batik hat' }))
      .expect(201);
    expect(made.body).toMatchObject({ type: 'MADE_TO_ORDER', leadTimeDays: 14, stockQty: null });
  });

  it('validates input (400)', async () => {
    const seller = await agentFor(emails.seller);
    const post = (body: object) => seller.post('/api/seller/products').send(body);
    await post(readyStock({ priceIdr: 0 })).expect(400);
    await post(readyStock({ priceIdr: 12.5 })).expect(400);
    await post(readyStock({ moq: 0 })).expect(400);
    await post(readyStock({ category: 'GUNS' })).expect(400);
    await post(readyStock({ unit: 'TON' })).expect(400);
    await post(readyStock({ sourceLocale: 'ru' })).expect(400);
    await post(readyStock({ title: 'ab' })).expect(400);
    await post(readyStock({ stockQty: undefined })).expect(400); // ready stock needs stock
    await post(readyStock({ type: 'MADE_TO_ORDER', leadTimeDays: undefined })).expect(400); // made to order needs lead time
    await post(readyStock({ status: 'APPROVED' })).expect(400); // status is never accepted from the client
    await post(readyStock({ media: Array.from({ length: 11 }, () => ({ key: 'x' })) })).expect(400);
  });

  it('only accepts media this seller uploaded for products', async () => {
    const seller = await agentFor(emails.seller);
    const post = (media: { key: string }[]) => seller.post('/api/seller/products').send(readyStock({ media }));
    await post([{ key: mediaKey(ids[emails.other]!) }]).expect(400); // someone else's file
    await post([{ key: `private/${ids[emails.seller]}/123e4567-e89b-12d3-a456-426614174000.jpg` }]).expect(400);
    await post([{ key: `products/${ids[emails.seller]}/../x.jpg` }]).expect(400);
    const dup = mediaKey(ids[emails.seller]!);
    await post([{ key: dup }, { key: dup }]).expect(400);
  });

  it('lists and reads only own products; other sellers get 404', async () => {
    const seller = await agentFor(emails.seller);
    const list = await seller.get('/api/seller/products').expect(200);
    expect(list.body).toHaveLength(2);
    await seller.get(`/api/seller/products/${productId}`).expect(200);

    const other = await agentFor(emails.other);
    expect((await other.get('/api/seller/products').expect(200)).body).toEqual([]);
    await other.get(`/api/seller/products/${productId}`).expect(404);
    await other.put(`/api/seller/products/${productId}`).send(readyStock()).expect(404);
    await other.post(`/api/seller/products/${productId}/archive`).expect(404);
  });

  it('edits a product (full replacement incl. media order)', async () => {
    const seller = await agentFor(emails.seller);
    const a = mediaKey(ids[emails.seller]!);
    const b = mediaKey(ids[emails.seller]!, 'mp4');
    const res = await seller
      .put(`/api/seller/products/${productId}`)
      .send(readyStock({ title: 'Rattan bag (new)', sourceLocale: 'id', description: 'Dibuat tangan.', priceIdr: 175000, media: [{ key: b }, { key: a }] }))
      .expect(200);
    expect(res.body).toMatchObject({ title: 'Rattan bag (new)', sourceLocale: 'id', description: 'Dibuat tangan.', priceIdr: 175000, status: 'DRAFT' });
    expect(res.body.media.map((m: { key: string; type: string }) => [m.key, m.type])).toEqual([
      [b, 'VIDEO'],
      [a, 'IMAGE'],
    ]);
  });

  it('submit needs at least one photo, then goes to PENDING_REVIEW', async () => {
    const seller = await agentFor(emails.seller);
    const noPhoto = await seller.post('/api/seller/products').send(readyStock({ title: 'No photo yet' })).expect(201);
    await seller.post(`/api/seller/products/${noPhoto.body.id}/submit`).expect(400);

    const videoOnly = await seller
      .post('/api/seller/products')
      .send(readyStock({ title: 'Video only', media: [{ key: mediaKey(ids[emails.seller]!, 'mp4') }] }))
      .expect(201);
    await seller.post(`/api/seller/products/${videoOnly.body.id}/submit`).expect(400);

    const submitted = await seller.post(`/api/seller/products/${productId}/submit`).expect(201);
    expect(submitted.body.status).toBe('PENDING_REVIEW');
    await seller.post(`/api/seller/products/${productId}/submit`).expect(409); // already pending
  });

  it('editing an APPROVED product sends it back to review', async () => {
    const seller = await agentFor(emails.seller);
    await prisma.product.update({ where: { id: productId }, data: { status: 'APPROVED' } });
    const res = await seller.put(`/api/seller/products/${productId}`).send(readyStock({ media: [{ key: mediaKey(ids[emails.seller]!) }] })).expect(200);
    expect(res.body.status).toBe('PENDING_REVIEW');
  });

  it('archives and restores; archived products cannot be edited or submitted', async () => {
    const seller = await agentFor(emails.seller);
    const archived = await seller.post(`/api/seller/products/${productId}/archive`).expect(201);
    expect(archived.body.status).toBe('ARCHIVED');
    await seller.post(`/api/seller/products/${productId}/archive`).expect(409);
    await seller.put(`/api/seller/products/${productId}`).send(readyStock()).expect(409);
    await seller.post(`/api/seller/products/${productId}/submit`).expect(409);

    const restored = await seller.post(`/api/seller/products/${productId}/restore`).expect(201);
    expect(restored.body.status).toBe('DRAFT');
    await seller.post(`/api/seller/products/${productId}/restore`).expect(409);
  });
});
