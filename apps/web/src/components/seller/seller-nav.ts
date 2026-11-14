import { Headset, LayoutDashboard, Package, ShoppingCart, Store, type LucideIcon } from 'lucide-react';
import { deepestMatch } from '@/lib/nav';

export interface SellerNavItem {
  href: string;
  /** Key under the `Seller.nav` messages. */
  key: string;
  icon: LucideIcon;
  /**
   * Shown in the menu but not built yet, so it is rendered as plain text instead of a link: a seller
   * can see the area is planned without walking into a dead end. Direct chat with BaliTrade is T29.
   */
  soon?: boolean;
}

/**
 * The seller sidebar (and the mobile bottom bar), in order — one source for both. Unlike `ADMIN_NAV`
 * there is no per-role filtering: a seller has one role, and every page here is theirs.
 */
export const SELLER_NAV: SellerNavItem[] = [
  { href: '/seller', key: 'dashboard', icon: LayoutDashboard },
  { href: '/seller/orders', key: 'orders', icon: ShoppingCart },
  { href: '/seller/products', key: 'products', icon: Package },
  { href: '/seller/support', key: 'support', icon: Headset, soon: true },
  { href: '/seller/account', key: 'account', icon: Store },
];

/** The menu entry the current path belongs to; used for the active marker and the top-bar title. */
export function activeSellerNavItem(pathname: string): SellerNavItem | null {
  return deepestMatch(SELLER_NAV, pathname);
}
