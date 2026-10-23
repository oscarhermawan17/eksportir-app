import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@balitrade/shared';
import type { RequestWithUser } from './current-user.decorator.js';
import { ROLES_KEY } from './roles.decorator.js';

/**
 * Checks @Roles() metadata against the user attached by JwtAuthGuard, so it must run after it:
 * `@UseGuards(JwtAuthGuard, RolesGuard)`. Routes without @Roles() only require being logged in.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user) {
      throw new UnauthorizedException();
    }
    if (!user.roles.some((role) => required.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
