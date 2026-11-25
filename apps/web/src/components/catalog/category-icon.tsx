import type { CategoryIconName } from '@balitrade/shared';
import {
  Armchair,
  Bath,
  Briefcase,
  Brush,
  Coffee,
  Cookie,
  Flower2,
  Footprints,
  Gem,
  Gift,
  Glasses,
  Hammer,
  Lamp,
  LayoutGrid,
  Leaf,
  Package,
  Palette,
  Shapes,
  Shell,
  Shirt,
  Sparkles,
  Sprout,
  TreePalm,
  Utensils,
  Watch,
  Wine,
  type LucideIcon,
} from 'lucide-react';

/**
 * Every name the OWNER may pick (CATEGORY_ICON_NAMES in packages/shared) mapped to an icon bundled here.
 * Typed as a full Record, so a name added to the shared list without an icon here fails the typecheck.
 */
export const CATEGORY_ICONS: Record<CategoryIconName, LucideIcon> = {
  shirt: Shirt,
  gem: Gem,
  coffee: Coffee,
  leaf: Leaf,
  sprout: Sprout,
  flower: Flower2,
  gift: Gift,
  package: Package,
  palette: Palette,
  brush: Brush,
  hammer: Hammer,
  armchair: Armchair,
  lamp: Lamp,
  footprints: Footprints,
  briefcase: Briefcase,
  watch: Watch,
  glasses: Glasses,
  sparkles: Sparkles,
  bath: Bath,
  utensils: Utensils,
  cookie: Cookie,
  wine: Wine,
  shell: Shell,
  'tree-palm': TreePalm,
};

/** Shown for a category without an icon. */
export const DEFAULT_CATEGORY_ICON: LucideIcon = Shapes;

/** `all` is the "All categories" chip; a missing or unknown name gets the default. */
export function CategoryIcon({ name, className = 'h-4 w-4' }: { name?: string | null; className?: string }) {
  const Icon =
    name === 'all'
      ? LayoutGrid
      : name && Object.hasOwn(CATEGORY_ICONS, name)
        ? CATEGORY_ICONS[name as CategoryIconName]
        : DEFAULT_CATEGORY_ICON;
  return <Icon className={`shrink-0 ${className}`} aria-hidden="true" />;
}
