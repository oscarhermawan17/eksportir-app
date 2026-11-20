import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { PaymentSummary, PaymentView, ShippingBillResponse, TrackingResponse } from '@balitrade/shared';
import request from 'supertest';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

// Signed links are computed offline, so fake R2 settings are enough. The app is imported in beforeAll, after these are
// set, because ConfigModule reads the environment when app.module.js loads.
Object.assign(process.env, {
  R2_ACCOUNT_ID: 'acc123',
  R2_ACCESS_KEY_ID: 'AKIAFAKE',
  R2_SECRET_ACCESS_KEY: 'fake-secret',
  R2_PUBLIC_BUCKET: 'bt-public',
  R2_PRIVATE_BUCKET: 'bt-private',
  R2_PRIVATE_ACCESS_KEY_ID: 'AKIAFAKEPRIVATE',
  R2_PRIVATE_SECRET_ACCESS_KEY: 'fake-private-secret',
  R2_PUBLIC_BASE_URL: 'https://media.example.test',
});

// Test users use the prefix "ship-e2e-" so other spec files' cleanup (running in parallel) leaves them alone. The exchange
// rate is faked (and changed mid-test) because the rate table is shared with the specs running in parallel.
describe('Shipping bill and tracking (T19, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'ops', 'finance', 'outsider'] as const;
  type Who = (typeof names)[number];
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  let fileCounter = 0;
  let currentRate: { rate: Prisma.Decimal; createdAt: Date } | null = { rate: new Prisma.Decimal('16000'), createdAt: new Date() };

  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  const fileOf = (who: Who, ext = 'webp') => `private/${ids[who]}/00000000-0000-4000-8000-${String(++fileCounter).padStart(12, '0')}.${ext}`;
  const bill = (overrides: object = {}) => ({
    lines: [
      { label: 'Air cargo to Moscow', amountUsd: 244 },
      { label: 'Export documents', amountUsd: 20.5 },
    ],
    weightKg: 61.25,
    cartons: 4,
    ...overrides,
  });
  const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
  const lastMessage = async (orderId: string) =>
    (await prisma.message.findFirst({ where: { kind: 'SYSTEM', conversation: { orderId } }, orderBy: { createdAt: 'desc' }, select: { body: true } }))?.body;

  const orderIn = async (status: 'QC_APPROVED' | 'IN_QC'): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        buyerId: ids['buyer']!,
        sellerId: ids['sellerProfile']!,
        status,
        deliveryAddress: { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' },
        fxRate: new Prisma.Decimal('15000'),
        itemsUsd: new Prisma.Decimal('500.00'),
        qcFeeUsd: new Prisma.Decimal('3.00'),
        items: { create: { title: 'Rattan basket', unit: 'PCS', qty: 50, unitPriceIdr: 150000, unitPriceUsd: new Prisma.Decimal('10.00') } },
      },
    });
    await prisma.conversation.create({ data: { type: 'ORDER', buyerId: ids['buyer']!, sellerId: ids['sellerProfile']!, orderId: order.id } });
    return order.id;
  };
  const payShipping = (orderId: string, amountIdr: number) =>
    http('buyer', 'post', `/api/orders/${orderId}/payments`).send({ method: 'BANK_IDR', amount: amountIdr, senderName: 'Anna Ivanova', proofKey: fileOf('buyer', 'jpg') });
  /** An order whose shipping is billed, paid, verified and confirmed. */
  const paidOrder = async (): Promise<string> => {
    const orderId = await orderIn('QC_APPROVED');
    await http('ops', 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(bill()).expect(201);
    const summary = (await payShipping(orderId, 4_248_000).expect(201)).body as PaymentSummary;
    await http('finance', 'post', `/api/admin/payments/${summary.payments[0]!.id}/verify`).expect(201);
    await http('finance', 'post', `/api/admin/orders/${orderId}/confirm-shipping-paid`).expect(201);
    return orderId;
  };

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const { FxService } = await import('../src/fx/fx.service.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FxService)
      .useValue({ latest: async () => currentRate })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: Who, roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: `ship-e2e-${key}-${stamp}@example.com`,
          passwordHash: 'not-used',
          name: `Ship ${key}`,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', [Role.BUYER]);
    await make('seller', [Role.SELLER], 'Ship Test Shop');
    await make('ops', [Role.ADMIN_OPS]);
    await make('finance', [Role.ADMIN_FINANCE]);
    await make('outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'ship-e2e-' } } });
    await app.close();
  });

  it('every shipping route needs a login (401)', async () => {
    const server = request(app.getHttpServer());
    await server.get('/api/orders/x/shipping-bill').expect(401);
    await server.get('/api/orders/x/tracking').expect(401);
    await server.post('/api/admin/orders/x/shipping-bill').expect(401);
    await server.post('/api/admin/orders/x/tracking').expect(401);
    await server.post('/api/admin/orders/x/confirm-shipping-paid').expect(401);
  });

  describe('the shipping bill', () => {
    let orderId: string;

    it('only OPS bills, and only after the buyer approved QC', async () => {
      orderId = await orderIn('QC_APPROVED');
      for (const who of ['finance', 'buyer', 'seller'] as const) {
        await http(who, 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(bill()).expect(403);
      }
      const early = await orderIn('IN_QC');
      await http('ops', 'post', `/api/admin/orders/${early}/shipping-bill`).send(bill()).expect(409);
    });

    it('refuses a total sent by the client, bad lines and someone else’s photo (400)', async () => {
      const send = (body: object) => http('ops', 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(body);
      await send({ ...bill(), totalUsd: 1 }).expect(400);
      await send(bill({ lines: [] })).expect(400);
      await send(bill({ lines: [{ label: 'x', amountUsd: 10 }] })).expect(400);
      await send(bill({ lines: [{ label: 'Air cargo', amountUsd: 10.555 }] })).expect(400);
      await send(bill({ cartons: 0 })).expect(400);
      await send(bill({ photoKey: fileOf('buyer', 'jpg') })).expect(400);
      await send(bill({ photoKey: fileOf('ops', 'mp4') })).expect(400);
      expect(await statusOf(orderId)).toBe('QC_APPROVED');
    });

    it('OPS bills: the server adds up the lines and freezes today’s rate; the buyer is told', async () => {
      const res = await http('ops', 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(bill({ photoKey: fileOf('ops') })).expect(201);
      const { bill: issued } = res.body as ShippingBillResponse;
      expect(issued).toMatchObject({ totalUsd: '264.50', fxRate: '16000.0000', weightKg: '61.25', cartons: 4, revised: false });
      expect(issued!.photoUrl).toContain('X-Amz-Signature=');
      expect(await statusOf(orderId)).toBe('AWAITING_SHIPPING_PAYMENT');
      expect(await lastMessage(orderId)).toContain('Shipping: $264.50');
      expect(await prisma.notification.count({ where: { userId: ids['buyer'], subject: `order:${orderId}` } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: ids['seller'], subject: `order:${orderId}` } })).toBe(0);
    });

    it('the buyer and admins read the bill; the seller and outsiders get 404', async () => {
      for (const who of ['buyer', 'ops', 'finance'] as const) {
        const { bill: read } = (await http(who, 'get', `/api/orders/${orderId}/shipping-bill`).expect(200)).body as ShippingBillResponse;
        expect(read?.totalUsd).toBe('264.50');
      }
      await http('seller', 'get', `/api/orders/${orderId}/shipping-bill`).expect(404);
      await http('outsider', 'get', `/api/orders/${orderId}/shipping-bill`).expect(404);
      await http('seller', 'get', `/api/orders/${orderId}/payments?purpose=SHIPPING`).expect(404);
    });

    it('a revision before any payment is a new bill at the new rate; the old one stays in the database', async () => {
      currentRate = { rate: new Prisma.Decimal('16500'), createdAt: new Date() };
      const { bill: revised } = (await http('ops', 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(bill({ lines: [{ label: 'Air cargo to Moscow', amountUsd: 250 }] })).expect(201))
        .body as ShippingBillResponse;
      expect(revised).toMatchObject({ totalUsd: '250.00', fxRate: '16500.0000', revised: true });
      expect(await prisma.shippingBill.count({ where: { orderId } })).toBe(2);
      expect(await prisma.shippingBill.count({ where: { orderId, supersededAt: null } })).toBe(1);
      expect(await statusOf(orderId)).toBe('AWAITING_SHIPPING_PAYMENT');
    });

    it('the shipping payment uses the bill’s rate, and a changed rate afterwards does not move it', async () => {
      currentRate = { rate: new Prisma.Decimal('99999'), createdAt: new Date() };
      const summary = (await payShipping(orderId, 4_125_000).expect(201)).body as PaymentSummary;
      expect(summary).toMatchObject({ purpose: 'SHIPPING', dueUsd: '250.00', fxRate: '16500.0000', verifiedUsd: '0.00', submittedCount: 1 });
      expect(summary.payments[0]).toMatchObject({ purpose: 'SHIPPING', amountIdr: 4_125_000, amountUsd: '250.00' });
      expect(await statusOf(orderId)).toBe('AWAITING_SHIPPING_PAYMENT');
      // The goods money is a separate summary and untouched.
      const goods = (await http('buyer', 'get', `/api/orders/${orderId}/payments?purpose=GOODS`).expect(200)).body as PaymentSummary;
      expect(goods).toMatchObject({ purpose: 'GOODS', dueUsd: '503.00', fxRate: '15000.0000', submittedCount: 0 });
      currentRate = { rate: new Prisma.Decimal('16000'), createdAt: new Date() };
    });

    it('once money was sent, the bill can no longer be revised (409)', async () => {
      await http('ops', 'post', `/api/admin/orders/${orderId}/shipping-bill`).send(bill()).expect(409);
    });

    it('a rejected shipping proof leaves the order waiting; confirming needs a verified payment and FINANCE', async () => {
      const [submitted] = ((await http('finance', 'get', `/api/orders/${orderId}/payments`).expect(200)).body as PaymentSummary).payments;
      await http('finance', 'post', `/api/admin/orders/${orderId}/confirm-shipping-paid`).expect(409);
      const rejected = (await http('finance', 'post', `/api/admin/payments/${submitted!.id}/reject`).send({ reason: 'Not in the statement' }).expect(201)).body as PaymentView;
      expect(rejected.status).toBe('REJECTED');
      expect(await statusOf(orderId)).toBe('AWAITING_SHIPPING_PAYMENT');
      expect(await lastMessage(orderId)).toContain('(shipping)');

      const again = (await payShipping(orderId, 4_125_000).expect(201)).body as PaymentSummary;
      const fresh = again.payments.find((payment) => payment.status === 'SUBMITTED')!;
      await http('finance', 'post', `/api/admin/payments/${fresh.id}/verify`).expect(201);
      await http('ops', 'post', `/api/admin/orders/${orderId}/confirm-shipping-paid`).expect(403);
      const confirmed = (await http('finance', 'post', `/api/admin/orders/${orderId}/confirm-shipping-paid`).expect(201)).body as PaymentSummary;
      expect(confirmed).toMatchObject({ purpose: 'SHIPPING', verifiedUsd: '250.00', remainingUsd: '0.00' });
      expect(await statusOf(orderId)).toBe('SHIPPING_PAID');
      // Nothing to pay any more.
      await payShipping(orderId, 1_000_000).expect(409);
    });
  });

  describe('tracking', () => {
    it('only OPS records milestones; the hand-over waits for the confirmed shipping money', async () => {
      const orderId = await orderIn('QC_APPROVED');
      await http('finance', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'PACKED' }).expect(403);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'PACKED', note: '4 cartons, taped and labelled' }).expect(201);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'PACKED' }).expect(409);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'HANDED_TO_CARGO', awb: '618-12345675' }).expect(409);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'DELIVERED' }).expect(409);
      expect(await statusOf(orderId)).toBe('QC_APPROVED');
    });

    it('checks the air waybill, the date and the photo (400)', async () => {
      const orderId = await paidOrder();
      const send = (body: object) => http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send(body);
      await send({ milestone: 'HANDED_TO_CARGO' }).expect(400);
      await send({ milestone: 'HANDED_TO_CARGO', awb: '61-812345675' }).expect(400);
      await send({ milestone: 'PACKED', awb: '618-12345675' }).expect(400);
      await send({ milestone: 'HANDED_TO_CARGO', awb: '618-12345675', occurredAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(400);
      await send({ milestone: 'HANDED_TO_CARGO', awb: '618-12345675', occurredAt: '2020-01-01T00:00:00.000Z' }).expect(400);
      await send({ milestone: 'HANDED_TO_CARGO', awb: '618-12345675', photoKey: fileOf('buyer', 'jpg') }).expect(400);
      await send({ milestone: 'BOGUS' }).expect(400);
      expect(await statusOf(orderId)).toBe('SHIPPING_PAID');
    });

    it('hand-over → SHIPPED, steps in transit, delivery → ARRIVED; the seller follows the timeline', async () => {
      const orderId = await paidOrder();
      const before = await prisma.notification.count({ where: { userId: ids['seller'], subject: `order:${orderId}` } });
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'HANDED_TO_CARGO', awb: '61812345675', photoKey: fileOf('ops') }).expect(201);
      expect(await statusOf(orderId)).toBe('SHIPPED');
      expect(await lastMessage(orderId)).toContain('air waybill 618-12345675');
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'CUSTOMS', note: 'Cleared in Moscow' }).expect(201);
      expect(await prisma.notification.count({ where: { userId: ids['seller'], subject: `order:${orderId}` } })).toBe(before + 1);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'DELIVERED' }).expect(201);
      expect(await statusOf(orderId)).toBe('ARRIVED');
      expect(await prisma.notification.count({ where: { userId: ids['seller'], subject: `order:${orderId}` } })).toBe(before + 2);

      const timeline = (await http('seller', 'get', `/api/orders/${orderId}/tracking`).expect(200)).body as TrackingResponse;
      expect(timeline.events.map((event) => event.milestone)).toEqual(['HANDED_TO_CARGO', 'CUSTOMS', 'DELIVERED']);
      expect(timeline.events[0]).toMatchObject({ awb: '618-12345675', createdBy: { id: ids['ops'], name: 'Ship ops' } });
      expect(timeline.events[0]!.photoUrl).toContain('X-Amz-Signature=');
      await http('outsider', 'get', `/api/orders/${orderId}/tracking`).expect(404);
      await http('ops', 'post', `/api/admin/orders/${orderId}/tracking`).send({ milestone: 'DEPARTED_BALI' }).expect(409);
    });
  });
});
