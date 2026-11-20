import { MILESTONE_ACTION, TRACKING_LIMITS, availableMilestones, nextOrderStatus, trackingMilestoneProblem } from '@balitrade/shared';

describe('tracking milestones (T19)', () => {
  it('packing comes before the bill; the cargo hand-over only after the shipping money is confirmed', () => {
    expect(trackingMilestoneProblem('QC_APPROVED', [], 'PACKED')).toBeNull();
    expect(trackingMilestoneProblem('QC_APPROVED', [], 'HANDED_TO_CARGO')).toBe('NOT_NOW');
    expect(trackingMilestoneProblem('AWAITING_SHIPPING_PAYMENT', [], 'HANDED_TO_CARGO')).toBe('NOT_NOW');
    expect(trackingMilestoneProblem('SHIPPING_PAID', [], 'HANDED_TO_CARGO')).toBeNull();
    expect(trackingMilestoneProblem('SHIPPING_PAID', [], 'DELIVERED')).toBe('NOT_NOW');
    expect(trackingMilestoneProblem('IN_QC', [], 'PACKED')).toBe('NOT_NOW');
  });

  it('in transit, every later milestone is possible, each once', () => {
    expect(availableMilestones('SHIPPED', ['PACKED', 'HANDED_TO_CARGO'])).toEqual([
      'DEPARTED_BALI',
      'ARRIVED_DESTINATION_AIRPORT',
      'CUSTOMS',
      'WITH_LOCAL_PARTNER',
      'DELIVERED',
    ]);
    expect(trackingMilestoneProblem('SHIPPED', ['CUSTOMS'], 'CUSTOMS')).toBe('ALREADY_ADDED');
    expect(availableMilestones('ARRIVED', [])).toEqual([]);
  });

  it('only the hand-over and the delivery move the order, through the order transitions', () => {
    expect(MILESTONE_ACTION).toEqual({ HANDED_TO_CARGO: 'SHIP', DELIVERED: 'DELIVER' });
    expect(nextOrderStatus('SHIPPING_PAID', MILESTONE_ACTION.HANDED_TO_CARGO!)).toBe('SHIPPED');
    expect(nextOrderStatus('SHIPPED', MILESTONE_ACTION.DELIVERED!)).toBe('ARRIVED');
  });

  it('accepts an IATA air waybill number with or without the dash', () => {
    for (const awb of ['618-12345675', '61812345675']) expect(TRACKING_LIMITS.awbPattern.test(awb)).toBe(true);
    for (const awb of ['61-812345675', 'ABC-12345678', '618-1234567', '']) expect(TRACKING_LIMITS.awbPattern.test(awb)).toBe(false);
  });
});
