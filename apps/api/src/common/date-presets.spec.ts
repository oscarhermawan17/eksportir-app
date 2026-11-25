import { matchPreset, presetRange } from '@balitrade/shared';
import { describe, expect, it } from 'vitest';

// Months are 0-based in Date: 2026-11-26 is new Date(2026, 10, 26).
const today = new Date(2026, 10, 26, 15, 30);

describe('admin date presets', () => {
  it('counts every preset inclusively back from today', () => {
    expect(presetRange('today', today)).toEqual({ from: '2026-11-26', to: '2026-11-26' });
    expect(presetRange('last7', today)).toEqual({ from: '2026-11-20', to: '2026-11-26' });
    expect(presetRange('last30', today)).toEqual({ from: '2026-10-28', to: '2026-11-26' });
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-11-01', to: '2026-11-26' });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('crosses a year boundary for last month in January', () => {
    expect(presetRange('lastMonth', new Date(2027, 0, 5))).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('recognises a stored range as a preset, and a custom range as none', () => {
    expect(matchPreset({ from: '2026-11-20', to: '2026-11-26' }, today)).toBe('last7');
    expect(matchPreset({ from: '2026-11-02', to: '2026-11-09' }, today)).toBeNull();
  });
});
