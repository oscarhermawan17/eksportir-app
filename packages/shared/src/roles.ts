/**
 * User roles. Must stay in sync with the `Role` enum in apps/api/prisma/schema.prisma.
 * A user can hold several roles (e.g. ADMIN_FINANCE + ADMIN_OPS).
 */
export const Role = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN_OWNER: 'ADMIN_OWNER',
  ADMIN_FINANCE: 'ADMIN_FINANCE',
  ADMIN_OPS: 'ADMIN_OPS',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const ADMIN_ROLES: readonly Role[] = [Role.ADMIN_OWNER, Role.ADMIN_FINANCE, Role.ADMIN_OPS];

export function isAdmin(roles: readonly Role[]): boolean {
  return roles.some((role) => ADMIN_ROLES.includes(role));
}
