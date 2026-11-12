import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role } from '@balitrade/shared';
import type { CatalogProduct, PublicSellerProfile } from '@balitrade/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashPassword } from '../src/common/password.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Test users use the prefix "catalog-e2e-" so other spec files' cleanup (running in parallel) leaves them alone.
// Titles contain a unique word (`tag`) so searches only match this spec's products, whatever else is in the database.
// Requires the database from docker-compose.yml (`pnpm db:up`), `pnpm db:seed` (QC zones) and apps/api/.env.
describe('Public catalog: search, filters, detail, seller page (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const tag = `zxq${stamp}`;
  const emails = { seller: `catalog-e2e-seller-${stamp}@example.com`, pending: `catalog-e2e-pending-${stamp}@example.com` };
  const ids: Record<string, string> = {};
  let sellerProfileId = '';
  let pendingProfileId = '';

  const get = (path: string) => request(app.getHttpServer()).get(`/api${path}`);
  const list = async (query: string) => (await get(`/products?${query}`).expect(200)).body as CatalogProduct[];
  const names = (products: CatalogProduct[]) => products.map((p) => p.title).sort();

  const makeProduct = async (
    sellerId: string,
    key: string,
    data: {
      category: string;
      type: 'READY_STOCK' | 'MADE_TO_ORDER';
      status: 'APPROVED' | 'DRAFT' | 'PENDING_REVIEW';
      translations: { locale: string; title: string; description: string }[];
      sourceLocale?: string;
    },
  ) => {
    const product = await prisma.product.create({
      data: {
        sellerId,
        type: data.type,
        categorySlug: data.category,
        unit: 'PCS',
        priceIdr: 160000,
        moq: 2,
        stockQty: data.type === 'READY_STOCK' ? 30 : null,
        leadTimeDays: data.type === 'MADE_TO_ORDER' ? 14 : null,
        sourceLocale: data.sourceLocale ?? 'en',
        status: data.status,
        translations: { create: data.translations },
      },
    });
    ids[key] = product.id;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await hashPassword('correct-horse-battery');
    const zone = await prisma.qcZone.findFirstOrThrow();
    const seller = await prisma.user.create({
      data: {
        email: emails.seller,
        passwordHash,
        name: 'Seller',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: `Catalog Shop ${stamp}`, about: 'We weave baskets.', qcZoneId: zone.id, status: 'APPROVED' } },
      },
      include: { sellerProfile: true },
    });
    sellerProfileId = seller.sellerProfile!.id;
    const pending = await prisma.user.create({
      data: {
        email: emails.pending,
        passwordHash,
        name: 'Pending',
        roles: [Role.SELLER],
        sellerProfile: { create: { displayName: 'Pending Shop', qcZoneId: zone.id, status: 'PENDING' } },
      },
      include: { sellerProfile: true },
    });
    pendingProfileId = pending.sellerProfile!.id;

    await makeProduct(sellerProfileId, 'bag', {
      category: 'BAGS_ACCESSORIES',
      type: 'READY_STOCK',
      status: 'APPROVED',
      translations: [
        { locale: 'en', title: `Rattan bag ${tag}`, description: 'Handwoven round bag' },
        { locale: 'ru', title: `Ротанговая сумка ${tag}`, description: 'Плетёная сумка' },
      ],
    });
    await makeProduct(sellerProfileId, 'coffee', {
      category: 'COFFEE_TEA',
      type: 'MADE_TO_ORDER',
      status: 'APPROVED',
      sourceLocale: 'id',
      translations: [{ locale: 'id', title: `Kopi Arabika ${tag}`, description: 'Biji kopi hijau Kintamani' }],
    });
    await makeProduct(sellerProfileId, 'draft', {
      category: 'BAGS_ACCESSORIES',
      type: 'READY_STOCK',
      status: 'DRAFT',
      translations: [{ locale: 'en', title: `Secret draft ${tag}`, description: 'Not for sale yet' }],
    });
    await makeProduct(pendingProfileId, 'ofPending', {
      category: 'BAGS_ACCESSORIES',
      type: 'READY_STOCK',
      status: 'APPROVED',
      translations: [{ locale: 'en', title: `Unapproved seller bag ${tag}`, description: 'Hidden' }],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'catalog-e2e-' } } });
    await app.close();
  });

  describe('search and filters', () => {
    it('shows only approved products of approved sellers', async () => {
      const found = await list(`q=${tag}`);
      expect(names(found)).toEqual([`Kopi Arabika ${tag}`, `Rattan bag ${tag}`]);
    });

    it('search is case-insensitive and needs every word to match', async () => {
      expect(names(await list(`q=${encodeURIComponent(`RATTAN ${tag.toUpperCase()}`)}`))).toEqual([`Rattan bag ${tag}`]);
      expect(await list(`q=${encodeURIComponent(`rattan nonexistentword ${tag}`)}`)).toHaveLength(0);
    });

    it('search also matches descriptions and other languages', async () => {
      expect(names(await list(`q=${encodeURIComponent(`kintamani ${tag}`)}`))).toEqual([`Kopi Arabika ${tag}`]);
      // The Russian title is found even while browsing in English.
      expect(names(await list(`q=${encodeURIComponent(`Ротанговая ${tag}`)}&locale=en`))).toEqual([`Rattan bag ${tag}`]);
    });

    it('filters by category and by listing type, and combines them with search', async () => {
      expect(names(await list(`q=${tag}&category=COFFEE_TEA`))).toEqual([`Kopi Arabika ${tag}`]);
      expect(names(await list(`q=${tag}&type=READY_STOCK`))).toEqual([`Rattan bag ${tag}`]);
      expect(await list(`q=${tag}&category=COFFEE_TEA&type=READY_STOCK`)).toHaveLength(0);
    });

    it('treats search text as plain text (no wildcards or injection)', async () => {
      expect(await list(`q=${encodeURIComponent("%'; DROP TABLE products;--")}`)).toHaveLength(0);
      // If "%" or "_" acted as SQL wildcards, these would match the products tagged with `tag`.
      expect(await list(`q=${encodeURIComponent(`% ${tag}`)}`)).toHaveLength(0);
      expect(await list(`q=${encodeURIComponent(`_____ ${tag}`)}`)).toHaveLength(0);
    });

    it('rejects malformed categories/types/locales and over-long search with 400', async () => {
      await get('/products?category=not+a+slug').expect(400);
      await get('/products?type=BULK').expect(400);
      await get('/products?locale=fr').expect(400);
      await get(`/products?q=${'a'.repeat(101)}`).expect(400);
      await get('/products?status=DRAFT').expect(400); // unknown params are not accepted
    });

    it('matches nothing for a category that does not exist, rather than failing', async () => {
      // Categories are rows since T26, so a slug the API does not know is not a client error: a filter
      // URL someone bookmarked must keep working after the owner switches that category off.
      const res = await get('/products?category=WEAPONS').expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('product detail', () => {
    it('returns an approved product in the requested language', async () => {
      const res = await get(`/products/${ids['bag']}?locale=ru`).expect(200);
      expect(res.body).toMatchObject({
        id: ids['bag'],
        title: `Ротанговая сумка ${tag}`,
        textLocale: 'ru',
        type: 'READY_STOCK',
        priceIdr: 160000,
        moq: 2,
        stockQty: 30,
        seller: { id: sellerProfileId, location: expect.any(String) },
      });
      expect(Object.keys(res.body.seller).sort()).toEqual(['displayName', 'id', 'location']);
    });

    it('falls back to the seller language when the requested one is missing', async () => {
      const res = await get(`/products/${ids['coffee']}?locale=en`).expect(200);
      expect(res.body).toMatchObject({ title: `Kopi Arabika ${tag}`, textLocale: 'id', leadTimeDays: 14, stockQty: null });
    });

    it('answers 404 for drafts, products of unapproved sellers and unknown ids', async () => {
      await get(`/products/${ids['draft']}`).expect(404);
      await get(`/products/${ids['ofPending']}`).expect(404);
      await get('/products/does-not-exist').expect(404);
    });
  });

  describe('public seller page', () => {
    it('shows the seller and only their approved products, without private data', async () => {
      const res = await get(`/public/sellers/${sellerProfileId}`).expect(200);
      const profile = res.body as PublicSellerProfile;
      expect(profile).toMatchObject({ id: sellerProfileId, displayName: `Catalog Shop ${stamp}`, about: 'We weave baskets.' });
      expect(profile.location).toEqual(expect.any(String));
      expect(names(profile.products)).toEqual([`Kopi Arabika ${tag}`, `Rattan bag ${tag}`]);
      expect(JSON.stringify(res.body)).not.toContain(emails.seller);
      expect(Object.keys(profile).sort()).toEqual(['about', 'displayName', 'id', 'location', 'memberSince', 'products']);
    });

    it('answers 404 for sellers who are not approved or do not exist', async () => {
      await get(`/public/sellers/${pendingProfileId}`).expect(404);
      await get('/public/sellers/does-not-exist').expect(404);
    });
  });
});
