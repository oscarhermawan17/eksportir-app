import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "fx-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The rates these tests create are deleted again in afterAll, so the rate in force afterwards is the one from before.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Exchange rate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    owner: `fx-e2e-owner-${stamp}@example.com`,
    ops: `fx-e2e-ops-${stamp}@example.com`,
    finance: `fx-e2e-fin-${stamp}@example.com`,
    buyer: `fx-e2e-buyer-${stamp}@example.com`,
    seller: `fx-e2e-seller-${stamp}@example.com`,
  };
  const agents = new Map<string, ReturnType<typeof request.agent>>();
  let productId = '';

  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) return cached;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };

  const setRate = async (rate: number) => (await agentFor(emails.owner)).post('/api/admin/exchange-rates').send({ rate });

  const catalogPriceUsd = async () => {
    const res = await request(app.getHttpServer()).get('/api/products?locale=en').expect(200);
    const product = (res.body as { id: string; priceUsd: string | null }[]).find((p) => p.id === productId);
    return product?.priceUsd;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    await prisma.user.create({ data: { email: emails.owner, passwordHash, name: 'Owner', roles: [Role.ADMIN_OWNER] } });
    await prisma.user.create({ data: { email: emails.ops, passwordHash, name: 'Ops', roles: [Role.ADMIN_OPS] } });
    await prisma.user.create({ data: { email: emails.finance, passwordHash, name: 'Fin', roles: [Role.ADMIN_FINANCE] } });
    await prisma.user.create({ data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] } });
    const seller = await prisma.user.create({
      data: {
        email: emails.seller,
        passwordHash,
        name: 'Seller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'FX Shop', qcZoneId: zone.id, status: 'APPROVED' } },
      },
      include: { sellerProfile: true },
    });
    const product = await prisma.product.create({
      data: {
        sellerId: seller.sellerProfile!.id,
        type: 'READY_STOCK',
        categorySlug: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 160000,
        moq: 1,
        stockQty: 10,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: { create: { locale: 'en', title: 'FX product', description: 'FX product description' } },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Rates reference the user who set them (no cascade), so remove them first.
    await prisma.exchangeRate.deleteMany({ where: { setBy: { email: { startsWith: 'fx-e2e-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'fx-e2e-' } } });
    await app.close();
  });

  it('only the owner can read the history or set a rate (401/403)', async () => {
    await request(app.getHttpServer()).get('/api/admin/exchange-rates').expect(401);
    await request(app.getHttpServer()).post('/api/admin/exchange-rates').send({ rate: 16000 }).expect(401);
    for (const email of [emails.ops, emails.finance, emails.buyer, emails.seller]) {
      const agent = await agentFor(email);
      await agent.get('/api/admin/exchange-rates').expect(403);
      await agent.post('/api/admin/exchange-rates').send({ rate: 16000 }).expect(403);
    }
  });

  it('rejects rates that are missing, not numbers, out of range or too precise', async () => {
    const owner = await agentFor(emails.owner);
    const badBodies = [
      {},
      { rate: '16000' },
      { rate: 'abc' },
      { rate: 0 },
      { rate: -16000 },
      { rate: 999 },
      { rate: 100001 },
      { rate: 16000.12345 },
      { rate: 16000, extra: 'x' },
    ];
    for (const body of badBodies) {
      await owner.post('/api/admin/exchange-rates').send(body).expect(400);
    }
  });

  it('DoD: changing the rate changes the USD price in the public catalog', async () => {
    const first = await setRate(16000);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ rate: '16000.0000', setBy: { name: 'Owner' } });
    expect(await catalogPriceUsd()).toBe('10.00'); // 160,000 IDR ÷ 16,000

    await setRate(20000).then((res) => expect(res.status).toBe(201));
    expect(await catalogPriceUsd()).toBe('8.00'); // 160,000 IDR ÷ 20,000

    await setRate(16250.5).then((res) => expect(res.status).toBe(201));
    expect(await catalogPriceUsd()).toBe('9.85'); // 160,000 ÷ 16,250.5 = 9.8458… → rounded to cents
  });

  it('the public endpoint returns the rate in force', async () => {
    const res = await request(app.getHttpServer()).get('/api/fx/current').expect(200);
    expect(res.body).toMatchObject({ rate: '16250.5000' });
    expect(typeof res.body.updatedAt).toBe('string');
  });

  it('DoD: the history keeps every rate, newest first, with who set it', async () => {
    const owner = await agentFor(emails.owner);
    const res = await owner.get('/api/admin/exchange-rates').expect(200);
    const mine = (res.body as { rate: string; setBy: { name: string } }[]).filter((row) => row.setBy.name === 'Owner');
    expect(mine.map((row) => row.rate).slice(0, 3)).toEqual(['16250.5000', '20000.0000', '16000.0000']);
  });
});
