import type { ProductStatus } from '@balitrade/shared';
import { nextStatus } from './product-status.js';

describe('nextStatus (seller side)', () => {
  it.each<[ProductStatus, ProductStatus | null]>([
    ['DRAFT', 'DRAFT'],
    ['PENDING_REVIEW', 'PENDING_REVIEW'],
    ['REJECTED', 'REJECTED'],
    ['APPROVED', 'PENDING_REVIEW'],
    ['ARCHIVED', null],
  ])('edit: %s -> %s', (from, to) => {
    expect(nextStatus(from, 'edit')).toBe(to);
  });

  it.each<[ProductStatus, ProductStatus | null]>([
    ['DRAFT', 'PENDING_REVIEW'],
    ['REJECTED', 'PENDING_REVIEW'],
    ['PENDING_REVIEW', null],
    ['APPROVED', null],
    ['ARCHIVED', null],
  ])('submit: %s -> %s', (from, to) => {
    expect(nextStatus(from, 'submit')).toBe(to);
  });

  it('archives anything that is not archived, and restores only archived products to DRAFT', () => {
    for (const status of ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'] as const) {
      expect(nextStatus(status, 'archive')).toBe('ARCHIVED');
      expect(nextStatus(status, 'restore')).toBeNull();
    }
    expect(nextStatus('ARCHIVED', 'archive')).toBeNull();
    expect(nextStatus('ARCHIVED', 'restore')).toBe('DRAFT');
  });

  it('admin review only applies to PENDING_REVIEW', () => {
    expect(nextStatus('PENDING_REVIEW', 'approve')).toBe('APPROVED');
    expect(nextStatus('PENDING_REVIEW', 'reject')).toBe('REJECTED');
    for (const status of ['DRAFT', 'APPROVED', 'REJECTED', 'ARCHIVED'] as const) {
      expect(nextStatus(status, 'approve')).toBeNull();
      expect(nextStatus(status, 'reject')).toBeNull();
    }
  });
});
