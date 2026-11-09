import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { ChatMessageView, OrderView, PaymentInstructions, PaymentSummary, PaymentView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { hashPassword } from '../src/common/password.js';
import { FxService } from '../src/fx/fx.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "payments-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// The exchange rate is faked (16,000 IDR per USD) because the rate table is shared with the specs running in parallel.
describe('Payments: three methods, FINANCE verification (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'finance', 'ops', 'outsider'] as const;
  type Who = (typeof names)[number];
  const emails = Object.fromEntries(names.map((n) => [n, `payments-e2e-${n}-${stamp}@example.com`])) as Record<Who, string>;
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();

  const delivery = { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' };
  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  /** A proof file key as media.service.ts would hand it out: the uploader's id is part of the key. */
  const proofOf = (who: Who) => `private/${ids[who]}/00000000-0000-4000-8000-00000000000${names.indexOf(who)}.jpg`;

  /** An order already accepted by the seller, so it waits for money ($70.00 of goods + the QC fee). */
  const payableOrder = async (): Promise<OrderView> => {
    const created = (await http('buyer', 'post', '/api/orders').send({ productId: ids['product'], qty: 7, delivery }).expect(201)).body as OrderView;
    await http('seller', 'post', `/api/orders/${created.id}/accept`).expect(201);
    return (await http('buyer', 'get', `/api/orders/${created.id}`).expect(200)).body as OrderView;
  };
  const summary = async (who: Who, orderId: string) => (await http(who, 'get', `/api/orders/${orderId}/payments`).expect(200)).body as PaymentSummary;
  const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
  const systemMessages = async (order: OrderView) =>
    ((await http('buyer', 'get', `/api/conversations/${order.conversationId}/messages`).expect(200)).body as ChatMessageView[]).filter(
      (message) => message.sender.role === 'SYSTEM',
    );

  /** A rupiah payment the buyer says they sent. 1,120,000 IDR is $70.00 at the faked rate. */
  const bankBody = (who: Who = 'buyer', amount = 1_120_000) => ({
    method: 'BANK_IDR',
    amount,
    proofKey: proofOf(who),
    senderName: 'Anna Ivanova',
  });

  beforeAll(async () => {
    const fakeFx = { latest: async () => ({ rate: new Prisma.Decimal('16000'), createdAt: new Date() }) };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(FxService).useValue(fakeFx).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword('correct-horse-battery');
    const zone = await prisma.qcZone.findFirstOrThrow();
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
    await make('seller', 'Seller Person', [Role.SELLER], 'Payment Shop');
    await make('finance', 'Finance Admin', [Role.ADMIN_FINANCE]);
    await make('ops', 'Ops Admin', [Role.ADMIN_OPS]);
    await make('outsider', 'Outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);

    const product = await prisma.product.create({
      data: {
        sellerId: ids['sellerProfile']!,
        type: 'READY_STOCK',
        category: 'HANDICRAFTS',
        unit: 'PCS',
        priceIdr: 160_000,
        moq: 5,
        stockQty: 1000,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: { create: [{ locale: 'en', title: 'Payment basket', description: 'Description' }] },
      },
    });
    ids['product'] = product.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'payments-e2e-' } } });
    await app.close();
  });

  it('every payment route needs a login (401)', async () => {
    const server = request(app.getHttpServer());
    await server.get('/api/payments/instructions').expect(401);
    await server.get('/api/orders/x/payments').expect(401);
    await server.post('/api/orders/x/payments').send(bankBody()).expect(401);
    await server.get('/api/admin/payments').expect(401);
    await server.post('/api/admin/payments/x/verify').expect(401);
    await server.post('/api/admin/orders/x/confirm-paid').expect(401);
  });

  it('instructions only contain methods that are fully configured', async () => {
    const instructions = (await http('buyer', 'get', '/api/payments/instructions').expect(200)).body as PaymentInstructions;
    for (const method of [instructions.bank, instructions.usdt, instructions.exchange]) {
      // A method is either absent or complete: no half-filled instruction ever reaches a buyer.
      if (method !== null) expect(Object.values(method).every((value) => value !== '')).toBe(true);
    }
    expect(typeof instructions.mock).toBe('boolean');
  });

  describe('the buyer sends money', () => {
    it('records the payment, moves the order to PAYMENT_SUBMITTED and says so in the order chat', async () => {
      const order = await payableOrder();
      const after = (await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201)).body as PaymentSummary;

      expect(after.payments).toHaveLength(1);
      expect(after.payments[0]).toMatchObject({ method: 'BANK_IDR', status: 'SUBMITTED', amountIdr: 1_120_000, amountUsd: '70.00' });
      expect(after.submittedCount).toBe(1);
      // Nothing is counted before an admin has seen it.
      expect(after.verifiedUsd).toBe('0.00');
      expect(after.dueUsd).toBe(order.totals.totalUsd);
      expect(await statusOf(order.id)).toBe('PAYMENT_SUBMITTED');

      const messages = await systemMessages(order);
      expect(messages.at(-1)?.body).toContain('submitted a payment');
      expect(messages.at(-1)?.body).toContain('1,120,000');
    });

    it('converts rupiah at the order\'s own locked rate, not at today\'s', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody('buyer', 800_000)).expect(201);
      const [payment] = (await summary('buyer', order.id)).payments;
      // 800,000 / 16,000 = 50.00, the rate stored on the order.
      expect(payment?.amountUsd).toBe('50.00');
      expect(order.fxRate).toBe('16000.0000');
    });

    it('keeps USDT in USD and asks for the transaction hash instead of a sender name', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`)
        .send({ method: 'USDT', amount: 70, proofKey: proofOf('buyer') })
        .expect(400);
      const after = (
        await http('buyer', 'post', `/api/orders/${order.id}/payments`)
          .send({ method: 'USDT', amount: 70, proofKey: proofOf('buyer'), txHash: '0x' + 'a'.repeat(40) })
          .expect(201)
      ).body as PaymentSummary;
      expect(after.payments[0]).toMatchObject({ method: 'USDT', amountUsd: '70.00', amountIdr: null });
    });

    it('an exchange payment needs both the exchange and its transfer reference', async () => {
      const order = await payableOrder();
      const body = { method: 'EXCHANGE', amount: 1_120_000, proofKey: proofOf('buyer') };
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(body).expect(400);
      // Without the reference the incoming rupiah cannot be matched: it arrives from the exchange, not the buyer.
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send({ ...body, exchangeName: 'Bali Exchange' }).expect(400);
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send({ ...body, exchangeName: 'Bali Exchange', reference: 'EX-77' }).expect(201);
      const [payment] = (await summary('buyer', order.id)).payments;
      expect(payment).toMatchObject({ method: 'EXCHANGE', exchangeName: 'Bali Exchange', reference: 'EX-77' });
    });

    it('refuses a proof file that belongs to somebody else', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody('outsider')).expect(400);
      expect((await summary('buyer', order.id)).payments).toHaveLength(0);
    });

    it('refuses an amount that is clearly a typo', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody('buyer', 500)).expect(400);
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send({ ...bankBody(), amount: 0 }).expect(400);
    });

    it('is only possible while the order waits for money, and only for its own buyer', async () => {
      const order = await payableOrder();
      await http('outsider', 'post', `/api/orders/${order.id}/payments`).send(bankBody('outsider')).expect(404);
      await http('seller', 'post', `/api/orders/${order.id}/payments`).send(bankBody('seller')).expect(404);

      const fresh = (await http('buyer', 'post', '/api/orders').send({ productId: ids['product'], qty: 7, delivery }).expect(201)).body as OrderView;
      // Still REQUESTED: the seller has not accepted it yet.
      await http('buyer', 'post', `/api/orders/${fresh.id}/payments`).send(bankBody()).expect(409);
    });

    it('the seller never sees the money of an order', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      // Sellers are paid by BaliTrade (T20), so a buyer's proof is none of their business.
      await http('seller', 'get', `/api/orders/${order.id}/payments`).expect(404);
      await http('outsider', 'get', `/api/orders/${order.id}/payments`).expect(404);
      await http('finance', 'get', `/api/orders/${order.id}/payments`).expect(200);
    });
  });

  describe('a FINANCE admin decides', () => {
    it('verifying one payment records it but does not move the order by itself', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [waiting] = (await summary('finance', order.id)).payments;

      const decided = (await http('finance', 'post', `/api/admin/payments/${waiting!.id}/verify`).expect(201)).body as PaymentView;
      expect(decided).toMatchObject({ status: 'VERIFIED', rejectionReason: null });
      expect(decided.decidedBy?.id).toBe(ids['finance']);
      // Partial payments are allowed, so "this money arrived" is not "the order is paid".
      expect(await statusOf(order.id)).toBe('PAYMENT_SUBMITTED');

      const after = await summary('finance', order.id);
      expect(after.verifiedUsd).toBe('70.00');
      expect(after.submittedCount).toBe(0);
      expect((await systemMessages(order)).at(-1)?.body).toContain('confirmed receiving');
    });

    it('rejecting sends the order back to waiting, keeps the row and lets the buyer try again', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [first] = (await summary('finance', order.id)).payments;

      const rejected = (await http('finance', 'post', `/api/admin/payments/${first!.id}/reject`).send({ reason: 'Not in the statement' }).expect(201))
        .body as PaymentView;
      expect(rejected).toMatchObject({ status: 'REJECTED', rejectionReason: 'Not in the statement' });
      expect(await statusOf(order.id)).toBe('AWAITING_PAYMENT');
      expect((await systemMessages(order)).at(-1)?.body).toContain('Not in the statement');

      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const after = await summary('buyer', order.id);
      // The rejected attempt is history, not something that was overwritten.
      expect(after.payments).toHaveLength(2);
      expect(after.payments.map((payment) => payment.status)).toEqual(['SUBMITTED', 'REJECTED']);
    });

    it('decides each payment once: a second decision answers 409', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [payment] = (await summary('finance', order.id)).payments;
      await http('finance', 'post', `/api/admin/payments/${payment!.id}/verify`).expect(201);
      await http('finance', 'post', `/api/admin/payments/${payment!.id}/verify`).expect(409);
      await http('finance', 'post', `/api/admin/payments/${payment!.id}/reject`).expect(409);
    });

    it('is closed to everyone but FINANCE and the owner', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [payment] = (await summary('finance', order.id)).payments;
      for (const who of ['buyer', 'seller', 'ops'] as const) {
        await http(who, 'get', '/api/admin/payments').expect(403);
        await http(who, 'post', `/api/admin/payments/${payment!.id}/verify`).expect(403);
        await http(who, 'post', `/api/admin/orders/${order.id}/confirm-paid`).expect(403);
      }
    });

    it('lists the payments waiting for a decision', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const waiting = (await http('finance', 'get', '/api/admin/payments?status=SUBMITTED').expect(200)).body as PaymentView[];
      const mine = waiting.filter((payment) => payment.orderId === order.id);
      expect(mine).toHaveLength(1);
      expect(mine[0]?.orderCode).toBe(order.code);
      expect(mine[0]?.submittedBy.id).toBe(ids['buyer']);
    });
  });

  describe('partial payments and the way to quality control', () => {
    it('accepts half now and the rest later, counting only what was verified', async () => {
      const order = await payableOrder();
      const due = Number(order.totals.totalUsd);

      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody('buyer', 560_000)).expect(201);
      const [half] = (await summary('finance', order.id)).payments;
      await http('finance', 'post', `/api/admin/payments/${half!.id}/verify`).expect(201);

      const midway = await summary('buyer', order.id);
      expect(midway.verifiedUsd).toBe('35.00');
      expect(Number(midway.remainingUsd)).toBeCloseTo(due - 35, 2);

      // The buyer can keep paying while the order is still in PAYMENT_SUBMITTED.
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody('buyer', 560_000)).expect(201);
      const [rest] = (await summary('finance', order.id)).payments;
      await http('finance', 'post', `/api/admin/payments/${rest!.id}/verify`).expect(201);
      expect((await summary('buyer', order.id)).verifiedUsd).toBe('70.00');
    });

    it('only the admin\'s confirmation reaches PAYMENT_VERIFIED, and quality control is a separate step', async () => {
      const order = await payableOrder();
      // Nothing verified yet: confirming would be a mis-click.
      await http('finance', 'post', `/api/admin/orders/${order.id}/confirm-paid`).expect(409);

      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [payment] = (await summary('finance', order.id)).payments;
      await http('finance', 'post', `/api/admin/payments/${payment!.id}/verify`).expect(201);

      await http('finance', 'post', `/api/admin/orders/${order.id}/confirm-paid`).expect(201);
      expect(await statusOf(order.id)).toBe('PAYMENT_VERIFIED');
      expect((await systemMessages(order)).at(-1)?.body).toContain('quality control');

      // Starting QC belongs to OPS, not to the admin who handled the money.
      await http('finance', 'post', `/api/admin/orders/${order.id}/start-qc`).expect(403);
      await http('ops', 'post', `/api/admin/orders/${order.id}/start-qc`).expect(201);
      expect(await statusOf(order.id)).toBe('IN_QC');

      // And once it is in QC the buyer cannot pay into it any more.
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(409);
      await http('finance', 'post', `/api/admin/orders/${order.id}/confirm-paid`).expect(409);
    });

    it('two admins confirming at the same time: the second one gets 409, not a double transition', async () => {
      const order = await payableOrder();
      await http('buyer', 'post', `/api/orders/${order.id}/payments`).send(bankBody()).expect(201);
      const [payment] = (await summary('finance', order.id)).payments;
      await http('finance', 'post', `/api/admin/payments/${payment!.id}/verify`).expect(201);

      const [first, second] = await Promise.all([
        http('finance', 'post', `/api/admin/orders/${order.id}/confirm-paid`),
        http('finance', 'post', `/api/admin/orders/${order.id}/confirm-paid`),
      ]);
      expect([first.status, second.status].sort()).toEqual([201, 409]);
      expect(await statusOf(order.id)).toBe('PAYMENT_VERIFIED');
    });
  });
});
