import type { AuthUser } from '@balitrade/shared';

/**
 * Where each role belongs: sellers and admins work in their own area, not in the shop, so that is
 * where signing in lands them and where the logo points. Buyers get the catalog.
 */
export function homePathFor(user: AuthUser | null): string {
  if (user === null) {
    return '/';
  }
  if (isAdmin(user)) {
    return '/admin';
  }
  if (user.roles.includes('SELLER')) {
    return '/seller';
  }
  return '/';
}

/**
 * Which area's order pages this person belongs in. Every link to an order — the account menu, a
 * notification — goes through here, so a seller is not thrown into the storefront chrome and an admin
 * not out of theirs. The storefront `/orders` keeps working for all three, so older links stay alive.
 */
export function ordersBasePathFor(user: AuthUser | null): string {
  if (user === null) {
    return '/orders';
  }
  if (isAdmin(user)) {
    return '/admin/orders';
  }
  return user.roles.includes('SELLER') ? '/seller/orders' : '/orders';
}

/** True for any admin role: admin accounts neither buy nor sell (a person who does both uses a second account). */
export function isAdmin(user: AuthUser): boolean {
  return user.roles.some((role) => role === 'ADMIN_OPS' || role === 'ADMIN_OWNER' || role === 'ADMIN_FINANCE');
}
