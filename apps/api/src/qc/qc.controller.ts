import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, QcReportsResponse } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ReportQcIssueDto } from './dto/qc.dto.js';
import { QcService } from './qc.service.js';

/**
 * Quality control as the people in an order see it (T18). Any logged-in user may call these routes; QcService decides
 * from their place in the order: the buyer, the seller and admins read the reports, only the buyer answers them.
 */
@Controller('orders/:id/qc')
@UseGuards(JwtAuthGuard)
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<QcReportsResponse> {
    return this.qc.list(user, id);
  }

  @Post('approve')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<QcReportsResponse> {
    return this.qc.approve(user, id);
  }

  @Post('report-issue')
  @HttpCode(200)
  reportIssue(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReportQcIssueDto): Promise<QcReportsResponse> {
    return this.qc.reportIssue(user, id, dto.reason);
  }
}
