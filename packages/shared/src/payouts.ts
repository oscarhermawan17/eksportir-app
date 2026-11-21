/**
 * Completion and payouts (T20). Once the buyer confirms receipt (or the OWNER completes the order by hand), BaliTrade
 * transfers the goods money to the seller's bank account by hand and records it here. Owner's decisions of 2026-11-21:
 * nothing completes automatically, a problem after arrival is a discussion, BaliTrade keeps a 1% commission on the
 * goods (frozen on each order when it is requested), and the seller's bank details are stored in the app.
 */

/** The commission new orders are requested with, as an exact decimal string (0.0100 = 1%). Existing orders keep theirs. */
export const SELLER_COMMISSION_RATE = '0.0100';

export interface PayoutBreakdown {
  /** The goods at the seller's own rupiah prices: quantity × unit price, both frozen on the order. */
  grossIdr: number;
  commissionIdr: number;
  /** What the seller receives. */
  netIdr: number;
}

/**
 * Splits the goods money between BaliTrade and the seller. Integer arithmetic only: the rate is turned into basis points
 * (0.0100 → 100) and the commission is rounded half-up to a whole rupiah, so the same inputs always give the same
 * rupiah on every machine. `net = gross − commission`, so the two always add up exactly.
 */
export function payoutBreakdown(grossIdr: number, rate: string): PayoutBreakdown {
  if (!Number.isSafeInteger(grossIdr) || grossIdr < 0) throw new RangeError('grossIdr must be a whole, non-negative number');
  const match = /^0\.(\d{1,4})$|^0$/.exec(rate);
  if (!match) throw new RangeError('rate must be a decimal between 0 and 1 with at most 4 places');
  const basisPoints = Number((match[1] ?? '0').padEnd(4, '0'));
  // gross × bp / 10 000, rounded half-up, without leaving integers (safe below 9e15 / 10 000 ≈ 900 billion rupiah).
  const commissionIdr = Math.floor((grossIdr * basisPoints + 5_000) / 10_000);
  return { grossIdr, commissionIdr, netIdr: grossIdr - commissionIdr };
}

export const BANK_LIMITS = {
  bankNameMin: 2,
  bankNameMax: 60,
  /** Indonesian account numbers are digits only, typically 10–16 long. */
  accountNumberPattern: /^\d{6,20}$/,
  holderMin: 2,
  holderMax: 100,
  /** A payout form warns when the account changed this recently (a hijacked seller account would change it first). */
  recentChangeDays: 7,
} as const;

/** "1234567890" → "••••7890": enough to recognise an account, not enough to use it. */
export function maskAccount(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}

export const COMPLETION_LIMITS = {
  issueReasonMin: 10,
  issueReasonMax: 1000,
  noteMin: 5,
  noteMax: 500,
  /** How far back a transfer may be dated, so a typo in the year is caught. */
  paidAtMaxDaysBack: 60,
  referenceMax: 100,
} as const;

/** Body of PUT /api/sellers/me/bank. */
export interface SellerBankInput {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

/** The seller's own bank details (GET /api/sellers/me/bank); `null` until filled in. */
export interface SellerBankView extends SellerBankInput {
  updatedAt: string;
}

/** Body of POST /api/orders/:id/report-delivery-issue. */
export interface ReportDeliveryIssueInput {
  reason: string;
}

/** Body of POST /api/admin/orders/:id/complete. */
export interface CompleteOrderInput {
  note: string;
}

/** Body of POST /api/admin/orders/:id/payout. Amounts are never sent: the API computes them from the order. */
export interface RecordPayoutInput {
  /** A private image the OWNER uploaded (PRIVATE_FILE): the transfer receipt. */
  proofKey: string;
  /** ISO date-time of the transfer. */
  paidAt: string;
  transferReference?: string;
  note?: string;
}

/** A recorded payout, as the seller and admins see it. The account number is masked. */
export interface PayoutRecordView extends PayoutBreakdown {
  commissionRate: string;
  bankName: string;
  accountMasked: string;
  accountHolder: string;
  transferReference: string | null;
  note: string | null;
  paidAt: string;
  /** Short-lived signed link to the transfer receipt. */
  proofUrl: string;
  recordedBy: { id: string; name: string } | null;
}

/** Response of GET /api/orders/:id/payout (the order's seller, FINANCE and OWNER; the buyer gets 404). */
export interface OrderPayoutView {
  /** What the seller will receive for this order (or received), from the order's own snapshot. */
  breakdown: PayoutBreakdown & { commissionRate: string };
  payout: PayoutRecordView | null;
}

/** Response of GET /api/admin/orders/:id/payout-preview (FINANCE, OWNER): what the OWNER needs to make the transfer. */
export interface PayoutPreview extends OrderPayoutView {
  /** The seller's current bank details in full, or null when they have not filled them in (a payout is then refused). */
  bank: (SellerBankInput & { updatedAt: string; changedRecently: boolean }) | null;
  shop: { id: string; displayName: string; ownerName: string };
}

/** Query value of GET /api/admin/orders?payout=… (T20): completed orders still to pay out, or already paid out. */
export const PAYOUT_FILTERS = ['unpaid', 'paid'] as const;
export type PayoutFilter = (typeof PAYOUT_FILTERS)[number];
