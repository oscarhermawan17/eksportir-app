import { Controller, Get, UseGuards } from '@nestjs/common';
import { ADMIN_ROLES } from '@balitrade/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

/** Admin-only area. Later admin endpoints (seller approval, payments, QC...) live in this module. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminController {
  @Get('ping')
  ping(): { ok: true } {
    return { ok: true };
  }
}
