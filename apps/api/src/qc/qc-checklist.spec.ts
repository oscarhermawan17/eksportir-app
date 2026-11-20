import { QC_CHECKLIST, QC_LIMITS, qcAutoApproveAt, qcChecklistProblem } from '@balitrade/shared';
import type { QcChecklistEntry } from '@balitrade/shared';

const allPass = (): QcChecklistEntry[] => QC_CHECKLIST.map((key) => ({ key, result: 'PASS' as const }));

describe('qcChecklistProblem (T18)', () => {
  it('accepts every line exactly once', () => {
    expect(qcChecklistProblem(allPass())).toBeNull();
  });

  it('refuses a missing, duplicated or unknown line', () => {
    expect(qcChecklistProblem(allPass().slice(1))).toBe('MISSING_OR_DUPLICATE');
    const duplicated = allPass();
    duplicated[1] = { ...duplicated[0]! };
    expect(qcChecklistProblem(duplicated)).toBe('MISSING_OR_DUPLICATE');
    expect(qcChecklistProblem([...allPass(), { key: 'QUANTITY', result: 'PASS' }])).toBe('MISSING_OR_DUPLICATE');
    expect(qcChecklistProblem([])).toBe('MISSING_OR_DUPLICATE');
  });

  it('a failed line needs a note the buyer can read', () => {
    const failed = allPass();
    failed[2] = { key: failed[2]!.key, result: 'FAIL' };
    expect(qcChecklistProblem(failed)).toBe('FAIL_NEEDS_NOTE');
    failed[2] = { key: failed[2]!.key, result: 'FAIL', note: '   ' };
    expect(qcChecklistProblem(failed)).toBe('FAIL_NEEDS_NOTE');
    failed[2] = { key: failed[2]!.key, result: 'FAIL', note: '3 of 50 baskets have a cracked rim' };
    expect(qcChecklistProblem(failed)).toBeNull();
  });
});

describe('qcAutoApproveAt', () => {
  it('is autoApproveHours after the report', () => {
    const created = new Date('2026-11-20T10:00:00.000Z');
    expect(QC_LIMITS.autoApproveHours).toBe(48);
    expect(qcAutoApproveAt(created).toISOString()).toBe('2026-11-22T10:00:00.000Z');
  });
});
