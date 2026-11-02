import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { NotificationCount, NotificationPush, NotificationsResponse } from '@balitrade/shared';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "notif-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The app listens on a random port because the push tests use a real Socket.IO connection.
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url = '';
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'ops', 'outsider'] as const;
  type Who = (typeof names)[number];
  const emails = Object.fromEntries(names.map((n) => [n, `notif-e2e-${n}-${stamp}@example.com`])) as Record<Who, string>;
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  const sockets: Socket[] = [];
  let conversationId = '';

  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  const list = async (who: Who) => (await http(who, 'get', '/api/notifications').expect(200)).body as NotificationsResponse;
  const say = (who: Who, body: string) => http(who, 'post', `/api/conversations/${conversationId}/messages`).send({ body }).expect(201);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 250)); // notifications are created right after the response

  const connect = (who: Who): Promise<Socket> =>
    new Promise((resolve) => {
      const socket = io(url, { transports: ['websocket'], reconnection: false, extraHeaders: { cookie: cookies.get(who)! } });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
    });
  const nextEvent = <T>(socket: Socket, event: string, ms = 1500): Promise<T | null> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword('correct-horse-battery');
    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: Who, name: string, roles: Role[], locale: string, shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: emails[key],
          passwordHash,
          name,
          roles,
          locale,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', 'Anna Buyer', [Role.BUYER], 'ru');
    await make('seller', 'Seller Person', [Role.SELLER], 'en', 'Notif Shop');
    await make('ops', 'Ops Admin', [Role.ADMIN_OPS], 'en');
    await make('outsider', 'Outsider', [Role.BUYER], 'en');

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);

    const product = await prisma.product.create({
      data: {
        sellerId: ids['sellerProfile']!,
        type: 'READY_STOCK',
        category: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 100000,
        moq: 1,
        stockQty: 5,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: {
          create: [
            { locale: 'en', title: 'Notif basket', description: 'Description' },
            { locale: 'ru', title: 'Корзина для уведомлений', description: 'Описание' },
          ],
        },
      },
    });
    conversationId = (await http('buyer', 'post', '/api/conversations').send({ productId: product.id }).expect(201)).body.id;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await prisma.user.deleteMany({ where: { email: { startsWith: 'notif-e2e-' } } });
    await app.close();
  });

  it('requires a login for every route (401)', async () => {
    const server = request(app.getHttpServer());
    await server.get('/api/notifications').expect(401);
    await server.post('/api/notifications/read-all').expect(401);
    await server.post('/api/notifications/x/read').expect(401);
    await server.post('/api/notifications/conversations/x/read').expect(401);
  });

  it('starts empty', async () => {
    expect(await list('seller')).toEqual({ items: [], unreadCount: 0 });
  });

  describe('chat messages', () => {
    it('notifies the other side only: the seller, not the buyer who wrote', async () => {
      await say('buyer', 'Hello, can I get 30 pieces?');
      await settle();
      const seller = await list('seller');
      expect(seller.unreadCount).toBe(1);
      expect(seller.items[0]).toMatchObject({
        type: 'CHAT_MESSAGE',
        readAt: null,
        payload: { conversationId, senderName: 'Anna Buyer', preview: 'Hello, can I get 30 pieces?', count: 1, productTitle: 'Notif basket' },
      });
      expect(await list('buyer')).toEqual({ items: [], unreadCount: 0 });
      expect(await list('outsider')).toEqual({ items: [], unreadCount: 0 });
    });

    it('folds unread messages of one conversation into one notification with a counter', async () => {
      await say('buyer', 'Also, what is the lead time?');
      await say('buyer', 'And the price for 100?');
      await settle();
      const seller = await list('seller');
      expect(seller.items).toHaveLength(1);
      expect(seller.unreadCount).toBe(1);
      expect(seller.items[0]!.payload).toMatchObject({ count: 3, preview: 'And the price for 100?' });
    });

    it('shows sellers under their shop name and the product title in the recipient\'s language', async () => {
      await say('seller', 'Yes, ready in 3 days.');
      await settle();
      const buyer = await list('buyer');
      expect(buyer.items[0]!.payload).toMatchObject({
        senderName: 'Notif Shop',
        productTitle: 'Корзина для уведомлений', // the buyer's locale is ru
        count: 1,
      });
    });

    it('an admin message notifies both buyer and seller', async () => {
      await say('ops', 'BaliTrade here, we will handle QC.');
      await settle();
      const buyer = await list('buyer');
      const seller = await list('seller');
      expect(buyer.items[0]!.payload).toMatchObject({ senderName: 'Ops Admin', count: 2 });
      expect(seller.items[0]!.payload).toMatchObject({ senderName: 'Ops Admin', count: 4 });
      expect(await list('ops')).toEqual({ items: [], unreadCount: 0 });
    });

    it('cuts a long message to a one-line preview', async () => {
      await say('ops', `${'long '.repeat(80)}\nend`);
      await settle();
      const preview = ((await list('buyer')).items[0]!.payload as { preview: string }).preview;
      expect(preview).toHaveLength(100);
      expect(preview).not.toContain('\n');
      expect(preview.endsWith('…')).toBe(true);
    });
  });

  describe('reading', () => {
    it('marks one notification read; others cannot touch it (404) and it is idempotent', async () => {
      const id = (await list('seller')).items[0]!.id;
      await http('buyer', 'post', `/api/notifications/${id}/read`).expect(404);
      await http('outsider', 'post', `/api/notifications/${id}/read`).expect(404);
      const first = await http('seller', 'post', `/api/notifications/${id}/read`).expect(201);
      expect(first.body.readAt).toEqual(expect.any(String));
      const again = await http('seller', 'post', `/api/notifications/${id}/read`).expect(201);
      expect(again.body.readAt).toBe(first.body.readAt);
      expect((await list('seller')).unreadCount).toBe(0);
      await http('seller', 'post', '/api/notifications/does-not-exist/read').expect(404);
    });

    it('after a notification was read, the next message starts a fresh one', async () => {
      await say('buyer', 'Any news?');
      await settle();
      const seller = await list('seller');
      expect(seller.unreadCount).toBe(1);
      expect(seller.items).toHaveLength(2); // the read one stays in the history
      expect(seller.items[0]).toMatchObject({ readAt: null, payload: { count: 1, preview: 'Any news?' } });
    });

    it('opening a conversation marks its notification read', async () => {
      expect((await list('buyer')).unreadCount).toBe(1);
      const res = await http('buyer', 'post', `/api/notifications/conversations/${conversationId}/read`).expect(201);
      expect(res.body).toEqual({ unreadCount: 0 });
      expect((await list('buyer')).unreadCount).toBe(0);
      // unknown conversation or somebody else's: nothing to mark, nothing leaked
      await http('outsider', 'post', `/api/notifications/conversations/${conversationId}/read`).expect(201);
    });

    it('marks everything read', async () => {
      await say('buyer', 'One more');
      await settle();
      expect((await list('seller')).unreadCount).toBe(1);
      const res = await http('seller', 'post', '/api/notifications/read-all').expect(201);
      expect(res.body).toEqual({ unreadCount: 0 });
      expect((await list('seller')).items.every((item) => item.readAt !== null)).toBe(true);
    });

    it('lists the newest 30 at most', async () => {
      for (let i = 0; i < 32; i++) {
        await prisma.notification.create({
          data: { userId: ids['outsider']!, type: 'CHAT_MESSAGE', subject: `conversation:fake-${i}`, payload: { conversationId: `fake-${i}`, productTitle: null, senderName: 'x', preview: 'x', count: 1 } },
        });
      }
      const outsider = await list('outsider');
      expect(outsider.items).toHaveLength(30);
      expect(outsider.unreadCount).toBe(32); // the count covers all, not just the page
    });
  });

  describe('push over the socket', () => {
    it('pushes a new notification with the unread count to the recipient, and nothing to anyone else', async () => {
      const seller = await connect('seller');
      const buyer = await connect('buyer');
      const outsider = await connect('outsider');
      const sellerGets = nextEvent<NotificationPush>(seller, 'notification:new');
      const buyerGets = nextEvent<NotificationPush>(buyer, 'notification:new', 800);
      const outsiderGets = nextEvent<NotificationPush>(outsider, 'notification:new', 800);

      await say('buyer', 'Push test');

      const push = await sellerGets;
      expect(push?.item.payload).toMatchObject({ preview: 'Push test', senderName: 'Anna Buyer' });
      expect(push?.unreadCount).toBe(1);
      expect(await buyerGets).toBeNull(); // the sender gets no notification of their own message
      expect(await outsiderGets).toBeNull();
    });

    it('syncs the count to every tab of the user when something is marked read', async () => {
      const tabA = await connect('seller');
      const tabB = await connect('seller');
      const gotB = nextEvent<NotificationCount>(tabB, 'notification:count');
      await http('seller', 'post', '/api/notifications/read-all').expect(201);
      expect(await gotB).toEqual({ unreadCount: 0 });
      void tabA;
    });
  });
});
