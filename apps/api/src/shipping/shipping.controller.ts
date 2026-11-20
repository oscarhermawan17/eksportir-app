import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type { AuthUser, ShippingBillResponse, TrackingResponse } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ShippingService } from './shipping.service.js';

/**
 * Shipping as the people in an order see it (T19). ShippingService decides from their place in the order: the bill is
 * for the buyer and admins, the tracking also for the seller; anyone else gets 404.
 */
@Controller('orders/:id')
@UseGuards(JwtAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Get('shipping-bill')
  bill(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ShippingBillResponse> {
    return this.shipping.bill(user, id);
  }

  @Get('tracking')
  tracking(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<TrackingResponse> {
    return this.shipping.tracking(user, id);
  }
}
