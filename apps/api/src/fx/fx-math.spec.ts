import { idrToUsd } from './fx-math.js';

describe('idrToUsd', () => {
  it('divides the rupiah price by the rate', () => {
    expect(idrToUsd(100_000, '16000')).toBe('6.25');
    expect(idrToUsd(160_000, '16000.0000')).toBe('10.00');
  });

  it('rounds half up to whole cents', () => {
    // 1 / 16000 = 0.0000625 → 0.00; 8 / 16 = 0.5 exactly; 10 / 16 = 0.625 → 0.63 (half up)
    expect(idrToUsd(10, '16')).toBe('0.63');
    expect(idrToUsd(1, '16000')).toBe('0.00');
    expect(idrToUsd(99_999, '16250.5')).toBe('6.15');
  });

  it('uses the exact decimal rate, including 4 decimal places', () => {
    expect(idrToUsd(162_505, '16250.5000')).toBe('10.00');
    expect(idrToUsd(100_000, '16250.1234')).toBe('6.15');
  });

  it('a higher rate gives a lower USD price', () => {
    expect(Number(idrToUsd(500_000, '17000'))).toBeLessThan(Number(idrToUsd(500_000, '16000')));
  });

  it('rejects a zero or negative rate instead of returning Infinity', () => {
    expect(() => idrToUsd(100_000, '0')).toThrow(RangeError);
    expect(() => idrToUsd(100_000, '-16000')).toThrow(RangeError);
  });
});
