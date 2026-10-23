import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Requires the database from docker-compose.yml (`pnpm db:up`) and apps/api/.env.
describe('RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const users = {
    buyer: { email: `e2e-rbac-buyer-${stamp}@example.com`, roles: [Role.BUYER] },
    seller: { email: `e2e-rbac-seller-${stamp}@example.com`, roles: [Role.SELLER] },
    ops: { email: `e2e-rbac-ops-${stamp}@example.com`, roles: [Role.ADMIN_OPS] },
    owner: { email: `e2e-rbac-owner-${stamp}@example.com`, roles: [Role.ADMIN_OWNER] },
  };

  async function loginAs(email: string) {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    return agent;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    for (const [name, { email, roles }] of Object.entries(users)) {
      await prisma.user.create({ data: { email, passwordHash, name, roles } });
    }
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-rbac-' } } });
    await app.close();
  });

  it('rejects anonymous requests to an admin endpoint with 401', async () => {
    await request(app.getHttpServer()).get('/api/admin/ping').expect(401);
  });

  it('rejects a buyer with 403', async () => {
    const agent = await loginAs(users.buyer.email);
    await agent.get('/api/admin/ping').expect(403);
  });

  it('rejects a seller with 403', async () => {
    const agent = await loginAs(users.seller.email);
    await agent.get('/api/admin/ping').expect(403);
  });

  it.each(['ops', 'owner'] as const)('accepts admin (%s) with 200', async (key) => {
    const agent = await loginAs(users[key].email);
    const res = await agent.get('/api/admin/ping').expect(200);
    expect(res.body).toEqual({ ok: true });
  });
});
