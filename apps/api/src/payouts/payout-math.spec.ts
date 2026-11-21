import { BANK_LIMITS, SELLER_COMMISSION_RATE, maskAccount, nextOrderStatus, payoutBreakdown } from '@balitrade/shared';

describe('payoutBreakdown (T20)', () => {
  it('keeps 1% and pays out the rest, always adding up exactly', () => {
    expect(SELLER_COMMISSION_RATE).toBe('0.0100');
    expect(payoutBreakdown(8_000_000, '0.0100')).toEqual({ grossIdr: 8_000_000, commissionIdr: 80_000, netIdr: 7_920_000 });
    expect(payoutBreakdown(8_000_000, '0.01')).toEqual(payoutBreakdown(8_000_000, '0.0100'));
  });

  it('rounds the commission half-up to a whole rupiah', () => {
    expect(payoutBreakdown(150, '0.0100')).toEqual({ grossIdr: 150, commissionIdr: 2, netIdr: 148 }); // 1.5 → 2
    expect(payoutBreakdown(149, '0.0100')).toEqual({ grossIdr: 149, commissionIdr: 1, netIdr: 148 }); // 1.49 → 1
    expect(payoutBreakdown(49, '0.0100').commissionIdr).toBe(0);
    expect(payoutBreakdown(0, '0.0100')).toEqual({ grossIdr: 0, commissionIdr: 0, netIdr: 0 });
    expect(payoutBreakdown(1_000_001, '0.0250')).toEqual({ grossIdr: 1_000_001, commissionIdr: 25_000, netIdr: 975_001 });
    expect(payoutBreakdown(500, '0')).toEqual({ grossIdr: 500, commissionIdr: 0, netIdr: 500 });
  });

  it('refuses inputs that are not whole rupiah or a sane rate', () => {
    expect(() => payoutBreakdown(1.5, '0.0100')).toThrow(RangeError);
    expect(() => payoutBreakdown(-1, '0.0100')).toThrow(RangeError);
    expect(() => payoutBreakdown(100, '1.5')).toThrow(RangeError);
    expect(() => payoutBreakdown(100, '0.00001')).toThrow(RangeError);
    expect(() => payoutBreakdown(100, 'abc')).toThrow(RangeError);
  });
});

describe('bank details', () => {
  it('masks all but the last four digits', () => {
    expect(maskAccount('1234567890')).toBe('••••7890');
  });

  it('accepts digits only, 6 to 20 of them', () => {
    for (const ok of ['123456', '0123456789', '12345678901234567890']) expect(BANK_LIMITS.accountNumberPattern.test(ok)).toBe(true);
    for (const bad of ['12345', '123-456-789', '12345 67890', 'ABC1234567', '123456789012345678901']) {
      expect(BANK_LIMITS.accountNumberPattern.test(bad)).toBe(false);
    }
  });
});

describe('completion transitions (T20)', () => {
  it('the buyer confirms or reports a problem; the owner can complete by hand; nothing completes by itself', () => {
    expect(nextOrderStatus('ARRIVED', 'CONFIRM_RECEIVED')).toBe('COMPLETED');
    expect(nextOrderStatus('ARRIVED', 'REPORT_DELIVERY_ISSUE')).toBe('DELIVERY_ISSUE');
    expect(nextOrderStatus('ARRIVED', 'ADMIN_COMPLETE')).toBe('COMPLETED');
    expect(nextOrderStatus('DELIVERY_ISSUE', 'CONFIRM_RECEIVED')).toBe('COMPLETED');
    expect(nextOrderStatus('DELIVERY_ISSUE', 'ADMIN_COMPLETE')).toBe('COMPLETED');
    expect(nextOrderStatus('DELIVERY_ISSUE', 'REPORT_DELIVERY_ISSUE')).toBeNull();
    expect(nextOrderStatus('SHIPPED', 'CONFIRM_RECEIVED')).toBeNull();
    expect(nextOrderStatus('ARRIVED', 'CANCEL')).toBeNull();
    for (const action of ['CONFIRM_RECEIVED', 'REPORT_DELIVERY_ISSUE', 'ADMIN_COMPLETE', 'CANCEL'] as const) {
      expect(nextOrderStatus('COMPLETED', action)).toBeNull();
    }
  });
});
