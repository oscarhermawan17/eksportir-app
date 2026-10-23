import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '@balitrade/shared';
import type { Request } from 'express';

export type RequestWithUser = Request & { user?: AuthUser };

/** Injects the user attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  if (!request.user) {
    throw new Error('CurrentUser used on a route without JwtAuthGuard');
  }
  return request.user;
});
