import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, QcZoneOption, SellerProfileView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ApprovedSellerGuard } from './approved-seller.guard.js';
import { ApplySellerDto, UpdateSellerDto } from './dto/seller-profile.dto.js';
import { SellersService } from './sellers.service.js';

@Controller()
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  /** Public: locations a seller can choose from. */
  @Get('qc-zones')
  listQcZones(): Promise<QcZoneOption[]> {
    return this.sellers.listQcZones();
  }

  @Get('sellers/me')
  @UseGuards(JwtAuthGuard)
  getOwn(@CurrentUser() user: AuthUser): Promise<SellerProfileView> {
    return this.sellers.getOwn(user.id);
  }

  @Post('sellers/apply')
  @UseGuards(JwtAuthGuard)
  apply(@CurrentUser() user: AuthUser, @Body() dto: ApplySellerDto): Promise<SellerProfileView> {
    return this.sellers.apply(user.id, dto);
  }

  @Patch('sellers/me')
  @UseGuards(JwtAuthGuard)
  updateOwn(@CurrentUser() user: AuthUser, @Body() dto: UpdateSellerDto): Promise<SellerProfileView> {
    return this.sellers.updateOwn(user.id, dto);
  }

  /** Example of a seller-only action; product endpoints (T09) use the same guards. */
  @Get('seller/ping')
  @UseGuards(JwtAuthGuard, RolesGuard, ApprovedSellerGuard)
  @Roles('SELLER')
  ping(): { ok: true } {
    return { ok: true };
  }
}
