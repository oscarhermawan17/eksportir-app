import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, PaymentSummary } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PaymentsService } from './payments.service.js';

/**
 * The two steps that move an order itself. They are separate from verifying a single payment because partial
 * payments are allowed: "this money arrived" and "the order is paid" are different statements, and the second one
 * is the FINANCE admin's judgement. Starting quality control is the OPS admin's step (T18 adds the report).
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminOrderPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':id/confirm-paid')
  @Roles('ADMIN_FINANCE', 'ADMIN_OWNER')
  confirmPaid(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<PaymentSummary> {
    return this.payments.confirmPaid(admin, id);
  }

  @Post(':id/start-qc')
  @Roles('ADMIN_OPS', 'ADMIN_OWNER')
  startQc(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<PaymentSummary> {
    return this.payments.startQc(admin, id);
  }
}
