import type { SellerStatus } from '@balitrade/shared';

const TONES: Record<SellerStatus, string> = {
  PENDING: 'bg-warning/15 text-[#8a5a00] border-warning/40',
  APPROVED: 'bg-success/10 text-success border-success/30',
  REJECTED: 'bg-error/10 text-error border-error/30',
};

export function StatusBadge({ status, label }: { status: SellerStatus; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[status]}`}>
      {label}
    </span>
  );
}
