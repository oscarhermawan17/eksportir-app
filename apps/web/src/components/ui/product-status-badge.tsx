import type { ProductStatus } from '@balitrade/shared';

/** Amber = waiting on BaliTrade, green = in the shop, red = back with the seller, grey = put away. */
const TONES: Record<ProductStatus, string> = {
  DRAFT: 'bg-muted/10 text-muted border-muted/30',
  PENDING_REVIEW: 'bg-warning/15 text-[#8a5a00] border-warning/40',
  APPROVED: 'bg-success/10 text-success border-success/30',
  REJECTED: 'bg-error/10 text-error border-error/30',
  ARCHIVED: 'bg-muted/10 text-muted border-muted/30',
};

export function ProductStatusBadge({ status, label }: { status: ProductStatus; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TONES[status]}`}>{label}</span>
  );
}

/** Same pill for the warnings that sit next to a status, e.g. a category an admin switched off. */
export function ProductWarningBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-[#8a5a00]">
      {children}
    </span>
  );
}
