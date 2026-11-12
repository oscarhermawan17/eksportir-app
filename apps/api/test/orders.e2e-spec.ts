import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { ChatMessageView, ConversationView, NotificationsResponse, OrderView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { FxService } from '../src/fx/fx.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "orders-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The exchange rate is faked (not written to the database), because the rate table is shared with other specs running in parallel.
describe('Orders: request, snapshots, visibility (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'buyer2', 'buyer3', 'seller', 'seller2', 'ops', 'finance', 'outsider'] as const;
  type Who = (typeof names)[number];
  const emails = Object.fromEntries(names.map((n) => [n, `orders-e2e-${n}-${stamp}@example.com`])) as Record<Who, string>;
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  let currentRate: { rate: Prisma.Decimal; createdAt: Date } | null = { rate: new Prisma.Decimal('16000'), createdAt: new Date() };
  let qcFeeUsd = '';

  const delivery = { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' };
  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  const order = (who: Who, body: object) => http(who, 'post', '/api/orders').send(body);
  const place = (who: Who, productKey: string, qty: number, extra: object = {}) => order(who, { productId: ids[productKey], qty, delivery, ...extra });

  const makeProduct = async (key: string, sellerProfileId: string, data: { priceIdr: number; moq: number; type?: 'READY_STOCK' | 'MADE_TO_ORDER'; stockQty?: number; status?: 'APPROVED' | 'DRAFT' }) => {
    const type = data.type ?? 'READY_STOCK';
    const product = await prisma.product.create({
      data: {
        sellerId: sellerProfileId,
        type,
        categorySlug: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: data.priceIdr,
        moq: data.moq,
        stockQty: type === 'READY_STOCK' ? (data.stockQty ?? 100) : null,
        leadTimeDays: type === 'MADE_TO_ORDER' ? 14 : null,
        sourceLocale: 'en',
        status: data.status ?? 'APPROVED',
        translations: { create: [{ locale: 'en', title: `Order product ${key}`, description: 'Description' }] },
      },
    });
    ids[key] = product.id;
  };

  beforeAll(async () => {
    const fakeFx = { latest: async () => currentRate };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FxService).useValue(fakeFx).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword('correct-horse-battery');
    const zone = await prisma.qcZone.findFirstOrThrow();
    qcFeeUsd = zone.feeUsd.toFixed(2);
    const make = async (key: Who, name: string, roles: Role[], shop?: string) => {
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
    await make('buyer', 'Anna Buyer', [Role.BUYER]);
    await make('buyer2', 'Boris Buyer', [Role.BUYER]);
    await make('buyer3', 'Clara Buyer', [Role.BUYER]);
    await make('seller', 'Seller Person', [Role.SELLER, Role.BUYER], 'Order Shop'); // also a buyer, to test "own product"
    await make('seller2', 'Other Seller', [Role.SELLER], 'Other Shop');
    await make('ops', 'Ops Admin', [Role.ADMIN_OPS]);
    await make('finance', 'Finance Admin', [Role.ADMIN_FINANCE]);
    await make('outsider', 'Outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);

    await makeProduct('ready', ids['sellerProfile']!, { priceIdr: 160000, moq: 5, stockQty: 100 });
    await makeProduct('made', ids['sellerProfile']!, { priceIdr: 160000, moq: 10, type: 'MADE_TO_ORDER' });
    await makeProduct('cheap', ids['sellerProfile']!, { priceIdr: 100, moq: 1, stockQty: 1000 });
    await makeProduct('draft', ids['sellerProfile']!, { priceIdr: 160000, moq: 1, status: 'DRAFT' });
    await makeProduct('other', ids['seller2Profile']!, { priceIdr: 160000, moq: 1 });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'orders-e2e-' } } });
    await app.close();
  });

  it('requires a login for every route (401)', async () => {
    const server = request(app.getHttpServer());
    await server.post('/api/orders').send({}).expect(401);
    await server.get('/api/orders').expect(401);
    await server.get('/api/orders/x').expect(401);
  });

  describe('placing an order', () => {
    let first: OrderView;

    it('creates an order request with prices, rate and QC fee copied from that moment', async () => {
      const res = await place('buyer', 'ready', 7, { note: 'Size: 3 M, 4 L' }).expect(201);
      first = res.body as OrderView;
      expect(first).toMatchObject({
        status: 'REQUESTED',
        viewer: 'BUYER',
        buyer: { id: ids['buyer'], name: 'Anna Buyer' },
        seller: { id: ids['sellerProfile'], displayName: 'Order Shop' },
        item: { productId: ids['ready'], title: 'Order product ready', unit: 'PCS', qty: 7, unitPriceIdr: 160000, unitPriceUsd: '10.00', note: 'Size: 3 M, 4 L', sellerResponse: 'PENDING', proposedQty: null },
        fxRate: '16000.0000',
        delivery,
      });
      expect(first.code).toMatch(/^OR-\d{4,}$/);
      const total = new Prisma.Decimal('70.00').add(qcFeeUsd).toFixed(2);
      expect(first.totals).toEqual({ itemsUsd: '70.00', qcFeeUsd, totalUsd: total });
      expect(first.conversationId).toEqual(expect.any(String));
    });

    it('numbers orders one after another', async () => {
      const second = (await place('buyer2', 'ready', 5).expect(201)).body as OrderView;
      expect(Number(second.code.slice(3))).toBeGreaterThan(Number(first.code.slice(3)));
    });

    it('is not changed by later changes of the product price or the exchange rate', async () => {
      await prisma.product.update({ where: { id: ids['ready']! }, data: { priceIdr: 500000 } });
      currentRate = { rate: new Prisma.Decimal('20000'), createdAt: new Date() };
      try {
        const again = (await http('buyer', 'get', `/api/orders/${first.id}`).expect(200)).body as OrderView;
        expect(again.item.unitPriceIdr).toBe(160000);
        expect(again.item.unitPriceUsd).toBe('10.00');
        expect(again.fxRate).toBe('16000.0000');
        expect(again.totals).toEqual(first.totals);
      } finally {
        await prisma.product.update({ where: { id: ids['ready']! }, data: { priceIdr: 160000 } });
        currentRate = { rate: new Prisma.Decimal('16000'), createdAt: new Date() };
      }
    });

    it('prices the total as quantity × the unit price rounded to cents (what the buyer saw)', async () => {
      // 100 IDR / 16,000 = $0.00625 → $0.01 per unit; 100 units → $1.00 (not $0.63).
      const res = (await place('buyer', 'cheap', 100).expect(201)).body as OrderView;
      expect(res.item.unitPriceUsd).toBe('0.01');
      expect(res.totals.itemsUsd).toBe('1.00');
    });

    it('accepts made-to-order products without a stock limit, and trims the note', async () => {
      const res = (await place('buyer', 'made', 5000, { note: '  custom logo  ' }).expect(201)).body as OrderView;
      expect(res.item).toMatchObject({ qty: 5000, note: 'custom logo' });
    });
  });

  describe('what is refused', () => {
    it('rejects a quantity below the MOQ or above the stock (400)', async () => {
      await place('buyer', 'ready', 4).expect(400); // MOQ 5
      await place('buyer', 'ready', 101).expect(400); // stock 100
      await place('buyer', 'made', 9).expect(400); // MOQ 10
    });

    it('rejects invalid quantities and fields (400)', async () => {
      for (const qty of [0, -1, 1.5, '7', null, 1_000_001]) {
        await order('buyer', { productId: ids['ready'], qty, delivery }).expect(400);
      }
      await order('buyer', { productId: ids['ready'], delivery }).expect(400); // no qty
      await order('buyer', { productId: ids['ready'], qty: 5 }).expect(400); // no delivery
      await place('buyer', 'ready', 5, { note: 'x'.repeat(501) }).expect(400);
      await place('buyer', 'ready', 5, { unexpected: true }).expect(400);
      await place('buyer', 'ready', 5, { delivery: { ...delivery, country: 'FR' } }).expect(400);
      await place('buyer', 'ready', 5, { delivery: { ...delivery, phone: 'abc' } }).expect(400);
      await place('buyer', 'ready', 5, { delivery: { ...delivery, address: 'short' } }).expect(400);
      await place('buyer', 'ready', 5, { delivery: { ...delivery, fullName: 'A' } }).expect(400);
      await place('buyer', 'ready', 5, { delivery: { ...delivery, role: 'x' } }).expect(400);
    });

    it('rejects the seller of the product, and users who are not buyers (403)', async () => {
      await place('seller', 'ready', 5).expect(403);
      await place('ops', 'ready', 5).expect(403);
    });

    it('answers 404 for drafts, unknown products and products of unapproved sellers', async () => {
      await place('buyer', 'draft', 1).expect(404);
      await order('buyer', { productId: 'does-not-exist', qty: 1, delivery }).expect(404);
      await prisma.sellerProfile.update({ where: { id: ids['seller2Profile']! }, data: { status: 'PENDING' } });
      try {
        await place('buyer', 'other', 1).expect(404);
      } finally {
        await prisma.sellerProfile.update({ where: { id: ids['seller2Profile']! }, data: { status: 'APPROVED' } });
      }
    });

    it('refuses to price an order while no exchange rate is set (409)', async () => {
      const saved = currentRate;
      currentRate = null;
      try {
        const res = await place('buyer', 'ready', 5).expect(409);
        expect(res.body.message).toMatch(/exchange rate/i);
      } finally {
        currentRate = saved;
      }
    });
  });

  describe('the order chat and the seller notification', () => {
    let placed: OrderView;
    let chat: ConversationView;

    beforeAll(async () => {
      placed = (await place('buyer2', 'ready', 6).expect(201)).body as OrderView;
      chat = (await http('buyer2', 'get', `/api/conversations/${placed.conversationId}`).expect(200)).body as ConversationView;
    });

    it('creates a conversation of the order, not of a product, with a system message first', async () => {
      expect(chat).toMatchObject({ type: 'ORDER', product: null, order: { id: placed.id, code: placed.code }, buyer: { id: ids['buyer2'] }, seller: { id: ids['sellerProfile'] } });
      expect(chat.lastMessage).toMatchObject({ senderRole: 'SYSTEM' });
      const messages = (await http('buyer2', 'get', `/api/conversations/${placed.conversationId}/messages`).expect(200)).body as ChatMessageView[];
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({ sender: { id: null, name: 'BaliTrade', role: 'SYSTEM' } });
      expect(messages[0]!.body).toContain(placed.code);
      expect(messages[0]!.body).toContain('6 ×');
      expect(messages[0]!.body).toContain('$10.00');
    });

    it('is open to the buyer, the seller and ops/owner-style moderators; others get 404', async () => {
      for (const who of ['buyer2', 'seller', 'ops'] as const) await http(who, 'get', `/api/conversations/${placed.conversationId}`).expect(200);
      for (const who of ['buyer', 'seller2', 'finance', 'outsider'] as const) await http(who, 'get', `/api/conversations/${placed.conversationId}`).expect(404);
    });

    it('buyer and seller can write in it', async () => {
      await http('buyer2', 'post', `/api/conversations/${placed.conversationId}/messages`).send({ body: 'Hello, any news?' }).expect(201);
      await http('seller', 'post', `/api/conversations/${placed.conversationId}/messages`).send({ body: 'Checking stock now.' }).expect(201);
    });

    it('notifies the seller of the request (and only that: the system message makes no chat notification)', async () => {
      const seller = (await http('seller', 'get', '/api/notifications').expect(200)).body as NotificationsResponse;
      const requests = seller.items.filter((item) => item.type === 'ORDER_REQUESTED');
      const mine = requests.find((item) => item.payload.orderId === placed.id);
      expect(mine).toMatchObject({ readAt: null, payload: { code: placed.code, buyerName: 'Boris Buyer', qty: 6, productTitle: 'Order product ready' } });
      // Not duplicated by a chat notification for the system message: the only chat notification comes from the buyer's real message.
      const chatNotifications = seller.items.filter((item) => item.type === 'CHAT_MESSAGE' && item.payload.conversationId === placed.conversationId);
      expect(chatNotifications).toHaveLength(1);
      expect(chatNotifications[0]!.payload).toMatchObject({ senderName: 'Boris Buyer', preview: 'Hello, any news?' });
      const buyer = (await http('buyer2', 'get', '/api/notifications').expect(200)).body as NotificationsResponse;
      expect(buyer.items.some((item) => item.type === 'ORDER_REQUESTED')).toBe(false);
    });
  });

  describe('who sees which orders', () => {
    let placed: OrderView;

    beforeAll(async () => {
      placed = (await place('buyer3', 'other', 2).expect(201)).body as OrderView;
    });

    const idsOf = async (who: Who) => ((await http(who, 'get', '/api/orders').expect(200)).body as OrderView[]).map((o) => o.id);

    it('lists orders for their buyer, their seller and every admin role only', async () => {
      expect(await idsOf('buyer3')).toContain(placed.id);
      expect(await idsOf('seller2')).toContain(placed.id);
      expect(await idsOf('ops')).toContain(placed.id);
      expect(await idsOf('finance')).toContain(placed.id);
      for (const who of ['buyer', 'buyer2', 'seller', 'outsider'] as const) expect(await idsOf(who)).not.toContain(placed.id);
    });

    it('shows the delivery address to the buyer and admins, never to the seller', async () => {
      for (const who of ['buyer3', 'ops', 'finance'] as const) {
        const view = (await http(who, 'get', `/api/orders/${placed.id}`).expect(200)).body as OrderView;
        expect(view.delivery).toEqual(delivery);
      }
      const seller = await http('seller2', 'get', `/api/orders/${placed.id}`).expect(200);
      expect(seller.body.viewer).toBe('SELLER');
      expect(seller.body.delivery).toBeNull();
      expect(JSON.stringify(seller.body)).not.toContain('Tverskaya');
      expect(JSON.stringify(seller.body)).not.toContain('+7 900');
      // The list is built the same way.
      const sellerList = (await http('seller2', 'get', '/api/orders').expect(200)).body as OrderView[];
      expect(JSON.stringify(sellerList)).not.toContain('Tverskaya');
    });

    it('labels the viewer, and answers 404 for people outside the order', async () => {
      expect(((await http('buyer3', 'get', `/api/orders/${placed.id}`)).body as OrderView).viewer).toBe('BUYER');
      expect(((await http('ops', 'get', `/api/orders/${placed.id}`)).body as OrderView).viewer).toBe('ADMIN');
      for (const who of ['buyer', 'seller', 'outsider'] as const) await http(who, 'get', `/api/orders/${placed.id}`).expect(404);
      await http('buyer3', 'get', '/api/orders/does-not-exist').expect(404);
    });
  });

  it('limits one buyer to 20 order requests per hour (429)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) statuses.push((await place('outsider', 'made', 10)).status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(20);
    expect(statuses[20]).toBe(429);
    await place('buyer', 'made', 10).expect(201); // another buyer is not affected
  });
});
