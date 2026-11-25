import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import type { AdminPaymentSettingsView, AuthUser } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PaymentSettingsDto } from './dto/payment-settings.dto.js';
import { PaymentSettingsService } from './payment-settings.service.js';

/**
 * Where buyers send their money (2026-11-26). FINANCE reads it to match bank statements and wallets; only the OWNER may
 * change it (owner's decision), because a changed account number moves every later payment. Every save is audited.
 */
@Controller('admin/payment-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPaymentSettingsController {
  constructor(private readonly settings: PaymentSettingsService) {}

  @Get()
  @Roles('ADMIN_FINANCE', 'ADMIN_OWNER')
  get(): Promise<AdminPaymentSettingsView> {
    return this.settings.adminView();
  }

  @Put()
  @Roles('ADMIN_OWNER')
  save(@Body() dto: PaymentSettingsDto, @CurrentUser() owner: AuthUser): Promise<AdminPaymentSettingsView> {
    return this.settings.save(dto, owner.id);
  }
}
