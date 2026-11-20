import type { MediaKind } from './media.js';

/**
 * The fixed quality-control checklist (T18), the same for every order so reports can be compared. Labels live under
 * `Qc.checklist` in apps/web/messages. Chosen for what Bali sellers ship by air: handicrafts, garments, leather and
 * wood, where humidity damage (mould, insects) is as common a failure as breakage.
 */
export const QC_CHECKLIST = ['QUANTITY', 'MATCHES_LISTING', 'NO_DAMAGE', 'WORKMANSHIP', 'NO_MOLD_PESTS'] as const;
export type QcChecklistKey = (typeof QC_CHECKLIST)[number];

export const QC_RESULTS = ['PASS', 'FAIL'] as const;
export type QcResult = (typeof QC_RESULTS)[number];

/** Keep in sync with the enum in apps/api/prisma/schema.prisma. */
export const QcReportStatus = {
  /** Waiting for the buyer. */
  READY: 'READY',
  APPROVED: 'APPROVED',
  /** The buyer reported a problem; a later round replaces this report, which stays as history. */
  ISSUE: 'ISSUE',
} as const;
export type QcReportStatus = (typeof QcReportStatus)[keyof typeof QcReportStatus];

export const QC_LIMITS = {
  /** A report the buyer has not answered is approved automatically after this long. */
  autoApproveHours: 48,
  commentMin: 1,
  commentMax: 2000,
  /** Note on one checklist line; required when the line failed. */
  noteMax: 300,
  issueReasonMin: 10,
  issueReasonMax: 1000,
  redoNoteMax: 500,
  /** Photos and videos per report; at least one of them must be a photo. */
  mediaMin: 1,
  mediaMax: 20,
} as const;

export interface QcChecklistEntry {
  key: QcChecklistKey;
  result: QcResult;
  /** Required when `result` is FAIL. */
  note?: string;
}

/** Body of POST /api/admin/orders/:id/qc-report. Media are private files the admin uploaded (PRIVATE_FILE). */
export interface SubmitQcReportInput {
  checklist: QcChecklistEntry[];
  comment: string;
  media: { key: string }[];
}

/** Body of POST /api/orders/:id/qc/report-issue. */
export interface ReportQcIssueInput {
  reason: string;
}

/** Body of POST /api/admin/orders/:id/redo-qc. */
export interface RedoQcInput {
  note?: string;
}

export interface QcReportView {
  id: string;
  /** 1 for the first check, 2 after the first "check again", … */
  round: number;
  status: QcReportStatus;
  checklist: QcChecklistEntry[];
  comment: string;
  /** Short-lived signed links (private bucket); load the report again to refresh them. */
  media: { kind: MediaKind; url: string }[];
  /** ISO timestamps. */
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  /** When an unanswered report is approved automatically; null once it has been decided. */
  autoApproveAt: string | null;
  decidedAt: string | null;
  autoApproved: boolean;
  /** What the buyer wrote when reporting a problem. */
  issueReason: string | null;
}

/** Response of GET /api/orders/:id/qc: every round, newest first. */
export interface QcReportsResponse {
  reports: QcReportView[];
}

/**
 * Why a checklist is not acceptable, or null when it is: every key exactly once, a known result, and a note whenever
 * a line failed (a "fail" the buyer cannot understand is not a report). Shared by the API and the admin form.
 */
export function qcChecklistProblem(checklist: readonly QcChecklistEntry[]): 'MISSING_OR_DUPLICATE' | 'FAIL_NEEDS_NOTE' | null {
  const keys = checklist.map((entry) => entry.key);
  if (keys.length !== QC_CHECKLIST.length || QC_CHECKLIST.some((key) => !keys.includes(key))) return 'MISSING_OR_DUPLICATE';
  if (checklist.some((entry) => entry.result === 'FAIL' && !entry.note?.trim())) return 'FAIL_NEEDS_NOTE';
  return null;
}

/** When a report created at `createdAt` is approved automatically. */
export function qcAutoApproveAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + QC_LIMITS.autoApproveHours * 60 * 60 * 1000);
}
