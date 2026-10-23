import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SESSION_COOKIE } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { RequestWithUser } from './current-user.decorator.js';

/** Requires a valid session cookie; the user is re-read from the DB so role changes apply immediately. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser & { cookies?: Record<string, string> }>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedException();
    }
    request.user = await this.auth.authenticate(token);
    return true;
  }
}
