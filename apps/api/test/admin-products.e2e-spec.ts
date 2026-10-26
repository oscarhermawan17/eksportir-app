import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "adminprod-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Admin product review + public catalog (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    ops: `adminprod-e2e-ops-${stamp}@example.com`,
    finance: `adminprod-e2e-fin-${stamp}@example.com`,
    buyer: `adminprod-e2e-buyer-${stamp}@example.com`,
    seller: `adminprod-e2e-seller-${stamp}@example.com`,
    pendingSeller: `adminprod-e2e-pseller-${stamp}@example.com`,
  };
  const agents = new Map<string, ReturnType<typeof request.agent>>();
  const productIds: Record<string, string> = {};

  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) return cached;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };

  const makeProduct = async (sellerProfileId: string, name: string, status: 'DRAFT' | 'PENDING_REVIEW' | 'REJECTED' | 'ARCHIVED') => {
    const product = await prisma.product.create({
      data: {
        sellerId: sellerProfileId,
        type: 'READY_STOCK',
        category: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 100000,
        moq: 5,
        stockQty: 50,
        sourceLocale: 'en',
        status,
        translations: { create: { locale: 'en', title: `${name} (en)`, description: `${name} description` } },
        media: { create: [] },
      },
    });
    productIds[name] = product.id;
    return product.id;
  };

  let sellerProfileId = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    await prisma.user.create({ data: { email: emails.ops, passwordHash, name: 'Ops', roles: [Role.ADMIN_OPS] } });
    await prisma.user.create({ data: { email: emails.finance, passwordHash, name: 'Fin', roles: [Role.ADMIN_FINANCE] } });
    await prisma.user.create({ data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] } });
    const seller = await prisma.user.create({
      data: {
        email: emails.seller,
        passwordHash,
        name: 'Seller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Review Shop', qcZoneId: zone.id, status: 'APPROVED' } },
      },
      include: { sellerProfile: true },
    });
    sellerProfileId = seller.sellerProfile!.id;
    const pending = await prisma.user.create({
      data: {
        email: emails.pendingSeller,
        passwordHash,
        name: 'PSeller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Unapproved Shop', qcZoneId: zone.id, status: 'PENDING' } },
      },
      include: { sellerProfile: true },
    });

    await makeProduct(sellerProfileId, 'ToApprove', 'PENDING_REVIEW');
    await makeProduct(sellerProfileId, 'ToReject', 'PENDING_REVIEW');
    await makeProduct(sellerProfileId, 'Drafty', 'DRAFT');
    await makeProduct(sellerProfileId, 'Archived', 'ARCHIVED');
    await makeProduct(pending.sellerProfile!.id, 'OfPendingSeller', 'PENDING_REVIEW');
    await prisma.product.update({ where: { id: productIds['OfPendingSeller']! }, data: { status: 'APPROVED' } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'adminprod-e2e-' } } });
    await app.close();
  });

  const catalogIds = async (locale?: string) => {
    const res = await request(app.getHttpServer()).get(`/api/products${locale ? `?locale=${locale}` : ''}`).expect(200);
    return res.body as { id: string; title: string; isAuto: boolean; textLocale: string; seller: { displayName: string; location: string | null } }[];
  };

  it('is limited to OPS/OWNER admins (401/403)', async () => {
    await request(app.getHttpServer()).get('/api/admin/products').expect(401);
    await (await agentFor(emails.buyer)).get('/api/admin/products').expect(403);
    await (await agentFor(emails.finance)).get('/api/admin/products').expect(403);
    await (await agentFor(emails.seller)).get('/api/admin/products').expect(403);
  });

  it('DoD: nothing is in the public catalog before approval', async () => {
    const ids = (await catalogIds()).map((p) => p.id);
    for (const name of ['ToApprove', 'ToReject', 'Drafty', 'Archived']) {
      expect(ids).not.toContain(productIds[name]);
    }
    // An APPROVED product of a seller who is not approved is also hidden.
    expect(ids).not.toContain(productIds['OfPendingSeller']);
  });

  it('lists the review queue without drafts and filters by status', async () => {
    const ops = await agentFor(emails.ops);
    const all = (await ops.get('/api/admin/products').expect(200)).body as { id: string; status: string }[];
    const ids = all.map((p) => p.id);
    expect(ids).toContain(productIds['ToApprove']);
    expect(ids).not.toContain(productIds['Drafty']);

    const pending = (await ops.get('/api/admin/products?status=PENDING_REVIEW').expect(200)).body as { status: string }[];
    expect(pending.every((p) => p.status === 'PENDING_REVIEW')).toBe(true);
    await ops.get('/api/admin/products?status=BOGUS').expect(400);

    const detail = await ops.get(`/api/admin/products/${productIds['ToApprove']}`).expect(200);
    expect(detail.body).toMatchObject({
      status: 'PENDING_REVIEW',
      seller: { displayName: 'Review Shop', email: emails.seller },
      translations: { en: { title: 'ToApprove (en)', isAuto: false } },
    });
    await ops.get('/api/admin/products/unknown-id').expect(404);
  });

  it('cannot approve until en, id and ru texts exist (400)', async () => {
    const ops = await agentFor(emails.ops);
    const res = await ops.post(`/api/admin/products/${productIds['ToApprove']}/approve`).expect(400);
    expect(res.body.message).toMatch(/id, ru/);
  });

  it('admin writes translations manually; validation applies', async () => {
    const ops = await agentFor(emails.ops);
    const url = `/api/admin/products/${productIds['ToApprove']}/translations`;
    await ops.put(url).send({}).expect(400);
    await ops.put(url).send({ ru: { title: 'ab', description: 'x' } }).expect(400); // title too short
    await ops.put(url).send({ de: { title: 'Titel', description: 'Text' } }).expect(400); // unknown language

    const res = await ops
      .put(url)
      .send({
        id: { title: 'Tas rotan anyaman', description: 'Dibuat tangan di Gianyar.' },
        ru: { title: 'Плетёная сумка из ротанга', description: 'Сделано вручную в Гианьяре.' },
        en: { title: 'Handwoven rattan bag', description: 'Made by hand in Gianyar.' },
      })
      .expect(200);
    expect(res.body.translations.ru).toEqual({
      title: 'Плетёная сумка из ротанга',
      description: 'Сделано вручную в Гианьяре.',
      isAuto: false,
    });
    expect(res.body.translations.en.title).toBe('Handwoven rattan bag');
  });

  it('translations cannot be edited on drafts or archived products (409)', async () => {
    const ops = await agentFor(emails.ops);
    const body = { en: { title: 'Some title', description: 'Some text' } };
    await ops.put(`/api/admin/products/${productIds['Drafty']}/translations`).send(body).expect(409);
    await ops.put(`/api/admin/products/${productIds['Archived']}/translations`).send(body).expect(409);
  });

  it('DoD: after approval the product appears in the public catalog in each language', async () => {
    const ops = await agentFor(emails.ops);
    const approved = await ops.post(`/api/admin/products/${productIds['ToApprove']}/approve`).expect(201);
    expect(approved.body).toMatchObject({ status: 'APPROVED', rejectionReason: null });
    await ops.post(`/api/admin/products/${productIds['ToApprove']}/approve`).expect(409);

    const find = async (locale?: string) => (await catalogIds(locale)).find((p) => p.id === productIds['ToApprove']);
    expect(await find('ru')).toMatchObject({
      title: 'Плетёная сумка из ротанга',
      textLocale: 'ru',
      isAuto: false,
      seller: { displayName: 'Review Shop' },
    });
    expect((await find('id'))?.title).toBe('Tas rotan anyaman');
    expect((await find())?.title).toBe('Handwoven rattan bag'); // default language is English
    expect((await find('en'))?.seller.location).toEqual(expect.any(String));
    await request(app.getHttpServer()).get('/api/products?locale=xx').expect(400);

    // Everything else is still hidden.
    const ids = (await catalogIds()).map((p) => p.id);
    expect(ids).not.toContain(productIds['ToReject']);
    expect(ids).not.toContain(productIds['OfPendingSeller']);
  });

  it('reject needs a reason; the seller sees it, resubmits and the reason is cleared', async () => {
    const ops = await agentFor(emails.ops);
    const id = productIds['ToReject']!;
    await ops.post(`/api/admin/products/${id}/reject`).send({}).expect(400);
    const rejected = await ops.post(`/api/admin/products/${id}/reject`).send({ reason: 'Photos are missing.' }).expect(201);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Photos are missing.' });
    await ops.post(`/api/admin/products/${id}/reject`).send({ reason: 'Again please' }).expect(409);
    await ops.post(`/api/admin/products/${id}/approve`).expect(409);

    const seller = await agentFor(emails.seller);
    expect((await seller.get(`/api/seller/products/${id}`).expect(200)).body).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Photos are missing.',
    });
    expect((await catalogIds()).map((p) => p.id)).not.toContain(id);

    await prisma.productMedia.create({
      data: { productId: id, r2Key: `products/x/123e4567-e89b-12d3-a456-${String(stamp).slice(-12).padStart(12, '0')}.jpg`, type: 'IMAGE', sort: 0 },
    });
    const resubmitted = await seller.post(`/api/seller/products/${id}/submit`).expect(201);
    expect(resubmitted.body).toMatchObject({ status: 'PENDING_REVIEW', rejectionReason: null });
  });
});
