import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { RequestWithUser } from '../auth/current-user.decorator.js';

/**
 * Only sellers whose profile an admin has APPROVED may pass. Use after JwtAuthGuard:
 * `@UseGuards(JwtAuthGuard, ApprovedSellerGuard)` — put it on every endpoint that lists or sells products.
 */
@Injectable()
export class ApprovedSellerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest<RequestWithUser>();
    if (!user) {
      throw new UnauthorizedException();
    }
    const profile = await this.prisma.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { status: true },
    });
    if (profile?.status !== 'APPROVED') {
      throw new ForbiddenException('Your seller account has not been approved yet');
    }
    return true;
  }
}
