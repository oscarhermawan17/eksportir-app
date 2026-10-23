import { SetMetadata } from '@nestjs/common';
import type { Role } from '@balitrade/shared';

export const ROLES_KEY = 'roles';

/** Allows the route for users holding at least one of the given roles. Use together with JwtAuthGuard + RolesGuard. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
