import { SellerStatus } from '@balitrade/shared';
import { IsIn, IsOptional } from 'class-validator';
import { AdminListQueryDto } from '../../common/admin-list-query.dto.js';

/** Query of the seller applications table (T27): one status (a tab) plus the shared search, day range and page. */
export class AdminSellerQueryDto extends AdminListQueryDto {
  @IsOptional()
  @IsIn(Object.values(SellerStatus))
  status?: SellerStatus;
}
