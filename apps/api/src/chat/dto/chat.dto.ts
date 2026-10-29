import { CHAT_LIMITS } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class StartInquiryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  productId: string;
}

export class SendMessageDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(CHAT_LIMITS.bodyMax)
  body: string;
}

export class MessagesQueryDto {
  /** ISO timestamp: return the messages written before it (the page before the oldest one already loaded). */
  @IsOptional()
  @IsISO8601()
  before?: string;
}
