import { BANK_LIMITS, USDT_NETWORKS, isUsdtAddressFor } from '@balitrade/shared';
import type { UsdtNetwork } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** Spaces and dashes people paste from a bank app are dropped, so "1234 5678-90" becomes "1234567890". */
const digits = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value);

/** The value must equal another field of the same body (an account number or address typed twice). */
function SameAs(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'sameAs',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: { message: `${propertyName} must equal ${property}`, ...options },
      validator: {
        validate: (value: unknown, args: ValidationArguments) => value === (args.object as Record<string, unknown>)[property],
      },
    });
}

/** The address must have the shape of the chosen network. */
function UsdtAddressForNetwork(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'usdtAddressForNetwork',
      target: object.constructor,
      propertyName,
      options: { message: 'usdtAddress does not match the chosen network', ...options },
      validator: {
        validate: (value: unknown, args: ValidationArguments) => {
          const network = (args.object as { usdtNetwork?: UsdtNetwork }).usdtNetwork;
          return typeof value === 'string' && !!network && isUsdtAddressFor(network, value);
        },
      },
    });
}

/**
 * PUT /api/admin/payment-settings — the whole settings at once. A switched-off method keeps whatever was typed (so it
 * can be switched back on), but a switched-on one must be complete and well-formed, and its number or address must have
 * been typed twice the same way.
 */
export class PaymentSettingsDto {
  @IsBoolean()
  bankEnabled!: boolean;

  @Transform(trim)
  @IsString()
  @MaxLength(BANK_LIMITS.bankNameMax)
  @ValidateIf((o: PaymentSettingsDto) => o.bankEnabled)
  @Matches(new RegExp(`^.{${BANK_LIMITS.bankNameMin},}$`), { message: 'bankName is too short' })
  bankName!: string;

  @Transform(digits)
  @IsString()
  @MaxLength(20)
  @ValidateIf((o: PaymentSettingsDto) => o.bankEnabled || o.bankAccountNumber !== '')
  @Matches(BANK_LIMITS.accountNumberPattern, { message: 'bankAccountNumber must be 6 to 20 digits' })
  bankAccountNumber!: string;

  @Transform(digits)
  @IsString()
  @SameAs('bankAccountNumber', { message: 'The account number and its confirmation differ' })
  bankAccountNumberConfirm!: string;

  @Transform(trim)
  @IsString()
  @MaxLength(BANK_LIMITS.holderMax)
  @ValidateIf((o: PaymentSettingsDto) => o.bankEnabled)
  @Matches(new RegExp(`^.{${BANK_LIMITS.holderMin},}$`), { message: 'bankAccountHolder is too short' })
  bankAccountHolder!: string;

  @IsBoolean()
  usdtEnabled!: boolean;

  @IsIn(USDT_NETWORKS)
  usdtNetwork!: UsdtNetwork;

  @Transform(trim)
  @IsString()
  @MaxLength(64)
  @ValidateIf((o: PaymentSettingsDto) => o.usdtEnabled || o.usdtAddress !== '')
  @UsdtAddressForNetwork()
  usdtAddress!: string;

  @Transform(trim)
  @IsString()
  @SameAs('usdtAddress', { message: 'The USDT address and its confirmation differ' })
  usdtAddressConfirm!: string;

  @IsBoolean()
  showTestWarning!: boolean;
}
