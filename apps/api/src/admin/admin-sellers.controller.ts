import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { SellerStatus } from '@balitrade/shared';
import type { AdminSellerView, AuthUser } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RejectSellerDto } from '../sellers/dto/seller-profile.dto.js';
import { SellersService } from '../sellers/sellers.service.js';

/** Seller approval is an ADMIN_OPS task (ARCHITECTURE §4); the owner can do everything. */
@Controller('admin/sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OPS', 'ADMIN_OWNER')
export class AdminSellersController {
  constructor(private readonly sellers: SellersService) {}

  @Get()
  list(
    @Query('status', new ParseEnumPipe(SellerStatus, { optional: true })) status?: SellerStatus,
  ): Promise<AdminSellerView[]> {
    return this.sellers.listForAdmin(status);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @CurrentUser() admin: AuthUser): Promise<AdminSellerView> {
    return this.sellers.approve(id, admin.id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @CurrentUser() admin: AuthUser, @Body() dto: RejectSellerDto): Promise<AdminSellerView> {
    return this.sellers.reject(id, admin.id, dto.reason);
  }
}
