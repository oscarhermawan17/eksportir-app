import { Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards, Body } from '@nestjs/common';
import { PaymentStatus } from '@balitrade/shared';
import type { AuthUser, PaymentView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RejectPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';

/** Money is an ADMIN_FINANCE task (ARCHITECTURE §4); the owner can do everything. */
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_FINANCE', 'ADMIN_OWNER')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query('status', new ParseEnumPipe(PaymentStatus, { optional: true })) status?: PaymentStatus): Promise<PaymentView[]> {
    return this.payments.adminList(status);
  }

  @Post(':id/verify')
  verify(@CurrentUser() admin: AuthUser, @Param('id') id: string): Promise<PaymentView> {
    return this.payments.verify(admin, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: RejectPaymentDto): Promise<PaymentView> {
    return this.payments.reject(admin, id, dto.reason);
  }
}
