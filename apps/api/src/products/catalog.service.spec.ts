import { CatalogService } from './catalog.service.js';

const row = (id: string, seller: unknown) => ({
  id,
  type: 'READY_STOCK',
  category: 'HANDICRAFTS',
  unit: 'PCS',
  priceIdr: 100000,
  moq: 1,
  stockQty: 5,
  leadTimeDays: null,
  sourceLocale: 'en',
  translations: [{ locale: 'en', title: `Product ${id}`, description: 'Text', isAuto: false }],
  media: [],
  seller,
});

describe('CatalogService.list', () => {
  const makeService = (rows: unknown[]) =>
    new CatalogService(
      { product: { findMany: async () => rows } } as never,
      { publicUrlFor: () => null } as never,
      { latest: async () => null } as never,
    );

  it('maps products with their seller', async () => {
    const service = makeService([row('a', { id: 's1', displayName: 'Shop', qcZone: { name: 'Gianyar' } })]);
    expect(await service.list('en')).toMatchObject([{ id: 'a', title: 'Product a', priceUsd: null, seller: { id: 's1', location: 'Gianyar' } }]);
  });

  it('skips a product whose seller was deleted between the two reads instead of failing with a 500', async () => {
    const service = makeService([
      row('a', { id: 's1', displayName: 'Shop', qcZone: null }),
      row('b', null),
      row('c', { id: 's1', displayName: 'Shop', qcZone: null }),
    ]);
    const ids = (await service.list('en')).map((product) => product.id);
    expect(ids).toEqual(['a', 'c']);
  });
});
