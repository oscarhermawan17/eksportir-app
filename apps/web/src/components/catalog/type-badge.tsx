import type { ProductType } from '@balitrade/shared';

const TONES: Record<ProductType, { text: string; dot: string }> = {
  READY_STOCK: { text: 'text-success', dot: 'bg-success' },
  MADE_TO_ORDER: { text: 'text-warning', dot: 'bg-warning' },
};

/**
 * "Ready stock" (green) / "Made to order" (amber): a coloured dot and a label, not a pill (design system v2).
 * It never wraps; on a narrow two-column card it truncates rather than pushing the card wider.
 */
export function TypeBadge({ type, label, className = '' }: { type: ProductType; label: string; className?: string }) {
  const tone = TONES[type];
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium ${tone.text} ${className}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
