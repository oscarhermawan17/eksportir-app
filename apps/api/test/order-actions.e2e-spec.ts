import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { ChatMessageView, NotificationsResponse, OrderView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { FxService } from '../src/fx/fx.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "orderact-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The exchange rate is faked (16,000 IDR per USD), because the rate table is shared with other specs running in parallel.
describe('Order actions: accept, decline, propose a change, cancel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'buyer2', 'seller', 'seller2', 'ops', 'finance', 'outsider'] as const;
  type Who = (typeof names)[number];
  const emails = Object.fromEntries(names.map((n) => [n, `orderact-e2e-${n}-${stamp}@example.com`])) as Record<Who, string>;
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  let qcFeeUsd = '';

  const delivery = { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' };
  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  /** A fresh order of 7 pieces at $10.00 each ($70.00) from `who`. */
  const makeOrder = async (who: Who = 'buyer', qty = 7): Promise<OrderView> =>
    (await http(who, 'post', '/api/orders').send({ productId: ids['product'], qty, delivery }).expect(201)).body as OrderView;
  const act = (who: Who, orderId: string, path: 'accept' | 'decline' | 'propose-change' | 'accept-change' | 'cancel', body: object = {}) =>
    http(who, 'post', `/api/orders/${orderId}/${path}`).send(body);
  const view = async (who: Who, orderId: string) => (await http(who, 'get', `/api/orders/${orderId}`).expect(200)).body as OrderView;
  const systemMessages = async (who: Who, order: OrderView) =>
    ((await http(who, 'get', `/api/conversations/${order.conversationId}/messages`).expect(200)).body as ChatMessageView[]).filter((m) => m.sender.role === 'SYSTEM');
  const statusNotifications = async (who: Who, orderId: string) =>
    ((await http(who, 'get', '/api/notifications').expect(200)).body as NotificationsResponse).items.filter(
      (item) => item.type === 'ORDER_STATUS' && item.payload.orderId === orderId,
    );

  beforeAll(async () => {
    const fakeFx = { latest: async () => ({ rate: new Prisma.Decimal('16000'), createdAt: new Date() }) };
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
    await make('seller', 'Seller Person', [Role.SELLER], 'Action Shop');
    await make('seller2', 'Other Seller', [Role.SELLER], 'Other Shop');
    await make('ops', 'Ops Admin', [Role.ADMIN_OPS]);
    await make('finance', 'Finance Admin', [Role.ADMIN_FINANCE]);
    await make('outsider', 'Outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);

    const product = await prisma.product.create({
      data: {
        sellerId: ids['sellerProfile']!,
        type: 'READY_STOCK',
        category: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 160000,
        moq: 5,
        stockQty: 100,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: { create: [{ locale: 'en', title: 'Action basket', description: 'Description' }] },
      },
    });
    ids['product'] = product.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'orderact-e2e-' } } });
    await app.close();
  });

  it('requires a login for every action route (401)', async () => {
    const server = request(app.getHttpServer());
    for (const path of ['accept', 'decline', 'propose-change', 'accept-change', 'cancel']) {
      await server.post(`/api/orders/x/${path}`).send({}).expect(401);
    }
  });

  describe('the seller answers a request', () => {
    it('accepts: the order goes to AWAITING_PAYMENT and the buyer is told', async () => {
      const order = await makeOrder();
      expect(order.actions).toEqual(['CANCEL']); // the buyer of a requested order can only cancel it
      expect((await view('seller', order.id)).actions).toEqual(['ACCEPT', 'DECLINE', 'PROPOSE_CHANGE']);

      const res = await act('seller', order.id, 'accept').expect(201);
      const accepted = res.body as OrderView;
      expect(accepted).toMatchObject({ status: 'AWAITING_PAYMENT', viewer: 'SELLER', item: { sellerResponse: 'ACCEPTED', qty: 7 }, proposal: null });
      expect(accepted.actions).toEqual([]);
      expect((await view('buyer', order.id)).actions).toEqual(['CANCEL']);

      const messages = await systemMessages('buyer', order);
      expect(messages[messages.length - 1]!.body).toContain(`Seller accepted order ${order.code}`);
      const buyerNotes = await statusNotifications('buyer', order.id);
      expect(buyerNotes).toHaveLength(1);
      expect(buyerNotes[0]).toMatchObject({ readAt: null, payload: { code: order.code, status: 'AWAITING_PAYMENT', productTitle: 'Action basket', qty: 7 } });
      expect(await statusNotifications('seller', order.id)).toHaveLength(0); // you are not told about your own action
    });

    it('declines with a reason: DECLINED, the reason is in the chat, and the order has ended', async () => {
      const order = await makeOrder();
      const declined = (await act('seller', order.id, 'decline', { reason: '  Out of stock this month  ' }).expect(201)).body as OrderView;
      expect(declined).toMatchObject({ status: 'DECLINED', item: { sellerResponse: 'DECLINED' } });
      const messages = await systemMessages('seller', order);
      expect(messages[messages.length - 1]!.body).toBe(`Seller declined order ${order.code}. Reason: Out of stock this month`);
      expect((await statusNotifications('buyer', order.id))[0]).toMatchObject({ payload: { status: 'DECLINED' } });
      expect((await view('buyer', order.id)).actions).toEqual([]);
      await act('buyer', order.id, 'cancel').expect(409); // an ended order cannot be cancelled
      await act('seller', order.id, 'accept').expect(409);
    });

    it('declines without a reason, and ignores an empty one', async () => {
      const order = await makeOrder();
      await act('seller', order.id, 'decline', { reason: '   ' }).expect(201);
      const messages = await systemMessages('buyer', order);
      expect(messages[messages.length - 1]!.body).toBe(`Seller declined order ${order.code}.`);
    });

    it('proposes a lower quantity: CHANGE_PROPOSED with the new totals, and the buyer decides', async () => {
      const order = await makeOrder();
      const proposed = (await act('seller', order.id, 'propose-change', { qty: 3, reason: 'Only 3 left' }).expect(201)).body as OrderView;
      expect(proposed).toMatchObject({
        status: 'CHANGE_PROPOSED',
        item: { qty: 7, proposedQty: 3, sellerResponse: 'CHANGE_PROPOSED' },
        proposal: { qty: 3, itemsUsd: '30.00', totalUsd: new Prisma.Decimal('30.00').add(qcFeeUsd).toFixed(2) },
      });
      expect(proposed.totals.itemsUsd).toBe('70.00'); // the order itself is unchanged until the buyer accepts
      expect(proposed.actions).toEqual(['DECLINE', 'PROPOSE_CHANGE']);
      expect((await view('buyer', order.id)).actions).toEqual(['ACCEPT_CHANGE', 'CANCEL']);

      const messages = await systemMessages('buyer', order);
      expect(messages[messages.length - 1]!.body).toContain('3 instead of 7');
      expect(messages[messages.length - 1]!.body).toContain('$30.00');
      expect(messages[messages.length - 1]!.body).toContain('Reason: Only 3 left');
      expect((await statusNotifications('buyer', order.id))[0]).toMatchObject({ payload: { status: 'CHANGE_PROPOSED', qty: 3 } });
    });

    it('refuses a proposal that is not lower, not a whole number, or invalid (400)', async () => {
      const order = await makeOrder();
      for (const body of [{ qty: 7 }, { qty: 8 }, { qty: 0 }, { qty: -1 }, { qty: 1.5 }, { qty: '3' }, {}, { qty: 3, reason: 'x'.repeat(501) }, { qty: 3, extra: true }, { qty: 3, reason: 5 }]) {
        await act('seller', order.id, 'propose-change', body).expect(400);
      }
      expect((await view('seller', order.id)).status).toBe('REQUESTED'); // nothing changed
    });

    it('lets the seller revise the proposal, or withdraw it', async () => {
      const order = await makeOrder();
      await act('seller', order.id, 'propose-change', { qty: 4 }).expect(201);
      const revised = (await act('seller', order.id, 'propose-change', { qty: 2 }).expect(201)).body as OrderView;
      expect(revised).toMatchObject({ status: 'CHANGE_PROPOSED', proposal: { qty: 2, itemsUsd: '20.00' } });
      const withdrawn = (await act('seller', order.id, 'decline', { reason: 'Cannot supply any' }).expect(201)).body as OrderView;
      expect(withdrawn).toMatchObject({ status: 'DECLINED', proposal: null, item: { proposedQty: null } });
    });
  });

  describe('the buyer decides', () => {
    it('accepts the change: the quantity and the total follow, the unit price and rate do not, and the seller is told', async () => {
      const order = await makeOrder();
      await act('seller', order.id, 'propose-change', { qty: 3 }).expect(201);
      const accepted = (await act('buyer', order.id, 'accept-change').expect(201)).body as OrderView;
      expect(accepted).toMatchObject({
        status: 'AWAITING_PAYMENT',
        viewer: 'BUYER',
        item: { qty: 3, proposedQty: null, sellerResponse: 'ACCEPTED', unitPriceUsd: '10.00', unitPriceIdr: 160000 },
        proposal: null,
        fxRate: '16000.0000',
      });
      expect(accepted.totals).toEqual({ itemsUsd: '30.00', qcFeeUsd, totalUsd: new Prisma.Decimal('30.00').add(qcFeeUsd).toFixed(2) });
      const messages = await systemMessages('seller', order);
      expect(messages[messages.length - 1]!.body).toContain('Buyer accepted the change');
      expect(messages[messages.length - 1]!.body).toContain('3 × Action basket');
      expect((await statusNotifications('seller', order.id))[0]).toMatchObject({ payload: { status: 'AWAITING_PAYMENT', qty: 3 } });
    });

    it('cancels from every open status, with an optional reason, and the seller is told', async () => {
      const requested = await makeOrder();
      const cancelled = (await act('buyer', requested.id, 'cancel', { reason: 'Changed my mind' }).expect(201)).body as OrderView;
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.actions).toEqual([]);
      const messages = await systemMessages('buyer', requested);
      expect(messages[messages.length - 1]!.body).toBe(`Buyer cancelled order ${requested.code}. Reason: Changed my mind`);
      expect((await statusNotifications('seller', requested.id))[0]).toMatchObject({ payload: { status: 'CANCELLED' } });

      const proposed = await makeOrder();
      await act('seller', proposed.id, 'propose-change', { qty: 5 }).expect(201);
      expect(((await act('buyer', proposed.id, 'cancel').expect(201)).body as OrderView).status).toBe('CANCELLED');

      const awaiting = await makeOrder();
      await act('seller', awaiting.id, 'accept').expect(201);
      expect(((await act('buyer', awaiting.id, 'cancel').expect(201)).body as OrderView).status).toBe('CANCELLED');
    });
  });

  describe('who may do what', () => {
    let order: OrderView;
    beforeAll(async () => {
      order = await makeOrder();
    });

    it('answers 403 to a participant of the wrong side', async () => {
      for (const path of ['accept', 'decline'] as const) await act('buyer', order.id, path).expect(403);
      await act('buyer', order.id, 'propose-change', { qty: 3 }).expect(403);
      await act('seller', order.id, 'cancel').expect(403);
      await act('seller', order.id, 'accept-change').expect(403);
    });

    it('answers 403 to admins (they read orders but do not act on them)', async () => {
      for (const who of ['ops', 'finance'] as const) {
        for (const path of ['accept', 'decline', 'cancel', 'accept-change'] as const) await act(who, order.id, path).expect(403);
        await act(who, order.id, 'propose-change', { qty: 3 }).expect(403);
      }
      const adminView = await view('ops', order.id);
      expect(adminView).toMatchObject({ viewer: 'ADMIN', actions: [] });
    });

    it('answers 404 to people outside the order, and for unknown orders', async () => {
      for (const who of ['outsider', 'buyer2', 'seller2'] as const) {
        for (const path of ['accept', 'decline', 'propose-change', 'accept-change', 'cancel'] as const) {
          await act(who, order.id, path, path === 'propose-change' ? { qty: 3 } : {}).expect(404);
        }
      }
      await act('seller', 'does-not-exist', 'accept').expect(404);
      expect((await view('seller', order.id)).status).toBe('REQUESTED'); // nothing above changed it
    });
  });

  describe('state and races', () => {
    it('answers 409 when the action does not fit the current status', async () => {
      const order = await makeOrder();
      await act('buyer', order.id, 'accept-change').expect(409); // nothing proposed yet
      await act('seller', order.id, 'accept').expect(201);
      await act('seller', order.id, 'accept').expect(409); // twice
      await act('seller', order.id, 'decline').expect(409);
      await act('seller', order.id, 'propose-change', { qty: 3 }).expect(409);
      await act('buyer', order.id, 'accept-change').expect(409);

      const proposed = await makeOrder();
      await act('seller', proposed.id, 'propose-change', { qty: 3 }).expect(201);
      await act('seller', proposed.id, 'accept').expect(409); // the seller cannot accept their own proposal
    });

    it('lets only one of two simultaneous answers win', async () => {
      const order = await makeOrder();
      const [accept, decline] = await Promise.all([act('seller', order.id, 'accept'), act('seller', order.id, 'decline')]);
      expect([accept.status, decline.status].sort()).toEqual([201, 409]);
      const final = (await view('buyer', order.id)).status;
      expect(final).toBe(accept.status === 201 ? 'AWAITING_PAYMENT' : 'DECLINED');
      // exactly one system message about the answer, not two
      const answers = (await systemMessages('buyer', order)).filter((m) => /accepted|declined/.test(m.body));
      expect(answers).toHaveLength(1);
    });

    it('keeps the order chat usable after every step', async () => {
      const order = await makeOrder('buyer2');
      await act('seller', order.id, 'propose-change', { qty: 5 }).expect(201);
      await act('buyer2', order.id, 'accept-change').expect(201);
      await http('buyer2', 'post', `/api/conversations/${order.conversationId}/messages`).send({ body: 'Thanks, I will pay soon.' }).expect(201);
      const all = (await http('seller', 'get', `/api/conversations/${order.conversationId}/messages`).expect(200)).body as ChatMessageView[];
      expect(all.map((m) => m.sender.role)).toEqual(['SYSTEM', 'SYSTEM', 'SYSTEM', 'BUYER']); // request, proposal, acceptance, then the buyer's own words
    });
  });
});
