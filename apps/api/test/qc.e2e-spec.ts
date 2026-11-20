import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { QC_CHECKLIST, QC_LIMITS, Role } from '@balitrade/shared';
import type { QcChecklistEntry, QcReportsResponse } from '@balitrade/shared';
import request from 'supertest';
import { SESSION_COOKIE } from '../src/auth/auth.constants.js';
import { Prisma } from '../src/generated/prisma/client.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { QcService } from '../src/qc/qc.service.js';

// Signed links are computed offline, so fake R2 settings are enough (and no real bucket is ever touched). The app is
// imported in beforeAll, after these are set: ConfigModule reads the environment when app.module.js loads.
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

// Test users use the prefix "qc-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
describe('Quality control reports (T18, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let qcService: QcService;
  const stamp = Date.now();
  const names = ['buyer', 'seller', 'ops', 'finance', 'owner', 'outsider'] as const;
  type Who = (typeof names)[number];
  const ids: Record<string, string> = {};
  const cookies = new Map<Who, string>();
  let fileCounter = 0;

  const http = (who: Who, method: 'get' | 'post', path: string) => request(app.getHttpServer())[method](path).set('Cookie', cookies.get(who)!);
  /** A private key as media.service.ts hands it out: the uploader's id is part of it. */
  const fileOf = (who: Who, ext = 'webp') => `private/${ids[who]}/00000000-0000-4000-8000-${String(++fileCounter).padStart(12, '0')}.${ext}`;
  const allPass = (): QcChecklistEntry[] => QC_CHECKLIST.map((key) => ({ key, result: 'PASS' as const }));
  const report = (overrides: Partial<{ checklist: QcChecklistEntry[]; comment: string; media: { key: string }[] }> = {}) => ({
    checklist: allPass(),
    comment: '50 baskets counted, all intact. Photos of every carton.',
    media: [{ key: fileOf('ops') }, { key: fileOf('ops', 'mp4') }],
    ...overrides,
  });
  const statusOf = async (orderId: string) => (await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { status: true } })).status;
  const systemMessages = (orderId: string) =>
    prisma.message.findMany({ where: { kind: 'SYSTEM', conversation: { orderId } }, orderBy: { createdAt: 'asc' }, select: { body: true } });

  /** An order whose goods are already with BaliTrade (IN_QC), with its order chat. */
  const orderInQc = async (): Promise<string> => {
    const order = await prisma.order.create({
      data: {
        buyerId: ids['buyer']!,
        sellerId: ids['sellerProfile']!,
        status: 'IN_QC',
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
    const { AppModule } = await import('../src/app.module.js');
    const { configureApp } = await import('../src/app.setup.js');
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const { QcService } = await import('../src/qc/qc.service.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    qcService = app.get(QcService);

    const zone = await prisma.qcZone.findFirstOrThrow();
    const make = async (key: Who, roles: Role[], shop?: string) => {
      const created = await prisma.user.create({
        data: {
          email: `qc-e2e-${key}-${stamp}@example.com`,
          passwordHash: 'not-used',
          name: `QC ${key}`,
          roles,
          ...(shop ? { sellerProfile: { create: { displayName: shop, qcZoneId: zone.id, status: 'APPROVED' as const } } } : {}),
        },
        include: { sellerProfile: true },
      });
      ids[key] = created.id;
      if (created.sellerProfile) ids[`${key}Profile`] = created.sellerProfile.id;
    };
    await make('buyer', [Role.BUYER]);
    await make('seller', [Role.SELLER], 'QC Test Shop');
    await make('ops', [Role.ADMIN_OPS]);
    await make('finance', [Role.ADMIN_FINANCE]);
    await make('owner', [Role.ADMIN_OWNER]);
    await make('outsider', [Role.BUYER]);

    const jwt = app.get(JwtService, { strict: false });
    for (const name of names) cookies.set(name, `${SESSION_COOKIE}=${jwt.sign({ sub: ids[name] })}`);
  });

  afterAll(async () => {
    // Orders cascade from the buyer and the seller profile, and with them the reports and their media rows.
    await prisma.user.deleteMany({ where: { email: { startsWith: 'qc-e2e-' } } });
    await app.close();
  });

  it('every QC route needs a login (401)', async () => {
    const server = request(app.getHttpServer());
    await server.get('/api/orders/x/qc').expect(401);
    await server.post('/api/orders/x/qc/approve').expect(401);
    await server.post('/api/orders/x/qc/report-issue').expect(401);
    await server.post('/api/admin/orders/x/qc-report').expect(401);
    await server.post('/api/admin/orders/x/redo-qc').expect(401);
  });

  it('only OPS and the OWNER write reports or ask for a new check (403 for everyone else)', async () => {
    const orderId = await orderInQc();
    for (const who of ['finance', 'buyer', 'seller'] as const) {
      await http(who, 'post', `/api/admin/orders/${orderId}/qc-report`).send(report()).expect(403);
      await http(who, 'post', `/api/admin/orders/${orderId}/redo-qc`).send({}).expect(403);
    }
    expect(await statusOf(orderId)).toBe('IN_QC');
  });

  describe('refuses a report it cannot trust (400), and leaves the order as it was', () => {
    let orderId: string;
    beforeAll(async () => {
      orderId = await orderInQc();
    });
    const send = (body: object) => http('ops', 'post', `/api/admin/orders/${orderId}/qc-report`).send(body);

    it('files that are not the admin’s own uploads — another admin’s, or the buyer’s payment proof', async () => {
      await send(report({ media: [{ key: fileOf('owner') }] })).expect(400);
      await send(report({ media: [{ key: fileOf('buyer', 'jpg') }] })).expect(400);
      await send(report({ media: [{ key: 'products/someone/photo.webp' }] })).expect(400);
      await send(report({ media: [{ key: `private/${ids['ops']}/../../etc/passwd` }] })).expect(400);
    });

    it('no photo, too many files, or the same file twice', async () => {
      await send(report({ media: [] })).expect(400);
      await send(report({ media: [{ key: fileOf('ops', 'mp4') }] })).expect(400);
      await send(report({ media: Array.from({ length: QC_LIMITS.mediaMax + 1 }, () => ({ key: fileOf('ops') })) })).expect(400);
      const same = fileOf('ops');
      await send(report({ media: [{ key: same }, { key: same }] })).expect(400);
    });

    it('an incomplete checklist, an unknown line, or a failed line without a note', async () => {
      await send(report({ checklist: allPass().slice(1) })).expect(400);
      await send(report({ checklist: [...allPass().slice(1), { key: 'BOGUS', result: 'PASS' } as never] })).expect(400);
      const failed = allPass();
      failed[2] = { key: failed[2]!.key, result: 'FAIL' };
      await send(report({ checklist: failed })).expect(400);
      await send(report({ comment: '' })).expect(400);
      await send({ ...report(), status: 'QC_APPROVED' }).expect(400); // unknown fields are refused, never applied
    });

    it('nothing was stored', async () => {
      expect(await statusOf(orderId)).toBe('IN_QC');
      expect(await prisma.qcReport.count({ where: { orderId } })).toBe(0);
    });
  });

  describe('the happy path: report, read, approve', () => {
    let orderId: string;

    it('OPS sends the report: QC_READY, with a chat message and notifications for both sides', async () => {
      orderId = await orderInQc();
      const failed = allPass();
      failed[0] = { key: 'QUANTITY', result: 'FAIL', note: '48 of 50 delivered' };
      const res = await http('ops', 'post', `/api/admin/orders/${orderId}/qc-report`).send(report({ checklist: failed })).expect(201);
      const body = res.body as QcReportsResponse;
      expect(body.reports).toHaveLength(1);
      expect(body.reports[0]).toMatchObject({ round: 1, status: 'READY', autoApproved: false, createdBy: { id: ids['ops'], name: 'QC ops' } });
      expect(await statusOf(orderId)).toBe('QC_READY');

      const messages = await systemMessages(orderId);
      expect(messages.at(-1)?.body).toContain('4 of 5 checks passed');
      for (const who of ['buyer', 'seller'] as const) {
        expect(await prisma.notification.count({ where: { userId: ids[who], subject: `order:${orderId}` } })).toBe(1);
      }
    });

    it('the buyer, the seller and admins read it with signed links; anyone else gets 404', async () => {
      for (const who of ['buyer', 'seller', 'finance', 'ops'] as const) {
        const body = (await http(who, 'get', `/api/orders/${orderId}/qc`).expect(200)).body as QcReportsResponse;
        const [latest] = body.reports;
        expect(latest!.media.map((item) => item.kind)).toEqual(['IMAGE', 'VIDEO']);
        for (const item of latest!.media) {
          expect(item.url).toContain('bt-private');
          expect(item.url).toContain('X-Amz-Signature=');
        }
        expect(latest!.checklist[0]).toEqual({ key: 'QUANTITY', result: 'FAIL', note: '48 of 50 delivered' });
        expect(new Date(latest!.autoApproveAt!).getTime() - new Date(latest!.createdAt).getTime()).toBe(QC_LIMITS.autoApproveHours * 3_600_000);
      }
      await http('outsider', 'get', `/api/orders/${orderId}/qc`).expect(404);
      await http('outsider', 'post', `/api/orders/${orderId}/qc/approve`).expect(404);
      await http('buyer', 'get', '/api/orders/does-not-exist/qc').expect(404);
    });

    it('the files cannot be re-used in another report', async () => {
      const other = await orderInQc();
      const used = (await prisma.qcMedia.findFirstOrThrow({ where: { report: { orderId } } })).r2Key;
      await http('ops', 'post', `/api/admin/orders/${other}/qc-report`).send(report({ media: [{ key: used }] })).expect(400);
    });

    it('only the buyer answers it: the seller and admins get 403', async () => {
      for (const who of ['seller', 'ops', 'owner'] as const) {
        await http(who, 'post', `/api/orders/${orderId}/qc/approve`).expect(403);
        await http(who, 'post', `/api/orders/${orderId}/qc/report-issue`).send({ reason: 'Looks wrong to me, honestly.' }).expect(403);
      }
      expect(await statusOf(orderId)).toBe('QC_READY');
    });

    it('the buyer approves: QC_APPROVED; a second answer is a 409', async () => {
      const body = (await http('buyer', 'post', `/api/orders/${orderId}/qc/approve`).expect(200)).body as QcReportsResponse;
      expect(body.reports[0]).toMatchObject({ status: 'APPROVED', autoApproved: false, autoApproveAt: null });
      expect(body.reports[0]!.decidedAt).not.toBeNull();
      expect(await statusOf(orderId)).toBe('QC_APPROVED');
      await http('buyer', 'post', `/api/orders/${orderId}/qc/approve`).expect(409);
      await http('buyer', 'post', `/api/orders/${orderId}/qc/report-issue`).send({ reason: 'Changed my mind about it.' }).expect(409);
      await http('ops', 'post', `/api/admin/orders/${orderId}/qc-report`).send(report()).expect(409);
      expect((await systemMessages(orderId)).at(-1)?.body).toContain('Buyer approved');
    });
  });

  describe('a problem is talked through, then checked again', () => {
    let orderId: string;

    it('a problem needs a real reason (400)', async () => {
      orderId = await orderInQc();
      await http('ops', 'post', `/api/admin/orders/${orderId}/qc-report`).send(report()).expect(201);
      await http('buyer', 'post', `/api/orders/${orderId}/qc/report-issue`).send({}).expect(400);
      await http('buyer', 'post', `/api/orders/${orderId}/qc/report-issue`).send({ reason: 'bad' }).expect(400);
      await http('buyer', 'post', `/api/orders/${orderId}/qc/report-issue`).send({ reason: 'x'.repeat(QC_LIMITS.issueReasonMax + 1) }).expect(400);
      expect(await statusOf(orderId)).toBe('QC_READY');
    });

    it('the buyer reports it: ISSUE, the reason is kept and posted in the order chat', async () => {
      const reason = 'Two baskets have a cracked rim in the photos.';
      const body = (await http('buyer', 'post', `/api/orders/${orderId}/qc/report-issue`).send({ reason }).expect(200)).body as QcReportsResponse;
      expect(body.reports[0]).toMatchObject({ round: 1, status: 'ISSUE', issueReason: reason });
      expect(await statusOf(orderId)).toBe('ISSUE');
      expect((await systemMessages(orderId)).at(-1)?.body).toContain(reason);
      // It is a discussion, not a cancellation: the buyer cannot cancel from here.
      await http('buyer', 'post', `/api/orders/${orderId}/cancel`).send({}).expect(409);
    });

    it('OPS checks again: IN_QC, and the next report is round 2 while round 1 stays as history', async () => {
      await http('ops', 'post', `/api/admin/orders/${orderId}/redo-qc`).send({ note: 'Seller replaced the two baskets.' }).expect(200);
      expect(await statusOf(orderId)).toBe('IN_QC');
      expect((await systemMessages(orderId)).at(-1)?.body).toContain('Seller replaced the two baskets.');
      await http('ops', 'post', `/api/admin/orders/${orderId}/redo-qc`).send({}).expect(409);

      await http('owner', 'post', `/api/admin/orders/${orderId}/qc-report`).send(report({ media: [{ key: fileOf('owner') }] })).expect(201);
      const body = (await http('seller', 'get', `/api/orders/${orderId}/qc`).expect(200)).body as QcReportsResponse;
      expect(body.reports.map((r) => [r.round, r.status])).toEqual([
        [2, 'READY'],
        [1, 'ISSUE'],
      ]);
      await http('buyer', 'post', `/api/orders/${orderId}/qc/approve`).expect(200);
      expect(await statusOf(orderId)).toBe('QC_APPROVED');
    });
  });

  describe('automatic approval after 48 hours', () => {
    it('approves only reports older than the deadline, as the system, and tells both sides', async () => {
      const overdue = await orderInQc();
      const fresh = await orderInQc();
      for (const id of [overdue, fresh]) await http('ops', 'post', `/api/admin/orders/${id}/qc-report`).send(report()).expect(201);
      const longAgo = new Date(Date.now() - (QC_LIMITS.autoApproveHours * 3_600_000 + 60_000));
      await prisma.qcReport.updateMany({ where: { orderId: overdue }, data: { createdAt: longAgo } });
      const before = await prisma.notification.count({ where: { userId: ids['buyer'], subject: `order:${overdue}` } });

      await qcService.approveOverdue(new Date());

      expect(await statusOf(overdue)).toBe('QC_APPROVED');
      expect(await statusOf(fresh)).toBe('QC_READY');
      const row = await prisma.qcReport.findFirstOrThrow({ where: { orderId: overdue } });
      expect(row).toMatchObject({ status: 'APPROVED', autoApproved: true, decidedById: null });
      expect((await systemMessages(overdue)).at(-1)?.body).toContain('approved automatically');
      expect(await prisma.notification.count({ where: { userId: ids['buyer'], subject: `order:${overdue}` } })).toBe(before + 1);

      // Running it again changes nothing.
      await qcService.approveOverdue(new Date());
      expect(await statusOf(fresh)).toBe('QC_READY');
    });
  });
});
