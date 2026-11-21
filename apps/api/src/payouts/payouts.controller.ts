import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import type { AuthUser, OrderPayoutView, PayoutPreview, SellerBankView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RecordPayoutDto, SellerBankDto } from './dto/payouts.dto.js';
import { PayoutsService } from './payouts.service.js';

/** The seller's bank details and the payout of an order (T20). Who may see what is decided in PayoutsService. */
@Controller()
@UseGuards(JwtAuthGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('sellers/me/bank')
  async myBank(@CurrentUser() user: AuthUser): Promise<{ bank: SellerBankView | null }> {
    return { bank: await this.payouts.myBank(user) };
  }

  @Put('sellers/me/bank')
  async setMyBank(@CurrentUser() user: AuthUser, @Body() dto: SellerBankDto): Promise<{ bank: SellerBankView }> {
    return { bank: await this.payouts.setMyBank(user, dto) };
  }

  @Get('orders/:id/payout')
  forOrder(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderPayoutView> {
    return this.payouts.forOrder(user, id);
  }
}

/**
 * The admin side. Reading the bank details for a transfer is FINANCE's and the OWNER's; recording the payout — the
 * moment money is declared sent — is the OWNER's alone (ARCHITECTURE §4).
 */
@Controller('admin/orders/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('payout-preview')
  @Roles('ADMIN_FINANCE', 'ADMIN_OWNER')
  preview(@Param('id') id: string): Promise<PayoutPreview> {
    return this.payouts.preview(id);
  }

  @Post('payout')
  @Roles('ADMIN_OWNER')
  record(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RecordPayoutDto): Promise<OrderPayoutView> {
    return this.payouts.record(admin, id, dto);
  }
}
