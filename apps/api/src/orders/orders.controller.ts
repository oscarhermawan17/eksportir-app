import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { AuthUser, OrderView } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
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

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<OrderView> {
    return this.orders.get(user, id);
  }
}
