import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DEFAULT_PAGE_SIZE } from '@balitrade/shared';
import type { AdminSellerView, PageResult, PageSize, QcZoneOption, SellerProfileView, SellerStatus } from '@balitrade/shared';
import { endOfBusinessDay, startOfBusinessDay } from '../common/business-day.js';
import { escapeLike } from '../common/escape-like.js';
import { Prisma, Role } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminSellerQueryDto } from './dto/admin-seller-query.dto.js';
import type { ApplySellerDto, UpdateSellerDto } from './dto/seller-profile.dto.js';

const profileInclude = { qcZone: true, user: true } satisfies Prisma.SellerProfileInclude;
type ProfileWithRelations = Prisma.SellerProfileGetPayload<{ include: typeof profileInclude }>;

@Injectable()
export class SellersService {
  constructor(private readonly prisma: PrismaService) {}

  listQcZones(): Promise<QcZoneOption[]> {
    return this.prisma.qcZone.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  }

  async getOwn(userId: string): Promise<SellerProfileView> {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { userId }, include: profileInclude });
    if (!profile) {
      throw new NotFoundException('You have not applied as a seller');
    }
    return toProfileView(profile);
  }

  /** An existing account (e.g. a buyer) applies to become a seller. The SELLER role is a request, not permission to sell. */
  async apply(userId: string, dto: ApplySellerDto): Promise<SellerProfileView> {
    await this.assertZoneExists(dto.qcZoneId);
    try {
      const profile = await this.prisma.$transaction(async (tx) => {
        const created = await tx.sellerProfile.create({
          data: { userId, displayName: dto.displayName, about: dto.about, qcZoneId: dto.qcZoneId },
          include: profileInclude,
        });
        await tx.user.update({
          where: { id: userId },
          data: { roles: { set: await rolesWithSeller(tx, userId) } },
        });
        return created;
      });
      return toProfileView(profile);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('You have already applied as a seller');
      }
      throw error;
    }
  }

  /**
   * Sellers edit their own profile. A rejected seller who edits resubmits the application (back to PENDING).
   * Once approved, the location (which sets the QC fee) can only be changed by an admin.
   */
  async updateOwn(userId: string, dto: UpdateSellerDto): Promise<SellerProfileView> {
    const current = await this.prisma.sellerProfile.findUnique({ where: { userId } });
    if (!current) {
      throw new NotFoundException('You have not applied as a seller');
    }
    if (current.status === 'APPROVED' && dto.qcZoneId !== undefined && dto.qcZoneId !== current.qcZoneId) {
      throw new ForbiddenException('Location of an approved seller can only be changed by BaliTrade');
    }
    await this.assertZoneExists(dto.qcZoneId);

    const resubmit = current.status === 'REJECTED';
    const profile = await this.prisma.sellerProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        about: dto.about,
        qcZoneId: dto.qcZoneId,
        ...(resubmit
          ? { status: 'PENDING', rejectionReason: null, reviewedAt: null, reviewedById: null }
          : {}),
      },
      include: profileInclude,
    });
    return toProfileView(profile);
  }

  /**
   * The seller applications table (T27), paged on the server. Search matches the shop name, the owner's name or
   * their email; the day range is on the application date. Oldest first, as before: an approval queue is worked
   * in the order people applied. `statusCounts` ignores the status filter, so each tab can show its size.
   */
  async listForAdmin(query: AdminSellerQueryDto = {}): Promise<PageResult<AdminSellerView>> {
    const size: PageSize = query.size ?? DEFAULT_PAGE_SIZE;
    const page = query.page ?? 1;
    const base: Prisma.SellerProfileWhereInput = {};
    if (query.q) {
      const contains = { contains: escapeLike(query.q), mode: 'insensitive' as const };
      base.OR = [{ displayName: contains }, { user: { name: contains } }, { user: { email: contains } }];
    }
    const from = startOfBusinessDay(query.from);
    const to = endOfBusinessDay(query.to);
    if (from || to) base.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const where: Prisma.SellerProfileWhereInput = query.status ? { ...base, status: query.status } : base;

    const [total, profiles, byStatus] = await this.prisma.$transaction(
      [
        this.prisma.sellerProfile.count({ where }),
        this.prisma.sellerProfile.findMany({
          where,
          include: profileInclude,
          // `id` breaks ties so offset paging never repeats or skips a row with the same timestamp.
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * size,
          take: size,
        }),
        this.prisma.sellerProfile.groupBy({ by: ['status'], where: base, orderBy: { status: 'asc' }, _count: { _all: true } }),
      ],
      // One snapshot for all three reads, so the tab counts always add up to the total.
      { isolationLevel: 'RepeatableRead' },
    );

    return {
      // A user deleted between the reads leaves `user` null; skip such a row instead of failing the whole list.
      items: profiles.filter((profile) => (profile.user as ProfileWithRelations['user'] | null) !== null).map(toAdminView),
      total,
      page,
      size,
      statusCounts: Object.fromEntries(byStatus.map((row) => [row.status, (row._count as { _all: number })._all])),
    };
  }

  async approve(profileId: string, adminId: string): Promise<AdminSellerView> {
    const profile = await this.findForReview(profileId);
    if (profile.status === 'APPROVED') {
      throw new ConflictException('Seller is already approved');
    }
    if (!profile.qcZoneId) {
      throw new BadRequestException('The seller has not chosen a location yet');
    }
    return this.review(profileId, adminId, { status: 'APPROVED', rejectionReason: null });
  }

  async reject(profileId: string, adminId: string, reason: string): Promise<AdminSellerView> {
    const profile = await this.findForReview(profileId);
    if (profile.status === 'REJECTED') {
      throw new ConflictException('Seller is already rejected');
    }
    return this.review(profileId, adminId, { status: 'REJECTED', rejectionReason: reason });
  }

  private async review(
    profileId: string,
    adminId: string,
    data: { status: SellerStatus; rejectionReason: string | null },
  ): Promise<AdminSellerView> {
    const updated = await this.prisma.sellerProfile.update({
      where: { id: profileId },
      data: { ...data, reviewedById: adminId, reviewedAt: new Date() },
      include: profileInclude,
    });
    return toAdminView(updated);
  }

  private async findForReview(profileId: string) {
    const profile = await this.prisma.sellerProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException('Seller application not found');
    }
    return profile;
  }

  private async assertZoneExists(qcZoneId: string | undefined): Promise<void> {
    if (qcZoneId === undefined) {
      return;
    }
    const zone = await this.prisma.qcZone.findUnique({ where: { id: qcZoneId }, select: { id: true } });
    if (!zone) {
      throw new BadRequestException('Unknown location');
    }
  }
}

async function rolesWithSeller(tx: Prisma.TransactionClient, userId: string): Promise<Role[]> {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { roles: true } });
  return user.roles.includes(Role.SELLER) ? user.roles : [...user.roles, Role.SELLER];
}

function toProfileView(profile: ProfileWithRelations): SellerProfileView {
  return {
    id: profile.id,
    displayName: profile.displayName,
    about: profile.about,
    qcZone: profile.qcZone ? { id: profile.qcZone.id, name: profile.qcZone.name } : null,
    status: profile.status,
    rejectionReason: profile.rejectionReason,
  };
}

function toAdminView(profile: ProfileWithRelations): AdminSellerView {
  return {
    ...toProfileView(profile),
    createdAt: profile.createdAt.toISOString(),
    reviewedAt: profile.reviewedAt?.toISOString() ?? null,
    qcZone: profile.qcZone
      ? { id: profile.qcZone.id, name: profile.qcZone.name, feeUsd: profile.qcZone.feeUsd.toFixed(2) }
      : null,
    user: { id: profile.user.id, name: profile.user.name, email: profile.user.email, phone: profile.user.phone },
  };
}
