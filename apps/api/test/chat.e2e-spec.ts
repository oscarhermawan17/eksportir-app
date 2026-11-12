import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { ChatMessageView, ConversationView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "chat-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Chat: conversations and messages (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const names = ['buyer', 'buyer2', 'seller', 'seller2', 'ops', 'owner', 'finance'] as const;
  const emails = Object.fromEntries(names.map((n) => [n, `chat-e2e-${n}-${stamp}@example.com`])) as Record<(typeof names)[number], string>;
  const cookies = new Map<string, string>();
  const ids: Record<string, string> = {};
  let conversationId = '';

  // Login is limited to 5 per minute, and this spec has 7 users, so session cookies are minted directly instead.
  const agentFor = async (email: string) => {
    const cookie = cookies.get(email);
    if (!cookie) throw new Error(`No session for ${email}`);
    return {
      get: (path: string) => request(app.getHttpServer()).get(path).set('Cookie', cookie),
      post: (path: string) => request(app.getHttpServer()).post(path).set('Cookie', cookie),
    };
  };

  const makeProduct = async (sellerId: string, key: string, status: 'APPROVED' | 'DRAFT') => {
    const product = await prisma.product.create({
      data: {
        sellerId,
        type: 'READY_STOCK',
        categorySlug: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 100000,
        moq: 1,
        stockQty: 10,
        sourceLocale: 'en',
        status,
        translations: { create: [{ locale: 'en', title: `Chat product ${key}`, description: 'Description' }] },
      },
    });
    ids[key] = product.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    const user = async (key: (typeof names)[number], name: string, roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: emails[key],
          passwordHash,
          name,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await user('buyer', 'Anna Buyer', [Role.BUYER]);
    await user('buyer2', 'Boris Buyer', [Role.BUYER]);
    await user('seller', 'Seller Person', [Role.SELLER], 'Chat Shop');
    await user('seller2', 'Other Seller', [Role.SELLER], 'Other Shop');
    await user('ops', 'Ops Admin', [Role.ADMIN_OPS]);
    await user('owner', 'Owner Admin', [Role.ADMIN_OWNER]);
    await user('finance', 'Finance Admin', [Role.ADMIN_FINANCE]);
    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) {
      cookies.set(emails[name], `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);
    }
    await makeProduct(ids['sellerProfile']!, 'product', 'APPROVED');
    await makeProduct(ids['sellerProfile']!, 'draft', 'DRAFT');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'chat-e2e-' } } });
    await app.close();
  });

  it('requires a login for every route (401)', async () => {
    const http = request(app.getHttpServer());
    await http.get('/api/conversations').expect(401);
    await http.post('/api/conversations').send({ productId: 'x' }).expect(401);
    await http.get('/api/conversations/x').expect(401);
    await http.get('/api/conversations/x/messages').expect(401);
    await http.post('/api/conversations/x/messages').send({ body: 'hi' }).expect(401);
  });

  describe('starting a conversation about a product', () => {
    it('a buyer starts one; asking again returns the same conversation', async () => {
      const buyer = await agentFor(emails.buyer);
      const res = await buyer.post('/api/conversations').send({ productId: ids['product'] }).expect(201);
      const view = res.body as ConversationView;
      conversationId = view.id;
      expect(view).toMatchObject({
        type: 'PRODUCT_INQUIRY',
        product: { id: ids['product'], title: 'Chat product product' },
        buyer: { id: ids['buyer'], name: 'Anna Buyer' },
        seller: { id: ids['sellerProfile'], displayName: 'Chat Shop' },
        lastMessage: null,
      });
      expect(JSON.stringify(view)).not.toContain(emails.buyer);

      const again = await buyer.post('/api/conversations').send({ productId: ids['product'] }).expect(201);
      expect(again.body.id).toBe(conversationId);
    });

    it('two simultaneous requests still give one conversation', async () => {
      const buyer2 = await agentFor(emails.buyer2);
      const [a, b] = await Promise.all([
        buyer2.post('/api/conversations').send({ productId: ids['product'] }),
        buyer2.post('/api/conversations').send({ productId: ids['product'] }),
      ]);
      expect([a.status, b.status]).toEqual([201, 201]);
      expect(a.body.id).toBe(b.body.id);
      expect(a.body.id).not.toBe(conversationId);
    });

    it('rejects the seller of the product, non-buyers, and products buyers cannot see', async () => {
      await (await agentFor(emails.seller)).post('/api/conversations').send({ productId: ids['product'] }).expect(403);
      await (await agentFor(emails.ops)).post('/api/conversations').send({ productId: ids['product'] }).expect(403);
      const buyer = await agentFor(emails.buyer);
      await buyer.post('/api/conversations').send({ productId: ids['draft'] }).expect(404);
      await buyer.post('/api/conversations').send({ productId: 'does-not-exist' }).expect(404);
    });

    it('validates the body', async () => {
      const buyer = await agentFor(emails.buyer);
      await buyer.post('/api/conversations').send({}).expect(400);
      await buyer.post('/api/conversations').send({ productId: '' }).expect(400);
      await buyer.post('/api/conversations').send({ productId: ids['product'], extra: 1 }).expect(400);
    });
  });

  describe('who can see a conversation', () => {
    it('the buyer, the product seller, ops and owner can; everyone else gets 404', async () => {
      for (const email of [emails.buyer, emails.seller, emails.ops, emails.owner]) {
        await (await agentFor(email)).get(`/api/conversations/${conversationId}`).expect(200);
      }
      for (const email of [emails.buyer2, emails.seller2, emails.finance]) {
        await (await agentFor(email)).get(`/api/conversations/${conversationId}`).expect(404);
        await (await agentFor(email)).get(`/api/conversations/${conversationId}/messages`).expect(404);
        await (await agentFor(email)).post(`/api/conversations/${conversationId}/messages`).send({ body: 'hello' }).expect(404);
      }
    });

    it('lists only the conversations a user takes part in (admins see all)', async () => {
      const idsOf = async (email: string) =>
        ((await (await agentFor(email)).get('/api/conversations').expect(200)).body as ConversationView[]).map((c) => c.id);
      expect(await idsOf(emails.buyer)).toContain(conversationId);
      expect(await idsOf(emails.seller)).toContain(conversationId);
      expect(await idsOf(emails.ops)).toContain(conversationId);
      expect(await idsOf(emails.owner)).toContain(conversationId);
      expect(await idsOf(emails.buyer2)).not.toContain(conversationId);
      expect(await idsOf(emails.seller2)).toEqual([]);
      expect(await idsOf(emails.finance)).toEqual([]);
    });
  });

  describe('messages', () => {
    const send = async (email: string, body: string) =>
      (await agentFor(email)).post(`/api/conversations/${conversationId}/messages`).send({ body });

    it('buyer, seller and admin write; each message shows who wrote it', async () => {
      const first = await send(emails.buyer, '  Hello, can I get 50 pieces?  ');
      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({ body: 'Hello, can I get 50 pieces?', sender: { name: 'Anna Buyer', role: 'BUYER' } });

      const second = await send(emails.seller, 'Yes, ready in 3 days.');
      expect(second.body).toMatchObject({ sender: { name: 'Chat Shop', role: 'SELLER' } }); // sellers appear under the shop name

      const third = await send(emails.ops, 'BaliTrade here, happy to help.');
      expect(third.body).toMatchObject({ sender: { name: 'Ops Admin', role: 'ADMIN' } });
      const fourth = await send(emails.owner, 'Owner joining too.');
      expect(fourth.body.sender.role).toBe('ADMIN');
    });

    it('returns the messages oldest first and updates the conversation summary', async () => {
      const buyer = await agentFor(emails.buyer);
      const messages = (await buyer.get(`/api/conversations/${conversationId}/messages`).expect(200)).body as ChatMessageView[];
      expect(messages.map((m) => m.sender.role)).toEqual(['BUYER', 'SELLER', 'ADMIN', 'ADMIN']);
      const dates = messages.map((m) => m.createdAt);
      expect([...dates].sort()).toEqual(dates);

      const view = (await buyer.get(`/api/conversations/${conversationId}`).expect(200)).body as ConversationView;
      expect(view.lastMessage).toMatchObject({ body: 'Owner joining too.', senderRole: 'ADMIN' });
      expect(view.lastMessageAt).toBe(messages[messages.length - 1]!.createdAt);
    });

    it('pages backwards with `before`', async () => {
      const buyer = await agentFor(emails.buyer);
      const all = (await buyer.get(`/api/conversations/${conversationId}/messages`).expect(200)).body as ChatMessageView[];
      const olderThanThird = (
        await buyer.get(`/api/conversations/${conversationId}/messages?before=${encodeURIComponent(all[2]!.createdAt)}`).expect(200)
      ).body as ChatMessageView[];
      expect(olderThanThird.map((m) => m.id)).toEqual([all[0]!.id, all[1]!.id]);
      await buyer.get(`/api/conversations/${conversationId}/messages?before=not-a-date`).expect(400);
    });

    it('rejects empty, blank, over-long and unexpected input (400)', async () => {
      for (const body of ['', '   ', 'a'.repeat(2001)]) {
        expect((await send(emails.buyer, body)).status).toBe(400);
      }
      const buyer = await agentFor(emails.buyer);
      await buyer.post(`/api/conversations/${conversationId}/messages`).send({ body: 'ok', senderId: 'someone-else' }).expect(400);
      await buyer.post(`/api/conversations/${conversationId}/messages`).send({}).expect(400);
      expect((await send(emails.buyer, 'a'.repeat(2000))).status).toBe(201);
    });

    it('a sender cannot be spoofed: the message always belongs to the logged-in user', async () => {
      const res = await send(emails.seller, 'I am the seller.');
      expect(res.body.sender).toMatchObject({ id: ids['seller'], role: 'SELLER' });
    });
  });
});
