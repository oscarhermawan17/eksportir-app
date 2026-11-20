import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, QcReportsResponse } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { RedoQcDto, SubmitQcReportDto } from './dto/qc.dto.js';
import { QcService } from './qc.service.js';

/** The OPS side of quality control (T18): writing the report, and checking again after a problem was talked through. */
@Controller('admin/orders/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OPS', 'ADMIN_OWNER')
export class AdminQcController {
  constructor(private readonly qc: QcService) {}

  @Post('qc-report')
  submit(@CurrentUser() admin: AuthUser, @Param('id') id: string, @Body() dto: SubmitQcReportDto): Promise<QcReportsResponse> {
    return this.qc.submit(admin, id, dto);
  }

  @Post('redo-qc')
  @HttpCode(200)
  redo(@Param('id') id: string, @Body() dto: RedoQcDto): Promise<QcReportsResponse> {
    return this.qc.redo(id, dto.note);
  }
}
