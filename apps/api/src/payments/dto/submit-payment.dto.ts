import { PAYMENT_LIMITS, PAYMENT_METHODS, PaymentMethod } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * What the buyer says they sent. The reference field that is actually required depends on the method and is
 * checked in the service (PAYMENT_REFERENCE_FIELD), because only there is the method known for certain.
 * The amount is validated against the widest of the two currencies here; the service narrows it.
 */
export class SubmitPaymentDto {
  @IsIn(PAYMENT_METHODS)
  method: PaymentMethod;

  /** Rupiah for BANK_IDR and EXCHANGE, USDT for USDT (see `paymentCurrency`). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(PAYMENT_LIMITS.minUsd)
  @Max(PAYMENT_LIMITS.maxIdr)
  amount: number;

  /** Key from POST /api/media/presign-upload with purpose PRIVATE_FILE; ownership is checked in the service. */
  @IsString()
  @MaxLength(200)
  proofKey: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(PAYMENT_LIMITS.senderNameMin)
  @MaxLength(PAYMENT_LIMITS.senderNameMax)
  senderName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(PAYMENT_LIMITS.txHashMin)
  @MaxLength(PAYMENT_LIMITS.txHashMax)
  txHash?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(PAYMENT_LIMITS.exchangeNameMin)
  @MaxLength(PAYMENT_LIMITS.exchangeNameMax)
  exchangeName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(PAYMENT_LIMITS.referenceMin)
  @MaxLength(PAYMENT_LIMITS.referenceMax)
  reference?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAYMENT_LIMITS.noteMax)
  note?: string;
}

/** Why a payment was not accepted; shown to the buyer in the order chat. */
export class RejectPaymentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PAYMENT_LIMITS.reasonMax)
  reason?: string;
}
