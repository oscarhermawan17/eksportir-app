import { PaymentStatus } from '@balitrade/shared';
import { IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../common/admin-list-query.dto.js';

/** Query of the FINANCE payments table (T27): one status (a tab) plus the shared search, day range and page. */
export class AdminPaymentQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus;
}
