import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Requires the database from docker-compose.yml (`pnpm db:up`) and apps/api/.env.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'e2e-' } } });
    await app.close();
  });

  it('register → login → me → logout', async () => {
    const registered = await http()
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password, name: 'E2E Buyer', locale: 'ru' })
      .expect(201);
    expect(registered.body).toMatchObject({ email, name: 'E2E Buyer', locale: 'ru', roles: ['BUYER'] });
    expect(registered.body).not.toHaveProperty('passwordHash');
    expect(registered.headers['set-cookie']?.[0]).toMatch(/bt_session=.+HttpOnly/);

    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
    expect(login.headers['set-cookie']?.[0]).toMatch(/bt_session=.+HttpOnly.+SameSite=Lax/);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ email, roles: ['BUYER'] });

    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('saves the chosen language with PATCH /auth/me', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const updated = await agent.patch('/api/auth/me').send({ locale: 'id' }).expect(200);
    expect(updated.body.locale).toBe('id');
    expect((await agent.get('/api/auth/me').expect(200)).body.locale).toBe('id');

    await agent.patch('/api/auth/me').send({ locale: 'xx' }).expect(400);
    await agent.patch('/api/auth/me').send({ locale: 'en', roles: ['ADMIN_OWNER'] }).expect(400);
    await request(app.getHttpServer()).patch('/api/auth/me').send({ locale: 'en' }).expect(401);
  });

  it('stores the password hashed, never in plain text', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).not.toContain(password);
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
  });

  it('rejects a duplicate email with 409', async () => {
    await http().post('/api/auth/register').send({ email, password, name: 'Again' }).expect(409);
  });

  it('allows registering as SELLER but never as an admin role', async () => {
    const seller = await http()
      .post('/api/auth/register')
      .send({ email: `e2e-seller-${Date.now()}@example.com`, password, name: 'Seller', role: 'SELLER' })
      .expect(201);
    expect(seller.body.roles).toEqual(['SELLER']);

    await http()
      .post('/api/auth/register')
      .send({ email: `e2e-admin-${Date.now()}@example.com`, password, name: 'Evil', role: 'ADMIN_OWNER' })
      .expect(400);
  });

  it('validates input (DTO)', async () => {
    await http().post('/api/auth/register').send({ email: 'nope', password: 'short', name: '' }).expect(400);
    await http()
      .post('/api/auth/register')
      .send({ email: `e2e-x-${Date.now()}@example.com`, password, name: 'X', roles: ['ADMIN_OWNER'] })
      .expect(400);
  });

  it('rejects wrong credentials and anonymous /me with 401', async () => {
    await http().post('/api/auth/login').send({ email, password: 'wrong-password' }).expect(401);
    await http().post('/api/auth/login').send({ email: 'e2e-unknown@example.com', password }).expect(401);
    await http().get('/api/auth/me').expect(401);
    await http().get('/api/auth/me').set('Cookie', 'bt_session=garbage').expect(401);
  });

  // Keep last: it exhausts the login rate limit for this client.
  it('throttles repeated login attempts with 429', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      const res = await http().post('/api/auth/login').send({ email, password: 'wrong-password' });
      statuses.push(res.status);
    }
    expect(statuses).toContain(429);
  });
});
