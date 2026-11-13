import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthUser, OrderView, PageResult } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdminOrderQueryDto } from '../orders/dto/admin-order-query.dto.js';
import { OrdersService } from '../orders/orders.service.js';

/**
 * The admin orders table (T27). Separate from `GET /api/orders`, which stays the small, unpaged list a
 * buyer or seller sees of their own orders: a dense table is right for an admin and wrong for a buyer,
 * and one endpoint wearing both faces is how code becomes hard to change.
 *
 * Every admin role sees every order — finance needs payments, ops needs QC and shipping.
 */
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_OPS', 'ADMIN_FINANCE', 'ADMIN_OWNER')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: AdminOrderQueryDto): Promise<PageResult<OrderView>> {
    return this.orders.listForAdmin(user, query);
  }
}
