import type { ProductType } from '@balitrade/shared';

const TONES: Record<ProductType, string> = {
  READY_STOCK: 'border-primary/25 bg-primary/10 text-primary',
  MADE_TO_ORDER: 'border-terracotta/30 bg-terracotta/10 text-terracotta',
};

/**
 * "Ready stock" (teal) / "Made to order" (terracotta), as in the design system.
 *
 * It never wraps: a pill broken over two lines stops looking like a pill, and on a two-column phone
 * grid the longest label ("Dibuat sesuai pesanan") did exactly that. It shrinks a step on small
 * screens instead, and truncates rather than pushing the card wider if a label ever outgrows that.
 */
export function TypeBadge({ type, label }: { type: ProductType; label: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${TONES[type]}`}
    >
      {label}
    </span>
  );
}
