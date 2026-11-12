import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Users use the prefix "cat-e2e-" so the other spec files' cleanup (they run in parallel) leaves them
// alone. Categories are global rows rather than per-user, so this spec only ever touches slugs starting
// with CATE2E_ and deletes them afterwards — the nine seeded categories are read, never modified.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` and apps/api/.env.
describe('Product categories managed by the owner (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct-horse-battery';
  const stamp = Date.now();
  const emails = {
    owner: `cat-e2e-owner-${stamp}@example.com`,
    ops: `cat-e2e-ops-${stamp}@example.com`,
    buyer: `cat-e2e-buyer-${stamp}@example.com`,
    seller: `cat-e2e-seller-${stamp}@example.com`,
  };
  const slugs = {
    /** Created through the API during the tests. */
    fresh: 'CATE2E_FRESH',
    /** Seeded below with a product in it, so it can be switched off and archived. */
    used: 'CATE2E_USED',
  };
  const agents = new Map<string, ReturnType<typeof request.agent>>();
  let sellerProfileId = '';
  let productId = '';
  let usedCategoryId = '';

  // Login is rate-limited to 5/min per app instance, so each user logs in once and the agent is reused.
  const agentFor = async (email: string) => {
    const cached = agents.get(email);
    if (cached) return cached;
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(200);
    agents.set(email, agent);
    return agent;
  };

  const anon = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword(password);
    const zone = await prisma.qcZone.findFirstOrThrow();
    await prisma.user.create({
      data: { email: emails.owner, passwordHash, name: 'Owner', roles: [Role.ADMIN_OWNER] },
    });
    await prisma.user.create({
      data: { email: emails.ops, passwordHash, name: 'Ops', roles: [Role.ADMIN_OPS] },
    });
    await prisma.user.create({
      data: { email: emails.buyer, passwordHash, name: 'Buyer', roles: [Role.BUYER] },
    });
    const seller = await prisma.user.create({
      data: {
        email: emails.seller,
        passwordHash,
        name: 'Seller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Category Shop', qcZoneId: zone.id, status: 'APPROVED' } },
      },
      include: { sellerProfile: true },
    });
    sellerProfileId = seller.sellerProfile!.id;

    const used = await prisma.productCategory.create({
      data: {
        slug: slugs.used,
        nameEn: 'Test used',
        nameId: 'Uji terpakai',
        nameRu: 'Тест занято',
        sortOrder: 900,
      },
    });
    usedCategoryId = used.id;

    const product = await prisma.product.create({
      data: {
        sellerId: sellerProfileId,
        type: 'READY_STOCK',
        categorySlug: slugs.used,
        unit: 'PCS',
        priceIdr: 120000,
        moq: 3,
        stockQty: 40,
        sourceLocale: 'en',
        status: 'APPROVED',
        translations: {
          create: { locale: 'en', title: 'Category test product', description: 'Visible while the category is on' },
        },
      },
    });
    productId = product.id;
  });

  afterAll(async () => {
    // Products first: the foreign key is ON DELETE RESTRICT, so a category with products cannot go.
    await prisma.product.deleteMany({ where: { categorySlug: { startsWith: 'CATE2E_' } } });
    await prisma.productCategory.deleteMany({ where: { slug: { startsWith: 'CATE2E_' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'cat-e2e-' } } });
    await app.close();
  });

  const catalogIds = async () => {
    const res = await anon().get('/api/products').expect(200);
    return (res.body as { id: string }[]).map((product) => product.id);
  };

  describe('who may manage categories', () => {
    it('is the owner only (401/403)', async () => {
      await anon().get('/api/admin/categories').expect(401);
      await (await agentFor(emails.buyer)).get('/api/admin/categories').expect(403);
      await (await agentFor(emails.seller)).get('/api/admin/categories').expect(403);
      // OPS reviews products but does not decide what may be sold at all.
      await (await agentFor(emails.ops)).get('/api/admin/categories').expect(403);
      await (await agentFor(emails.owner)).get('/api/admin/categories').expect(200);
    });
  });

  describe('the public list', () => {
    it('needs no login and labels categories in the requested language', async () => {
      const res = await anon().get('/api/categories?locale=ru').expect(200);
      const body = res.body as { slug: string; name: string }[];
      expect(body.find((row) => row.slug === 'COFFEE_TEA')).toEqual({
        slug: 'COFFEE_TEA',
        name: 'Кофе и чай',
      });
    });

    it('falls back to English for an unknown locale value with 400', async () => {
      await anon().get('/api/categories?locale=fr').expect(400);
    });
  });

  describe('creating', () => {
    it('uppercases the slug and puts the new category at the end', async () => {
      const owner = await agentFor(emails.owner);
      const res = await owner
        .post('/api/admin/categories')
        .send({ slug: 'cate2e_fresh', nameEn: 'Test fresh', nameId: 'Uji baru', nameRu: 'Тест новое' })
        .expect(201);
      expect(res.body).toMatchObject({ slug: slugs.fresh, active: true, archivedAt: null, productCount: 0 });
    });

    it('refuses a duplicate slug with 409', async () => {
      const owner = await agentFor(emails.owner);
      await owner
        .post('/api/admin/categories')
        .send({ slug: slugs.fresh, nameEn: 'Again', nameId: 'Lagi', nameRu: 'Снова' })
        .expect(409);
    });

    it('refuses a slug that is not SCREAMING_SNAKE_CASE with 400', async () => {
      const owner = await agentFor(emails.owner);
      await owner
        .post('/api/admin/categories')
        .send({ slug: 'not a slug', nameEn: 'Bad', nameId: 'Bad', nameRu: 'Bad' })
        .expect(400);
    });
  });

  describe('switching a category off', () => {
    it('hides its products from the catalog and makes the detail page 404', async () => {
      const owner = await agentFor(emails.owner);
      expect(await catalogIds()).toContain(productId);
      await anon().get(`/api/products/${productId}`).expect(200);

      await owner.patch(`/api/admin/categories/${usedCategoryId}`).send({ active: false }).expect(200);

      expect(await catalogIds()).not.toContain(productId);
      await anon().get(`/api/products/${productId}`).expect(404);
      // Also gone from the seller's public page, which uses the same visibility rule.
      const sellerPage = await anon().get(`/api/public/sellers/${sellerProfileId}`).expect(200);
      expect((sellerPage.body as { products: { id: string }[] }).products.map((p) => p.id)).not.toContain(productId);
    });

    it('leaves the product APPROVED and still visible to its seller, flagged as not in the shop', async () => {
      const seller = await agentFor(emails.seller);
      const res = await seller.get('/api/seller/products?locale=id').expect(200);
      const mine = (res.body as { id: string; status: string; categoryActive: boolean; categoryName: string }[]).find(
        (product) => product.id === productId,
      );
      // The status is the admin's review verdict and must not be rewritten by a category switch, or
      // checking the box again could not restore the listing.
      expect(mine).toMatchObject({ status: 'APPROVED', categoryActive: false, categoryName: 'Uji terpakai' });
    });

    it('is not offered to sellers any more', async () => {
      const res = await anon().get('/api/categories').expect(200);
      expect((res.body as { slug: string }[]).map((row) => row.slug)).not.toContain(slugs.used);
    });

    it('refuses a new listing in it with 400', async () => {
      const seller = await agentFor(emails.seller);
      await seller
        .post('/api/seller/products')
        .send({
          type: 'READY_STOCK',
          category: slugs.used,
          unit: 'PCS',
          priceIdr: 100000,
          moq: 1,
          stockQty: 10,
          sourceLocale: 'en',
          title: 'Should not be allowed',
          description: 'The category is switched off',
          media: [],
        })
        .expect(400);
    });

    it('brings everything back when it is switched on again', async () => {
      const owner = await agentFor(emails.owner);
      await owner.patch(`/api/admin/categories/${usedCategoryId}`).send({ active: true }).expect(200);
      expect(await catalogIds()).toContain(productId);
      await anon().get(`/api/products/${productId}`).expect(200);
    });
  });

  describe('archiving', () => {
    it('archiving hides the category from the default admin list and from the shop', async () => {
      const owner = await agentFor(emails.owner);
      await owner.patch(`/api/admin/categories/${usedCategoryId}`).send({ archived: true }).expect(200);

      const plain = await owner.get('/api/admin/categories').expect(200);
      expect((plain.body as { slug: string }[]).map((row) => row.slug)).not.toContain(slugs.used);

      const withArchived = await owner.get('/api/admin/categories?archived=true').expect(200);
      const row = (withArchived.body as { slug: string; archivedAt: string | null }[]).find(
        (item) => item.slug === slugs.used,
      );
      expect(row?.archivedAt).toEqual(expect.any(String));

      expect(await catalogIds()).not.toContain(productId);
      await anon().get(`/api/products/${productId}`).expect(404);
    });

    it('offers no delete at all: there is no such endpoint (decided by the owner 2026-11-12)', async () => {
      const owner = await agentFor(emails.owner);
      // Off + archived cover every real case and both are reversible, so nothing here is irreversible.
      await owner.delete(`/api/admin/categories/${usedCategoryId}`).expect(404);
    });

    it('says to restore rather than re-create when the slug is archived', async () => {
      const owner = await agentFor(emails.owner);
      const res = await owner
        .post('/api/admin/categories')
        .send({ slug: slugs.used, nameEn: 'Retry', nameId: 'Retry', nameRu: 'Retry' })
        .expect(409);
      expect((res.body as { message: string }).message).toContain('archived');
    });

    it('restoring puts it back, products and all', async () => {
      const owner = await agentFor(emails.owner);
      await owner.patch(`/api/admin/categories/${usedCategoryId}`).send({ archived: false }).expect(200);
      expect(await catalogIds()).toContain(productId);
    });
  });
});
