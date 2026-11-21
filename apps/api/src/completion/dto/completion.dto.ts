import { COMPLETION_LIMITS } from '@balitrade/shared';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class ReportDeliveryIssueDto {
  @Transform(trim)
  @IsString()
  @MinLength(COMPLETION_LIMITS.issueReasonMin)
  @MaxLength(COMPLETION_LIMITS.issueReasonMax)
  reason: string;
}

/** Completing an order by hand always says why: it goes into the order chat and the audit log. */
export class CompleteOrderDto {
  @Transform(trim)
  @IsString()
  @MinLength(COMPLETION_LIMITS.noteMin)
  @MaxLength(COMPLETION_LIMITS.noteMax)
  note: string;
}
