import { QC_CHECKLIST, QC_LIMITS, QC_RESULTS } from '@balitrade/shared';
import type { QcChecklistKey, QcResult } from '@balitrade/shared';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class QcChecklistEntryDto {
  @IsIn(QC_CHECKLIST)
  key: QcChecklistKey;

  @IsIn(QC_RESULTS)
  result: QcResult;

  /** Required when the line failed; that rule, and "every key exactly once", are checked by qcChecklistProblem. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(QC_LIMITS.noteMax)
  note?: string;
}

export class QcMediaRefDto {
  /** Key from POST /api/media/presign-upload (PRIVATE_FILE); that it is this admin's own file is checked in the service. */
  @IsString()
  @MaxLength(200)
  key: string;
}

export class SubmitQcReportDto {
  @IsArray()
  @ArrayMinSize(QC_CHECKLIST.length)
  @ArrayMaxSize(QC_CHECKLIST.length)
  @ValidateNested({ each: true })
  @Type(() => QcChecklistEntryDto)
  checklist: QcChecklistEntryDto[];

  @Transform(trim)
  @IsString()
  @MinLength(QC_LIMITS.commentMin)
  @MaxLength(QC_LIMITS.commentMax)
  comment: string;

  @IsArray()
  @ArrayMinSize(QC_LIMITS.mediaMin)
  @ArrayMaxSize(QC_LIMITS.mediaMax)
  @ValidateNested({ each: true })
  @Type(() => QcMediaRefDto)
  media: QcMediaRefDto[];
}

export class ReportQcIssueDto {
  @Transform(trim)
  @IsString()
  @MinLength(QC_LIMITS.issueReasonMin)
  @MaxLength(QC_LIMITS.issueReasonMax)
  reason: string;
}

export class RedoQcDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(QC_LIMITS.redoNoteMax)
  note?: string;
}
