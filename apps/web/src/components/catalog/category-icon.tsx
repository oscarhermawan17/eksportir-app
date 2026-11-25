import {
  Armchair,
  Briefcase,
  Coffee,
  Flower2,
  Footprints,
  Gem,
  Gift,
  LayoutGrid,
  Leaf,
  Package,
  Palette,
  Shapes,
  Shirt,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icons a category may use, by name. Categories carry no icon yet (the owner will pick one per category
 * on /admin/categories later), so every category falls back to `DEFAULT_ICON` until then. Keeping the list
 * closed means a stored name can only ever pick one of these, never load anything else.
 */
export const CATEGORY_ICONS = {
  armchair: Armchair,
  briefcase: Briefcase,
  coffee: Coffee,
  flower: Flower2,
  footprints: Footprints,
  gem: Gem,
  gift: Gift,
  leaf: Leaf,
  package: Package,
  palette: Palette,
  shirt: Shirt,
  sparkles: Sparkles,
} as const satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;

const DEFAULT_ICON: LucideIcon = Shapes;

/** `all` is the "All categories" chip; an unknown or missing name gets the default. */
export function CategoryIcon({ name, className = 'h-4 w-4' }: { name?: string | null | 'all'; className?: string }) {
  const Icon =
    name === 'all' ? LayoutGrid : name && name in CATEGORY_ICONS ? CATEGORY_ICONS[name as CategoryIconName] : DEFAULT_ICON;
  return <Icon className={`shrink-0 ${className}`} aria-hidden="true" />;
}
