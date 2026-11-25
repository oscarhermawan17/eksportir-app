import { ORDER_STATUS_GROUPS, OrderStatus } from '@balitrade/shared';
import { describe, expect, it } from 'vitest';

describe('ORDER_STATUS_GROUPS (the admin order tabs)', () => {
  it('puts every status in exactly one group, so the tabs add up to "All"', () => {
    const grouped = Object.values(ORDER_STATUS_GROUPS).flat();
    expect([...grouped].sort()).toEqual(Object.values(OrderStatus).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
