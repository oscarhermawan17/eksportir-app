import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { AdminContentItemView, ContentItemView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Users use the prefix "content-e2e-". Content items are global rows, so this spec only creates items whose English
// title starts with "content-e2e" and deletes them afterwards; the seeded steps and questions are read, never changed.
describe('Page content edited by the owner (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    owner: `content-e2e-owner-${stamp}@example.com`,
    ops: `content-e2e-ops-${stamp}@example.com`,
    buyer: `content-e2e-buyer-${stamp}@example.com`,
  };
  const agents = new Map<string, ReturnType<typeof request.agent>>();

  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) return cached;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };
  const anon = () => request(app.getHttpServer());

  const body = (title: string, extra: Record<string, unknown> = {}) => ({
    kind: 'FAQ',
    titleEn: title,
    titleId: `${title} (id)`,
    titleRu: `${title} (ru)`,
    bodyEn: 'English answer',
    bodyId: 'Jawaban',
    bodyRu: 'Ответ',
    ...extra,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    await prisma.user.create({ data: { email: emails.owner, passwordHash, name: 'Owner', roles: [Role.ADMIN_OWNER] } });
    await prisma.user.create({ data: { email: emails.ops, passwordHash, name: 'Ops', roles: [Role.ADMIN_OPS] } });
    await prisma.user.create({ data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] } });
  });

  afterAll(async () => {
    await prisma.contentItem.deleteMany({ where: { titleEn: { startsWith: 'content-e2e' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'content-e2e-' } } });
    await app.close();
  });

  it('serves the seeded steps and questions to anyone, in the requested language', async () => {
    const steps = (await anon().get('/api/content?kind=HOW_IT_WORKS_STEP&locale=id').expect(200)).body as ContentItemView[];
    expect(steps.length).toBeGreaterThanOrEqual(6);
    expect(steps[0]).toMatchObject({ title: 'Temukan produk' });
    const faq = (await anon().get('/api/content?kind=FAQ&locale=ru').expect(200)).body as ContentItemView[];
    expect(faq.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(faq[0]!).sort()).toEqual(['body', 'id', 'title']);
  });

  it('rejects an unknown kind or locale', async () => {
    await anon().get('/api/content?kind=NOPE').expect(400);
    await anon().get('/api/content').expect(400);
    await anon().get('/api/content?kind=FAQ&locale=fr').expect(400);
  });

  it('lets only the owner manage content (401/403)', async () => {
    await anon().get('/api/admin/content?kind=FAQ').expect(401);
    await (await agentFor(emails.buyer)).get('/api/admin/content?kind=FAQ').expect(403);
    await (await agentFor(emails.ops)).get('/api/admin/content?kind=FAQ').expect(403);
    await (await agentFor(emails.ops)).post('/api/admin/content').send(body('content-e2e ops')).expect(403);
    await (await agentFor(emails.owner)).get('/api/admin/content?kind=FAQ').expect(200);
  });

  it('needs all three languages, within the limits, and nothing extra', async () => {
    const owner = await agentFor(emails.owner);
    await owner.post('/api/admin/content').send(body('content-e2e x', { titleRu: '   ' })).expect(400);
    await owner.post('/api/admin/content').send(body('content-e2e x', { bodyId: 'x'.repeat(1001) })).expect(400);
    await owner.post('/api/admin/content').send(body('content-e2e x', { kind: 'BANNER' })).expect(400);
    await owner.post('/api/admin/content').send(body('content-e2e x', { sortOrder: 1 })).expect(400);
  });

  it('adds at the end, shows it publicly, hides it, and falls back to English for an empty translation', async () => {
    const owner = await agentFor(emails.owner);
    const created = (await owner.post('/api/admin/content').send(body('content-e2e first')).expect(201)).body as AdminContentItemView;
    const list = (await owner.get('/api/admin/content?kind=FAQ').expect(200)).body as AdminContentItemView[];
    expect(list.at(-1)?.id).toBe(created.id);

    const publicIds = async () =>
      ((await anon().get('/api/content?kind=FAQ&locale=en').expect(200)).body as ContentItemView[]).map((row) => row.id);
    expect(await publicIds()).toContain(created.id);

    await owner.patch(`/api/admin/content/${created.id}`).send({ active: false }).expect(200);
    expect(await publicIds()).not.toContain(created.id);
    await owner.patch(`/api/admin/content/${created.id}`).send({ active: true }).expect(200);

    // An empty translation can only come from the database (the API refuses one); English then stands in.
    await prisma.contentItem.update({ where: { id: created.id }, data: { titleRu: ' ' } });
    const ru = (await anon().get('/api/content?kind=FAQ&locale=ru').expect(200)).body as ContentItemView[];
    expect(ru.find((row) => row.id === created.id)?.title).toBe('content-e2e first');
  });

  it('moves an item past its neighbour and leaves the others where they were', async () => {
    const owner = await agentFor(emails.owner);
    const second = (await owner.post('/api/admin/content').send(body('content-e2e second')).expect(201)).body as AdminContentItemView;
    const before = ((await owner.get('/api/admin/content?kind=FAQ').expect(200)).body as AdminContentItemView[]).map((row) => row.id);

    const after = ((await owner.post(`/api/admin/content/${second.id}/move`).send({ direction: 'up' }).expect(200))
      .body as AdminContentItemView[]).map((row) => row.id);
    const i = before.indexOf(second.id);
    expect(after.indexOf(second.id)).toBe(i - 1);
    expect(after.slice(0, i - 1)).toEqual(before.slice(0, i - 1));

    // At the end of the list "down" changes nothing.
    const last = after.at(-1)!;
    const again = ((await owner.post(`/api/admin/content/${last}/move`).send({ direction: 'down' }).expect(200))
      .body as AdminContentItemView[]).map((row) => row.id);
    expect(again).toEqual(after);
    await owner.post(`/api/admin/content/${last}/move`).send({ direction: 'sideways' }).expect(400);
  });

  it('deletes an item for good, and answers 404 for an unknown one', async () => {
    const owner = await agentFor(emails.owner);
    const doomed = (await owner.post('/api/admin/content').send(body('content-e2e doomed')).expect(201)).body as AdminContentItemView;
    await owner.delete(`/api/admin/content/${doomed.id}`).expect(204);
    await owner.delete(`/api/admin/content/${doomed.id}`).expect(404);
    await owner.patch('/api/admin/content/nope').send({ active: false }).expect(404);
  });
});
