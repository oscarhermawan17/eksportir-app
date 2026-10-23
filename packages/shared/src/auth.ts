import type { Locale } from './locales.js';
import type { Role } from './roles.js';

/**
 * Roles a person may pick when registering publicly. SELLER only means "applicant":
 * selling requires an APPROVED SellerProfile (admin decision, T07). Admin roles are
 * only granted by the seed / an owner from the admin dashboard.
 */
export const SELF_REGISTER_ROLES = [
  'BUYER',
  'SELLER',
] as const satisfies readonly Role[];

export type SelfRegisterRole = (typeof SELF_REGISTER_ROLES)[number];

/** The logged-in user as returned by the auth endpoints (never includes the password hash). */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  locale: Locale;
  roles: Role[];
}
