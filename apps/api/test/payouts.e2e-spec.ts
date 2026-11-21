import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { OrderPayoutView, PageResult, OrderView, PayoutPreview, SellerBankView } from '@balitrade/shared';
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

// Test users use the prefix "payout-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
describe('Seller bank details and payouts (T20, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'ops', 'finance', 'owner', 'outsider'] as const;
  type Who = (typeof names)[number];
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  let fileCounter = 0;
  const ACCOUNT = '8730123456789';
  const bank = { bankName: 'BCA', accountNumber: '8730 1234-56789', accountHolder: 'Ni Made Ayu' };

  const http = (who: Who, method: 'get' | 'post' | 'put', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  const fileOf = (who: Who, ext = 'jpg') => `private/${ids[who]}/00000000-0000-4000-8000-${String(++fileCounter).padStart(12, '0')}.${ext}`;
  const payout = (overrides: object = {}) => ({ proofKey: fileOf('owner'), paidAt: new Date().toISOString(), transferReference: 'BCA-777', ...overrides });

  /** qty 3 × Rp 1,000,050 = Rp 3,000,150 → 1% = 30,001.5 → rounded half-up to 30,002. */
  const orderIn = async (status: 'COMPLETED' | 'ARRIVED'): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        buyerId: ids['buyer']!,
        sellerId: ids['sellerProfile']!,
        status,
        deliveryAddress: { fullName: 'Anna Ivanova', phone: '+7 900 123-45-67', country: 'RU', address: 'Tverskaya 1, Moscow, 125009' },
        fxRate: new Prisma.Decimal('16000'),
        itemsUsd: new Prisma.Decimal('187.51'),
        qcFeeUsd: new Prisma.Decimal('3.00'),
        commissionRate: new Prisma.Decimal('0.0100'),
        items: { create: { title: 'Teak bowl', unit: 'PCS', qty: 3, unitPriceIdr: 1_000_050, unitPriceUsd: new Prisma.Decimal('62.50') } },
      },
    });
    await prisma.conversation.create({ data: { type: 'ORDER', buyerId: ids['buyer']!, sellerId: ids['sellerProfile']!, orderId: order.id } });
    return order.id;
  };

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: Who, roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: `payout-e2e-${key}-${stamp}@example.com`,
          passwordHash: 'not-used',
          name: `Payout ${key}`,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', [Role.BUYER]);
    await make('seller', [Role.SELLER], 'Payout Test Shop');
    await make('ops', [Role.ADMIN_OPS]);
    await make('finance', [Role.ADMIN_FINANCE]);
    await make('owner', [Role.ADMIN_OWNER]);
    await make('outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actor: { email: { startsWith: 'payout-e2e-' } } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'payout-e2e-' } } });
    await app.close();
  });

  it('every payout route needs a login (401)', async () => {
    const server = request(app.getHttpServer());
    await server.get('/api/sellers/me/bank').expect(401);
    await server.put('/api/sellers/me/bank').expect(401);
    await server.get('/api/orders/x/payout').expect(401);
    await server.get('/api/admin/orders/x/payout-preview').expect(401);
    await server.post('/api/admin/orders/x/payout').expect(401);
  });

  describe('bank details', () => {
    it('only sellers have them; bad numbers are refused', async () => {
      await http('buyer', 'get', '/api/sellers/me/bank').expect(403);
      await http('owner', 'put', '/api/sellers/me/bank').send(bank).expect(403);
      expect((await http('seller', 'get', '/api/sellers/me/bank').expect(200)).body).toEqual({ bank: null });
      for (const accountNumber of ['12345', 'ABC1234567', '123.456.789', '1'.repeat(21)]) {
        await http('seller', 'put', '/api/sellers/me/bank').send({ ...bank, accountNumber }).expect(400);
      }
      await http('seller', 'put', '/api/sellers/me/bank').send({ ...bank, accountHolder: 'X' }).expect(400);
    });

    it('the seller saves them (spaces and dashes dropped); the audit log keeps only the last four digits', async () => {
      const { bank: saved } = (await http('seller', 'put', '/api/sellers/me/bank').send(bank).expect(200)).body as { bank: SellerBankView };
      expect(saved).toMatchObject({ bankName: 'BCA', accountNumber: ACCOUNT, accountHolder: 'Ni Made Ayu' });
      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'seller', entityId: ids['sellerProfile']! } });
      expect(audit.action).toBe('SELLER_BANK_UPDATED');
      expect(JSON.stringify(audit.data)).not.toContain(ACCOUNT);
      expect(audit.data).toMatchObject({ account: '••••6789', previous: null });
    });

    it('never leaks through the catalog, the seller page or an order', async () => {
      const orderId = await orderIn('ARRIVED');
      const product = await prisma.product.create({
        data: {
          sellerId: ids['sellerProfile']!,
          type: 'READY_STOCK',
          categorySlug: 'HANDICRAFTS',
          unit: 'PCS',
          priceIdr: 100_000,
          moq: 1,
          stockQty: 10,
          sourceLocale: 'en',
          status: 'APPROVED',
          translations: { create: [{ locale: 'en', title: 'Payout test product', description: 'Description' }] },
        },
      });
      // Every route must answer for real, or "no leak" would pass on an error page.
      const leaks = [
        await http('outsider', 'get', `/api/public/sellers/${ids['sellerProfile']}`).expect(200),
        await http('outsider', 'get', `/api/products/${product.id}`).expect(200),
        await http('buyer', 'get', `/api/orders/${orderId}`),
        await http('seller', 'get', `/api/orders/${orderId}`),
        await http('seller', 'get', '/api/sellers/me'),
        await http('owner', 'get', '/api/admin/orders?size=100'),
        await http('owner', 'get', '/api/admin/sellers'),
      ];
      for (const res of leaks) {
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toContain(ACCOUNT);
      }
    });
  });

  describe('a payout', () => {
    let orderId: string;

    it('the buyer, OPS and outsiders cannot see it; the seller sees the 1% breakdown, rounded half-up', async () => {
      orderId = await orderIn('COMPLETED');
      for (const who of ['buyer', 'ops', 'outsider'] as const) await http(who, 'get', `/api/orders/${orderId}/payout`).expect(404);
      const view = (await http('seller', 'get', `/api/orders/${orderId}/payout`).expect(200)).body as OrderPayoutView;
      expect(view).toEqual({ breakdown: { grossIdr: 3_000_150, commissionIdr: 30_002, netIdr: 2_970_148, commissionRate: '0.0100' }, payout: null });
    });

    it('FINANCE and OWNER see the full account to transfer, flagged as recently changed; others get 403', async () => {
      for (const who of ['ops', 'seller', 'buyer'] as const) await http(who, 'get', `/api/admin/orders/${orderId}/payout-preview`).expect(403);
      const preview = (await http('finance', 'get', `/api/admin/orders/${orderId}/payout-preview`).expect(200)).body as PayoutPreview;
      expect(preview.bank).toMatchObject({ accountNumber: ACCOUNT, accountHolder: 'Ni Made Ayu', changedRecently: true });
      expect(preview.shop).toMatchObject({ displayName: 'Payout Test Shop', ownerName: 'Payout seller' });
    });

    it('only the OWNER records it; amounts from the client and someone else’s receipt are refused', async () => {
      for (const who of ['finance', 'ops', 'seller'] as const) await http(who, 'post', `/api/admin/orders/${orderId}/payout`).send(payout()).expect(403);
      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send({ ...payout(), netIdr: 99_000_000 }).expect(400);
      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout({ proofKey: fileOf('finance') })).expect(400);
      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout({ proofKey: fileOf('owner', 'mp4') })).expect(400);
      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout({ paidAt: new Date(Date.now() + 86_400_000).toISOString() })).expect(400);
      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout({ paidAt: '2020-01-01T00:00:00.000Z' })).expect(400);
      const early = await orderIn('ARRIVED');
      await http('owner', 'post', `/api/admin/orders/${early}/payout`).send(payout()).expect(409);
      expect(await prisma.payout.count({ where: { orderId } })).toBe(0);
    });

    it('the OWNER records it: computed amounts, a snapshot of the account, an audit row, the seller told, once', async () => {
      const recorded = (await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout()).expect(201)).body as OrderPayoutView;
      expect(recorded.payout).toMatchObject({
        grossIdr: 3_000_150,
        commissionIdr: 30_002,
        netIdr: 2_970_148,
        accountMasked: '••••6789',
        transferReference: 'BCA-777',
        recordedBy: { id: ids['owner'] },
      });
      expect(recorded.payout!.proofUrl).toContain('X-Amz-Signature=');
      expect(JSON.stringify(recorded)).not.toContain(ACCOUNT);

      const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'order', entityId: orderId, action: 'PAYOUT_RECORDED' } });
      expect(audit).toMatchObject({ actorId: ids['owner'] });
      expect(JSON.stringify(audit.data)).not.toContain(ACCOUNT);
      expect(await prisma.notification.count({ where: { userId: ids['seller'], type: 'PAYOUT_RECORDED' } })).toBe(1);
      expect(await prisma.notification.count({ where: { userId: ids['buyer'], type: 'PAYOUT_RECORDED' } })).toBe(0);
      // Not in the order chat: the buyer reads that.
      expect(await prisma.message.count({ where: { conversation: { orderId }, body: { contains: '2,970,148' } } })).toBe(0);

      await http('owner', 'post', `/api/admin/orders/${orderId}/payout`).send(payout()).expect(409);
      expect(((await http('seller', 'get', `/api/orders/${orderId}`).expect(200)).body as OrderView).payoutRecorded).toBe(true);
    });

    it('a later change of account does not rewrite the payout; the payout queue filters paid and unpaid', async () => {
      await http('seller', 'put', '/api/sellers/me/bank').send({ ...bank, accountNumber: '9999888877' }).expect(200);
      const view = (await http('seller', 'get', `/api/orders/${orderId}/payout`).expect(200)).body as OrderPayoutView;
      expect(view.payout?.accountMasked).toBe('••••6789');
      const audits = await prisma.auditLog.findMany({ where: { entity: 'seller', entityId: ids['sellerProfile']! }, orderBy: { createdAt: 'desc' } });
      expect(audits[0]!.data).toMatchObject({ account: '••••8877', previous: { account: '••••6789' } });

      const unpaidOrder = await orderIn('COMPLETED');
      const page = async (filter: string) =>
        ((await http('finance', 'get', `/api/admin/orders?payout=${filter}&q=${encodeURIComponent('Payout Test Shop')}&size=100`).expect(200)).body as PageResult<OrderView>).items.map((o) => o.id);
      expect(await page('paid')).toEqual([orderId]);
      expect(await page('unpaid')).toContain(unpaidOrder);
      expect(await page('unpaid')).not.toContain(orderId);
      await http('finance', 'get', '/api/admin/orders?payout=bogus').expect(400);
    });

    it('refuses a payout while the seller has no bank details', async () => {
      await prisma.sellerBankAccount.delete({ where: { sellerId: ids['sellerProfile']! } });
      const another = await orderIn('COMPLETED');
      await http('owner', 'post', `/api/admin/orders/${another}/payout`).send(payout()).expect(409);
    });
  });
});
