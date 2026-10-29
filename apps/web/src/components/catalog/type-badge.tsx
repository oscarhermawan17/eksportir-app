import type { ProductType } from '@balitrade/shared';

const TONES: Record<ProductType, string> = {
  READY_STOCK: 'border-primary/25 bg-primary/10 text-primary',
  MADE_TO_ORDER: 'border-terracotta/30 bg-terracotta/10 text-terracotta',
};

/** "Ready stock" (teal) / "Made to order" (terracotta), as in the design system. */
export function TypeBadge({ type, label }: { type: ProductType; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[type]}`}>
      {label}
    </span>
  );
}
