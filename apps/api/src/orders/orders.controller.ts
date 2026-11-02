import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, OrderView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { OrderReasonDto, ProposeChangeDto } from './dto/order-actions.dto.js';
import { OrdersService } from './orders.service.js';

/** Any logged-in user; what each person may see or do is decided in OrdersService (buyer, seller of the order, admins). */
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto): Promise<OrderView> {
    return this.orders.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<OrderView[]> {
    return this.orders.list(user);
  }

  // The seller answers a request.
  @Post(':id/accept')
  accept(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.orders.act(user, id, 'ACCEPT');
  }

  @Post(':id/decline')
  decline(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OrderReasonDto): Promise<OrderView> {
    return this.orders.act(user, id, 'DECLINE', dto.reason ? { reason: dto.reason } : {});
  }

  @Post(':id/propose-change')
  proposeChange(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProposeChangeDto): Promise<OrderView> {
    return this.orders.act(user, id, 'PROPOSE_CHANGE', { qty: dto.qty, ...(dto.reason ? { reason: dto.reason } : {}) });
  }

  // The buyer decides about a proposed change, or cancels.
  @Post(':id/accept-change')
  acceptChange(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.orders.act(user, id, 'ACCEPT_CHANGE');
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: OrderReasonDto): Promise<OrderView> {
    return this.orders.act(user, id, 'CANCEL', dto.reason ? { reason: dto.reason } : {});
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.orders.get(user, id);
  }
}
