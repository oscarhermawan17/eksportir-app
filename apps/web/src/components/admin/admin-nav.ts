import type { AuthUser, Role } from '@balitrade/shared';
import { Banknote, ClipboardList, Coins, LayoutDashboard, ShoppingCart, UserCheck, type LucideIcon } from 'lucide-react';

export interface AdminNavItem {
  href: string;
  /** Key under the `Admin.nav` messages. */
  key: string;
  icon: LucideIcon;
  /** Admin roles allowed to open the page; the menu hides everything else. */
  roles: Role[];
}

const OPS: Role[] = ['ADMIN_OPS', 'ADMIN_OWNER'];
const FINANCE: Role[] = ['ADMIN_FINANCE', 'ADMIN_OWNER'];
const EVERY_ADMIN: Role[] = ['ADMIN_OPS', 'ADMIN_FINANCE', 'ADMIN_OWNER'];

/** The admin sidebar, in order. QC (T18), shipping (T19) and payouts (T20) join later. */
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard, roles: EVERY_ADMIN },
  { href: '/admin/sellers', key: 'sellers', icon: UserCheck, roles: OPS },
  { href: '/admin/products', key: 'listings', icon: ClipboardList, roles: OPS },
  { href: '/admin/orders', key: 'orders', icon: ShoppingCart, roles: EVERY_ADMIN },
  { href: '/admin/payments', key: 'payments', icon: Banknote, roles: FINANCE },
  { href: '/admin/exchange-rate', key: 'rates', icon: Coins, roles: ['ADMIN_OWNER'] },
];

export function navItemsFor(user: AuthUser): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => item.roles.some((role) => user.roles.includes(role)));
}

/** The deepest menu entry matching the current path; used for the active marker and the top-bar title. */
export function activeNavItem(pathname: string): AdminNavItem | null {
  const matches = ADMIN_NAV.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return matches.reduce<AdminNavItem | null>((best, item) => (best === null || item.href.length > best.href.length ? item : best), null);
}
