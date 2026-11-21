import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, OrderStatus } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CompleteOrderDto, ReportDeliveryIssueDto } from './dto/completion.dto.js';
import { CompletionService } from './completion.service.js';

/** The buyer's side of completing an order (T20). Who may act is decided in CompletionService from the order itself. */
@Controller('orders/:id')
@UseGuards(JwtAuthGuard)
export class CompletionController {
  constructor(private readonly completion: CompletionService) {}

  @Post('confirm-received')
  @HttpCode(200)
  confirmReceived(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<{ status: OrderStatus }> {
    return this.completion.confirmReceived(user, id);
  }

  @Post('report-delivery-issue')
  @HttpCode(200)
  reportIssue(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReportDeliveryIssueDto): Promise<{ status: OrderStatus }> {
    return this.completion.reportIssue(user, id, dto.reason);
  }
}

/** Completing an order by hand is the OWNER's decision alone (T20), and it is audited. */
@Controller('admin/orders/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OWNER')
export class AdminCompletionController {
  constructor(private readonly completion: CompletionService) {}

  @Post('complete')
  @HttpCode(200)
  complete(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: CompleteOrderDto): Promise<{ status: OrderStatus }> {
    return this.completion.completeByAdmin(admin, id, dto.note);
  }
}
