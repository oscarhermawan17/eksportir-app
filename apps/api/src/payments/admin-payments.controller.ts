import { Controller, Get, Param, Post, Query, UseGuards, Body } from '@nestjs/common';
import type { AuthUser, PageResult, PaymentView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminPaymentQueryDto } from './dto/admin-payment-query.dto.js';
import { RejectPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';

/** Money is an ADMIN_FINANCE task (ARCHITECTURE §4); the owner can do everything. */
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_FINANCE', 'ADMIN_OWNER')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(@Query() query: AdminPaymentQueryDto): Promise<PageResult<PaymentView>> {
    return this.payments.adminList(query);
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
