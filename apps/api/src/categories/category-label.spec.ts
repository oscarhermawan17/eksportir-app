import { describe, expect, it } from 'vitest';
import { categoryLabel } from './category-label.js';

const row = { slug: 'COFFEE_TEA', nameEn: 'Coffee & tea', nameId: 'Kopi & teh', nameRu: 'Кофе и чай' };

describe('categoryLabel', () => {
  it('returns the label of the requested language', () => {
    expect(categoryLabel(row, 'en')).toBe('Coffee & tea');
    expect(categoryLabel(row, 'id')).toBe('Kopi & teh');
    expect(categoryLabel(row, 'ru')).toBe('Кофе и чай');
  });

  it('falls back to English when that language has no label yet', () => {
    expect(categoryLabel({ ...row, nameRu: '   ' }, 'ru')).toBe('Coffee & tea');
  });

  it('falls back to the slug when nothing is filled in', () => {
    expect(categoryLabel({ slug: 'SPICES', nameEn: '', nameId: '', nameRu: '' }, 'id')).toBe('SPICES');
  });
});
