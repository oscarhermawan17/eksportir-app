import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "sellers-e2e-" (not "e2e-") so other spec files' cleanup, which run in parallel, do not delete them.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Seller onboarding (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const sellerEmail = `sellers-e2e-seller-${stamp}@example.com`;
  const buyerEmail = `sellers-e2e-buyer-${stamp}@example.com`;
  const opsEmail = `sellers-e2e-ops-${stamp}@example.com`;
  const financeEmail = `sellers-e2e-fin-${stamp}@example.com`;
  let zoneId: string;

  // Login is rate limited (5/min), so each user logs in once and the agent (cookie jar) is reused.
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
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    zoneId = (await prisma.qcZone.findFirstOrThrow({ where: { name: 'Gianyar' } })).id;
    const passwordHash = await hashPassword(password);
    await prisma.user.create({ data: { email: opsEmail, passwordHash, name: 'Ops', roles: [Role.ADMIN_OPS] } });
    await prisma.user.create({ data: { email: financeEmail, passwordHash, name: 'Fin', roles: [Role.ADMIN_FINANCE] } });
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: buyerEmail, password, name: 'Buyer One', acceptAdminInChat: true })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'sellers-e2e-' } } });
    await app.close();
  });

  it('seeds the 9 Bali QC zones and lists them publicly', async () => {
    const res = await request(app.getHttpServer()).get('/api/qc-zones').expect(200);
    const names = res.body.map((zone: { name: string }) => zone.name);
    expect(names).toEqual(
      expect.arrayContaining(['Badung', 'Denpasar', 'Gianyar', 'Tabanan', 'Klungkung', 'Bangli', 'Karangasem', 'Buleleng', 'Jembrana']),
    );
    expect(res.body[0]).not.toHaveProperty('feeUsd');
  });

  it('public SELLER signup creates a PENDING profile', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/auth/register')
      .send({ email: sellerEmail, password, name: 'Ketut Weaver', role: 'SELLER', acceptAdminInChat: true })
      .expect(201);
    const profile = await agent.get('/api/sellers/me').expect(200);
    expect(profile.body).toMatchObject({ displayName: 'Ketut Weaver', status: 'PENDING', qcZone: null });
  });

  it('a PENDING seller cannot use seller-only endpoints (403) — DoD', async () => {
    const seller = await agentFor(sellerEmail);
    await seller.get('/api/seller/ping').expect(403);
  });

  it('a buyer cannot use seller-only endpoints (403) and has no seller profile (404)', async () => {
    const buyer = await agentFor(buyerEmail);
    await buyer.get('/api/seller/ping').expect(403);
    await buyer.get('/api/sellers/me').expect(404);
  });

  it('seller fills in profile and location', async () => {
    const seller = await agentFor(sellerEmail);
    await seller.patch('/api/sellers/me').send({ qcZoneId: 'does-not-exist' }).expect(400);
    const res = await seller
      .patch('/api/sellers/me')
      .send({ displayName: 'Ketut Weaving Studio', about: 'Handwoven bags from Gianyar.', qcZoneId: zoneId })
      .expect(200);
    expect(res.body).toMatchObject({ displayName: 'Ketut Weaving Studio', qcZone: { name: 'Gianyar' }, status: 'PENDING' });
  });

  it('only OPS/OWNER admins can see the applications', async () => {
    await request(app.getHttpServer()).get('/api/admin/sellers').expect(401);
    await (await agentFor(buyerEmail)).get('/api/admin/sellers').expect(403);
    await (await agentFor(financeEmail)).get('/api/admin/sellers').expect(403);

    const ops = await agentFor(opsEmail);
    const list = await ops.get('/api/admin/sellers?status=PENDING').expect(200);
    const entry = list.body.find((item: { user: { email: string } }) => item.user.email === sellerEmail);
    expect(entry).toMatchObject({ status: 'PENDING', qcZone: { name: 'Gianyar', feeUsd: expect.stringMatching(/^\d+\.\d{2}$/) } });
    await ops.get('/api/admin/sellers?status=BOGUS').expect(400);
  });

  it('admin rejects with a reason; the seller sees it and can resubmit', async () => {
    const ops = await agentFor(opsEmail);
    const seller = await agentFor(sellerEmail);
    const id = (await seller.get('/api/sellers/me').expect(200)).body.id as string;

    await ops.post(`/api/admin/sellers/${id}/reject`).send({}).expect(400);
    await ops.post(`/api/admin/sellers/${id}/reject`).send({ reason: 'Please add product photos.' }).expect(201);
    await ops.post(`/api/admin/sellers/${id}/reject`).send({ reason: 'Again please' }).expect(409);

    const rejected = await seller.get('/api/sellers/me').expect(200);
    expect(rejected.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Please add product photos.' });
    await seller.get('/api/seller/ping').expect(403);

    const resubmitted = await seller.patch('/api/sellers/me').send({ about: 'Now with photos.' }).expect(200);
    expect(resubmitted.body).toMatchObject({ status: 'PENDING', rejectionReason: null });
  });

  it('admin cannot approve a seller who has no location yet', async () => {
    const email = `sellers-e2e-nozone-${stamp}@example.com`;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/register').send({ email, password, name: 'No Zone', role: 'SELLER', acceptAdminInChat: true }).expect(201);
    const id = (await agent.get('/api/sellers/me').expect(200)).body.id as string;
    await (await agentFor(opsEmail)).post(`/api/admin/sellers/${id}/approve`).expect(400);
  });

  it('after approval the seller can use seller-only endpoints (200) — DoD', async () => {
    const ops = await agentFor(opsEmail);
    const seller = await agentFor(sellerEmail);
    const id = (await seller.get('/api/sellers/me').expect(200)).body.id as string;

    const approved = await ops.post(`/api/admin/sellers/${id}/approve`).expect(201);
    expect(approved.body).toMatchObject({ status: 'APPROVED', rejectionReason: null });
    await ops.post(`/api/admin/sellers/${id}/approve`).expect(409);
    await ops.post('/api/admin/sellers/unknown-id/approve').expect(404);

    await seller.get('/api/seller/ping').expect(200);
    // An approved seller may edit the text, but not the location (it drives the QC fee).
    await seller.patch('/api/sellers/me').send({ about: 'Approved and open.' }).expect(200);
    const other = (await prisma.qcZone.findFirstOrThrow({ where: { name: 'Karangasem' } })).id;
    await seller.patch('/api/sellers/me').send({ qcZoneId: other }).expect(403);
  });

  it('an admin can revoke an approved seller', async () => {
    const ops = await agentFor(opsEmail);
    const seller = await agentFor(sellerEmail);
    const id = (await seller.get('/api/sellers/me').expect(200)).body.id as string;
    await ops.post(`/api/admin/sellers/${id}/reject`).send({ reason: 'Policy violation.' }).expect(201);
    await seller.get('/api/seller/ping').expect(403);
  });

  it('an existing buyer can apply to become a seller', async () => {
    const buyer = await agentFor(buyerEmail);
    await buyer.post('/api/sellers/apply').send({ displayName: 'x' }).expect(400);
    const res = await buyer
      .post('/api/sellers/apply')
      .send({ displayName: 'Buyer Crafts', qcZoneId: zoneId })
      .expect(201);
    expect(res.body).toMatchObject({ status: 'PENDING', qcZone: { name: 'Gianyar' } });
    await buyer.post('/api/sellers/apply').send({ displayName: 'Again' }).expect(409);

    const me = await buyer.get('/api/auth/me').expect(200);
    expect(me.body.roles).toEqual(expect.arrayContaining(['BUYER', 'SELLER']));
    await buyer.get('/api/seller/ping').expect(403);
  });
});
