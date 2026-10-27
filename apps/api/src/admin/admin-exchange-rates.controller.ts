import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, ExchangeRateView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { SetExchangeRateDto } from '../fx/dto/exchange-rate.dto.js';
import { FxService } from '../fx/fx.service.js';

/** Setting the rate changes every buyer-facing price, so only the owner may do it (ARCHITECTURE §4). */
@Controller('admin/exchange-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OWNER')
export class AdminExchangeRatesController {
  constructor(private readonly fx: FxService) {}

  @Get()
  history(): Promise<ExchangeRateView[]> {
    return this.fx.history();
  }

  @Post()
  set(@Body() dto: SetExchangeRateDto, @CurrentUser() admin: AuthUser): Promise<ExchangeRateView> {
    return this.fx.set(dto.rate, admin.id);
  }
}
