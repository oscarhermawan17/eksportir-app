import type { ProductType } from '@balitrade/shared';

const TONES: Record<ProductType, string> = {
  READY_STOCK: 'border-primary/25 bg-primary/10 text-primary',
  MADE_TO_ORDER: 'border-terracotta/30 bg-terracotta/10 text-terracotta',
};

/** Over a photo the tinted background disappears, so the pill gets an opaque one and a little lift. */
const TONES_ON_IMAGE: Record<ProductType, string> = {
  READY_STOCK: 'border-primary/25 bg-card text-primary shadow-sm',
  MADE_TO_ORDER: 'border-terracotta/30 bg-card text-terracotta shadow-sm',
};

/**
 * "Ready stock" (teal) / "Made to order" (terracotta), as in the design system.
 *
 * It never wraps: a pill broken over two lines stops looking like a pill, and on a two-column phone
 * grid the longest label ("Dibuat sesuai pesanan") did exactly that. It shrinks a step on small
 * screens instead, and truncates rather than pushing the card wider if a label ever outgrows that.
 */
export function TypeBadge({ type, label, onImage = false }: { type: ProductType; label: string; onImage?: boolean }) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold sm:px-2.5 sm:text-xs ${
        onImage ? TONES_ON_IMAGE[type] : TONES[type]
      }`}
    >
      {label}
    </span>
  );
}
