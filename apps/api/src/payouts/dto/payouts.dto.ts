import { BANK_LIMITS, COMPLETION_LIMITS } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value);
/** Spaces and dashes people type between digit groups are dropped; anything else that is not a digit is refused. */
const digits = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value);

export class SellerBankDto {
  @Transform(trim)
  @IsString()
  @MinLength(BANK_LIMITS.bankNameMin)
  @MaxLength(BANK_LIMITS.bankNameMax)
  bankName: string;

  @Transform(digits)
  @IsString()
  @Matches(BANK_LIMITS.accountNumberPattern, { message: 'accountNumber must be 6 to 20 digits' })
  accountNumber: string;

  @Transform(trim)
  @IsString()
  @MinLength(BANK_LIMITS.holderMin)
  @MaxLength(BANK_LIMITS.holderMax)
  accountHolder: string;
}

/** No amount and no bank details: the API computes the first and snapshots the second. */
export class RecordPayoutDto {
  /** A private image the OWNER uploaded; checked in the service. */
  @IsString()
  @MaxLength(200)
  proofKey: string;

  /** Range checked in the service (not in the future, not more than 60 days back). */
  @IsISO8601({ strict: true })
  paidAt: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(COMPLETION_LIMITS.referenceMax)
  transferReference?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(COMPLETION_LIMITS.noteMax)
  note?: string;
}
