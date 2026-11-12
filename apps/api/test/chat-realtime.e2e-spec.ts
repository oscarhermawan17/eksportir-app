import 'dotenv/config';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { ChatJoinAck, ChatMessageView } from '@balitrade/shared';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "chatrt-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The app really listens on a random port here, because Socket.IO needs a server. Requires `pnpm db:up` and `pnpm db:seed`.
describe('Chat: realtime delivery and message rate limit (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let url = '';
  const stamp = Date.now();
  const names = ['buyer', 'buyer2', 'seller', 'ops', 'finance'] as const;
  const emails = Object.fromEntries(names.map((n) => [n, `chatrt-e2e-${n}-${stamp}@example.com`])) as Record<(typeof names)[number], string>;
  const ids: Record<string, string> = {};
  const cookies = new Map<string, string>();
  const sockets: Socket[] = [];
  let conversationId = '';
  let webOrigin = '';

  const connect = (who: (typeof names)[number] | null, headers: Record<string, string> = {}): Promise<Socket> =>
    new Promise((resolve) => {
      const socket = io(url, {
        transports: ['websocket'],
        reconnection: false,
        extraHeaders: { ...(who ? { cookie: cookies.get(emails[who])! } : {}), ...headers },
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      // The server disconnects rejected clients right after the handshake.
      socket.on('disconnect', () => resolve(socket));
      socket.on('connect_error', () => resolve(socket));
    });

  /** Resolves with the first event of that name, or null after `ms` (to prove that nothing arrives). */
  const nextEvent = <T>(socket: Socket, event: string, ms = 1500): Promise<T | null> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

  const join = (socket: Socket, id: string): Promise<ChatJoinAck | undefined> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(undefined), 2000);
      socket.emit('conversation:join', id, (ack: ChatJoinAck) => {
        clearTimeout(timer);
        resolve(ack);
      });
    });

  const post = (who: (typeof names)[number], path: string, body: object) =>
    request(app.getHttpServer()).post(path).set('Cookie', cookies.get(emails[who])!).send(body);

  /** A connected socket stays connected; a rejected one is disconnected shortly after the handshake. */
  const stillConnected = async (socket: Socket): Promise<boolean> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return socket.connected;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    webOrigin = process.env['WEB_ORIGIN'] ?? 'http://localhost:3000';

    const passwordHash = await hashPassword('correct-horse-battery');
    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: (typeof names)[number], roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: emails[key],
          passwordHash,
          name: key,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', [Role.BUYER]);
    await make('buyer2', [Role.BUYER]);
    await make('seller', [Role.SELLER], 'Realtime Shop');
    await make('ops', [Role.ADMIN_OPS]);
    await make('finance', [Role.ADMIN_FINANCE]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(emails[name], `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);

    const product = await prisma.product.create({
      data: {
        sellerId: ids['sellerProfile']!,
        type: 'READY_STOCK',
        categorySlug: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 100000,
        moq: 1,
        stockQty: 5,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: { create: [{ locale: 'en', title: 'Realtime product', description: 'Description' }] },
      },
    });
    const res = await post('buyer', '/api/conversations', { productId: product.id }).expect(201);
    conversationId = res.body.id;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await prisma.user.deleteMany({ where: { email: { startsWith: 'chatrt-e2e-' } } });
    await app.close();
  });

  describe('connecting', () => {
    it('rejects a connection without a session cookie or with an invalid one', async () => {
      expect(await stillConnected(await connect(null))).toBe(false);
      expect(await stillConnected(await connect(null, { cookie: `${SESSION_COOKIE}=not-a-token` }))).toBe(false);
    });

    it('rejects a browser page from another origin even with a valid cookie', async () => {
      expect(await stillConnected(await connect('buyer', { origin: 'https://evil.example' }))).toBe(false);
    });

    it('accepts a logged-in user (the web origin or a non-browser client without Origin)', async () => {
      expect(await stillConnected(await connect('buyer'))).toBe(true);
      expect(await stillConnected(await connect('buyer', { origin: webOrigin }))).toBe(true);
    });
  });

  describe('joining a conversation', () => {
    it('lets the buyer, the seller and the ops admin join; refuses outsiders and finance', async () => {
      for (const who of ['buyer', 'seller', 'ops'] as const) {
        expect(await join(await connect(who), conversationId)).toEqual({ ok: true });
      }
      for (const who of ['buyer2', 'finance'] as const) {
        expect(await join(await connect(who), conversationId)).toEqual({ ok: false });
      }
    });

    it('refuses an invalid or unknown conversation id', async () => {
      const socket = await connect('buyer');
      expect(await join(socket, 'does-not-exist')).toEqual({ ok: false });
      expect(await join(socket, 123 as unknown as string)).toEqual({ ok: false });
      expect(await join(socket, 'x'.repeat(65))).toEqual({ ok: false });
    });
  });

  describe('delivery', () => {
    it('pushes a new message to everyone in the conversation room, and to nobody else', async () => {
      const seller = await connect('seller');
      const ops = await connect('ops');
      const outsider = await connect('buyer2');
      await join(seller, conversationId);
      await join(ops, conversationId);
      await join(outsider, conversationId); // refused

      const sellerGets = nextEvent<ChatMessageView>(seller, 'message:new');
      const opsGets = nextEvent<ChatMessageView>(ops, 'message:new');
      const outsiderGets = nextEvent<ChatMessageView>(outsider, 'message:new', 800);
      await post('buyer', `/api/conversations/${conversationId}/messages`, { body: 'Is it in stock?' }).expect(201);

      for (const received of [await sellerGets, await opsGets]) {
        expect(received).toMatchObject({ conversationId, body: 'Is it in stock?', sender: { name: 'buyer', role: 'BUYER' } });
      }
      expect(await outsiderGets).toBeNull();
    });

    it('does not push to a participant who has not opened the conversation, but tells their list to refresh', async () => {
      const seller = await connect('seller'); // connected, never joined the conversation room
      const ops = await connect('ops');
      const outsider = await connect('buyer2');
      const buyer = await connect('buyer');
      const message = nextEvent<ChatMessageView>(seller, 'message:new', 800);
      const sellerList = nextEvent<{ conversationId: string }>(seller, 'conversation:updated');
      const opsList = nextEvent<{ conversationId: string }>(ops, 'conversation:updated');
      const buyerList = nextEvent<{ conversationId: string }>(buyer, 'conversation:updated');
      const outsiderList = nextEvent<{ conversationId: string }>(outsider, 'conversation:updated', 800);

      await post('buyer', `/api/conversations/${conversationId}/messages`, { body: 'Hello again' }).expect(201);

      expect(await message).toBeNull();
      expect(await sellerList).toEqual({ conversationId });
      expect(await opsList).toEqual({ conversationId });
      expect(await buyerList).toEqual({ conversationId });
      expect(await outsiderList).toBeNull(); // not a participant, not a moderator
    });

    it('stops pushing after the socket leaves the conversation', async () => {
      const seller = await connect('seller');
      await join(seller, conversationId);
      seller.emit('conversation:leave', conversationId);
      await new Promise((resolve) => setTimeout(resolve, 200));
      const message = nextEvent<ChatMessageView>(seller, 'message:new', 800);
      await post('buyer', `/api/conversations/${conversationId}/messages`, { body: 'After leave' }).expect(201);
      expect(await message).toBeNull();
    });
  });

  describe('rate limit', () => {
    it('answers 429 after 20 messages in a minute, per user, and keeps other users unaffected', async () => {
      // buyer2 starts its own conversation so earlier tests do not count against it.
      const product = await prisma.product.findFirstOrThrow({ where: { sellerId: ids['sellerProfile']! } });
      const conversation = (await post('buyer2', '/api/conversations', { productId: product.id }).expect(201)).body.id as string;
      const statuses: number[] = [];
      for (let i = 0; i < 22; i++) {
        statuses.push((await post('buyer2', `/api/conversations/${conversation}/messages`, { body: `spam ${i}` })).status);
      }
      expect(statuses.filter((s) => s === 201)).toHaveLength(20);
      expect(statuses.slice(20)).toEqual([429, 429]);
      // Another user can still write in the same conversation.
      await post('ops', `/api/conversations/${conversation}/messages`, { body: 'Admin is not limited by the buyer' }).expect(201);
    });
  });
});
