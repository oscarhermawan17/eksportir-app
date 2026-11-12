import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '@balitrade/shared';

/**
 * Rate limit for the upload endpoints, counted **per signed-in user** rather than per IP.
 *
 * Per IP would be wrong in both directions here: several sellers sharing one office connection (or one
 * mobile carrier NAT) would eat each other's quota, while one account could spread an abusive run over a
 * handful of addresses. Every route this guards sits behind JwtAuthGuard, so a user is always present;
 * the IP fallback only covers the case where the guard is ever put somewhere public by mistake.
 */
@Injectable()
export class UploadThrottleGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as Request & { user?: AuthUser }).user;
    return user ? `user:${user.id}` : `ip:${req.ip ?? 'unknown'}`;
  }
}
