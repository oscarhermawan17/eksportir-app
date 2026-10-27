import { FX_LIMITS } from '@balitrade/shared';
import { IsNumber, Max, Min } from 'class-validator';

export class SetExchangeRateDto {
  /** IDR per 1 USD. The bounds only catch typos such as a missing or extra zero. */
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: FX_LIMITS.maxDecimalPlaces })
  @Min(FX_LIMITS.min)
  @Max(FX_LIMITS.max)
  rate: number;
}
