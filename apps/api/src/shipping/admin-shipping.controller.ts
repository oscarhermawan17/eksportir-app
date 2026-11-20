import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, ShippingBillResponse, TrackingResponse } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AddTrackingEventDto, IssueShippingBillDto } from './dto/shipping.dto.js';
import { ShippingService } from './shipping.service.js';

/**
 * The OPS side of shipping (T19): packing, weighing and billing, then the tracking milestones. Confirming that the
 * shipping is paid is FINANCE's step and lives with the other money routes (AdminOrderPaymentsController).
 */
@Controller('admin/orders/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OPS', 'ADMIN_OWNER')
export class AdminShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post('shipping-bill')
  issueBill(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: IssueShippingBillDto): Promise<ShippingBillResponse> {
    return this.shipping.issueBill(admin, id, dto);
  }

  @Post('tracking')
  addEvent(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: AddTrackingEventDto): Promise<TrackingResponse> {
    return this.shipping.addEvent(admin, id, dto);
  }
}
