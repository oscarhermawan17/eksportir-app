import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { OrderView } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "done-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
describe('Completing an order (T20, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'ops', 'finance', 'owner', 'outsider'] as const;
  type Who = (typeof names)[number];
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();

  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  const statusOf = async (orderId: string) =>
    prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true, completedAt: true } });
  const lastMessage = async (orderId: string) =>
    (await prisma.message.findFirst({ where: { kind: 'SYSTEM', conversation: { orderId } }, orderBy: { createdAt: 'desc' }, select: { body: true } }))?.body;

  const orderIn = async (status: 'ARRIVED' | 'SHIPPED' | 'DELIVERY_ISSUE'): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        buyerId: ids['buyer']!,
        sellerId: ids['sellerProfile']!,
        status,
        deliveryAddress: { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' },
        fxRate: new Prisma.Decimal('16000'),
        itemsUsd: new Prisma.Decimal('500.00'),
        qcFeeUsd: new Prisma.Decimal('3.00'),
        items: { create: { title: 'Rattan basket', unit: 'PCS', qty: 50, unitPriceIdr: 160000, unitPriceUsd: new Prisma.Decimal('10.00') } },
      },
    });
    await prisma.conversation.create({ data: { type: 'ORDER', buyerId: ids['buyer']!, sellerId: ids['sellerProfile']!, orderId: order.id } });
    return order.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: Who, roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: `done-e2e-${key}-${stamp}@example.com`,
          passwordHash: 'not-used',
          name: `Done ${key}`,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', [Role.BUYER]);
    await make('seller', [Role.SELLER], 'Done Test Shop');
    await make('ops', [Role.ADMIN_OPS]);
    await make('finance', [Role.ADMIN_FINANCE]);
    await make('owner', [Role.ADMIN_OWNER]);
    await make('outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: 'done-e2e-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'done-e2e-' } } });
    await app.close();
  });

  it('every completion route needs a login (401)', async () => {
    const server = request(app.getHttpServer());
    await server.post('/api/orders/x/confirm-received').expect(401);
    await server.post('/api/orders/x/report-delivery-issue').expect(401);
    await server.post('/api/admin/orders/x/complete').expect(401);
  });

  it('only the buyer confirms; the seller and admins get 403, outsiders 404; nothing before arrival', async () => {
    const orderId = await orderIn('ARRIVED');
    for (const who of ['seller', 'ops', 'owner'] as const) await http(who, 'post', `/api/orders/${orderId}/confirm-received`).expect(403);
    await http('outsider', 'post', `/api/orders/${orderId}/confirm-received`).expect(404);
    const inTransit = await orderIn('SHIPPED');
    await http('buyer', 'post', `/api/orders/${inTransit}/confirm-received`).expect(409);
    expect((await statusOf(orderId)).status).toBe('ARRIVED');
  });

  it('the buyer confirms receipt: COMPLETED with a timestamp, the seller is told, and it is final', async () => {
    const orderId = await orderIn('ARRIVED');
    const res = await http('buyer', 'post', `/api/orders/${orderId}/confirm-received`).expect(200);
    expect(res.body).toEqual({ status: 'COMPLETED' });
    const row = await statusOf(orderId);
    expect(row.status).toBe('COMPLETED');
    expect(row.completedAt).not.toBeNull();
    expect(await lastMessage(orderId)).toContain('confirmed receiving');
    expect(await prisma.notification.count({ where: { userId: ids['seller'], subject: `order:${orderId}` } })).toBe(1);
    await http('buyer', 'post', `/api/orders/${orderId}/confirm-received`).expect(409);
    await http('buyer', 'post', `/api/orders/${orderId}/report-delivery-issue`).send({ reason: 'Too late to complain now.' }).expect(409);
    await http('owner', 'post', `/api/admin/orders/${orderId}/complete`).send({ note: 'Already done by the buyer' }).expect(409);
  });

  it('a problem after arrival needs a real reason, holds the order, and the buyer can still confirm later', async () => {
    const orderId = await orderIn('ARRIVED');
    await http('buyer', 'post', `/api/orders/${orderId}/report-delivery-issue`).send({ reason: 'bad' }).expect(400);
    await http('buyer', 'post', `/api/orders/${orderId}/report-delivery-issue`).send({}).expect(400);
    await http('seller', 'post', `/api/orders/${orderId}/report-delivery-issue`).send({ reason: 'Seller cannot report this.' }).expect(403);
    const reason = 'Two baskets arrived crushed in carton 3.';
    await http('buyer', 'post', `/api/orders/${orderId}/report-delivery-issue`).send({ reason }).expect(200);
    expect((await statusOf(orderId)).status).toBe('DELIVERY_ISSUE');
    expect(await prisma.deliveryIssue.findFirst({ where: { orderId }, select: { reason: true, reportedById: true } })).toEqual({ reason, reportedById: ids['buyer'] });
    expect(await lastMessage(orderId)).toContain(reason);
    // It is a discussion, not a cancellation.
    await http('buyer', 'post', `/api/orders/${orderId}/cancel`).send({}).expect(409);
    await http('buyer', 'post', `/api/orders/${orderId}/confirm-received`).expect(200);
    expect((await statusOf(orderId)).status).toBe('COMPLETED');
  });

  it('only the OWNER completes by hand, always with a note, and it is audited', async () => {
    const orderId = await orderIn('DELIVERY_ISSUE');
    for (const who of ['ops', 'finance', 'buyer', 'seller'] as const) {
      await http(who, 'post', `/api/admin/orders/${orderId}/complete`).send({ note: 'Settled in the chat' }).expect(403);
    }
    await http('owner', 'post', `/api/admin/orders/${orderId}/complete`).send({}).expect(400);
    await http('owner', 'post', `/api/admin/orders/${orderId}/complete`).send({ note: 'ok' }).expect(400);
    await http('owner', 'post', `/api/admin/orders/${orderId}/complete`).send({ note: 'Seller replaced the crushed baskets.' }).expect(200);
    expect((await statusOf(orderId)).status).toBe('COMPLETED');
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'order', entityId: orderId } });
    expect(audit).toMatchObject({ action: 'ORDER_COMPLETED_BY_ADMIN', actorId: ids['owner'] });
    expect(audit.data).toMatchObject({ from: 'DELIVERY_ISSUE', note: 'Seller replaced the crushed baskets.' });
    for (const who of ['buyer', 'seller'] as const) {
      expect(await prisma.notification.count({ where: { userId: ids[who], subject: `order:${orderId}` } })).toBe(1);
    }
  });

  it('the buyer does not learn whether the seller was paid; the seller and admins do', async () => {
    const orderId = await orderIn('ARRIVED');
    expect(((await http('buyer', 'get', `/api/orders/${orderId}`).expect(200)).body as OrderView).payoutRecorded).toBeNull();
    expect(((await http('seller', 'get', `/api/orders/${orderId}`).expect(200)).body as OrderView).payoutRecorded).toBe(false);
    expect(((await http('finance', 'get', `/api/orders/${orderId}`).expect(200)).body as OrderView).payoutRecorded).toBe(false);
  });
});
