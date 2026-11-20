import { Body, Controller, Get, Param, ParseEnumPipe, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentPurpose } from '@balitrade/shared';
import type { AuthUser, PaymentInstructions, PaymentSummary } from '@balitrade/shared';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SubmitPaymentDto } from './dto/submit-payment.dto.js';
import { PaymentsService } from './payments.service.js';

/** The buyer's side of a payment. Who may read or pay an order is decided in PaymentsService. */
@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Where to send the money. Behind a login because these are our account details, and only methods that are fully
   * configured are returned, so the page cannot show half an instruction.
   */
  @Get('payments/instructions')
  instructions(): PaymentInstructions {
    return this.payments.instructions();
  }

  /** `?purpose=GOODS|SHIPPING` picks which money to show; without it, what the order is waiting for now (T19). */
  @Get('orders/:id/payments')
  summary(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Query('purpose', new ParseEnumPipe(PaymentPurpose, { optional: true })) purpose?: PaymentPurpose,
  ): Promise<PaymentSummary> {
    return this.payments.summary(user, id, purpose);
  }

  @Post('orders/:id/payments')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SubmitPaymentDto): Promise<PaymentSummary> {
    return this.payments.submit(user, id, dto);
  }
}
