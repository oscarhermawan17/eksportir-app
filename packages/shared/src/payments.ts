/**
 * Manual payments (T17). No payment gateway: the buyer transfers the money themselves, uploads a proof,
 * and a FINANCE admin checks it against the bank or wallet. Decisions behind this design are recorded in
 * docs/BRAINSTORMING.md §11 — the two that shape these types:
 *
 * - **A payment is recorded per attempt and never replaced.** Partial transfers are accepted (the owner
 *   wants to hold as little of the buyer's money as possible), so one order has several payments, and a
 *   new proof is the next row rather than an edit of the previous one.
 * - **`VERIFIED` is the admin's judgement, not a formula.** Because any amount may arrive, no comparison
 *   of sums can decide when an order is paid; the admin says so after looking at the account.
 */

/** Keep in sync with the enums in apps/api/prisma/schema.prisma. */
export const PaymentMethod = {
  /** Rupiah transfer to the BaliTrade bank account; checked in the bank statement. */
  BANK_IDR: 'BANK_IDR',
  /** USDT to the BaliTrade Binance wallet; checked by transaction hash. */
  USDT: 'USDT',
  /** Buyers who only hold rubles pay a partner exchange in Bali, which forwards rupiah to BaliTrade. */
  EXCHANGE: 'EXCHANGE',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PAYMENT_METHODS = [PaymentMethod.BANK_IDR, PaymentMethod.USDT, PaymentMethod.EXCHANGE] as const;

/** What the money is for. Shipping invoices (T19) reuse the same table and the same screens. */
export const PaymentPurpose = {
  GOODS: 'GOODS',
  SHIPPING: 'SHIPPING',
} as const;
export type PaymentPurpose = (typeof PaymentPurpose)[keyof typeof PaymentPurpose];

export const PaymentStatus = {
  /** The buyer says they paid and uploaded a proof; waiting for a FINANCE admin. */
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  /** Not found in the account, or the proof does not match. The buyer can submit another one. */
  REJECTED: 'REJECTED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

/** The currency the buyer types in: the IDR routes are checked in a rupiah account, USDT in the wallet. */
export function paymentCurrency(method: PaymentMethod): 'IDR' | 'USD' {
  return method === PaymentMethod.USDT ? 'USD' : 'IDR';
}

export const PAYMENT_LIMITS = {
  /** Sanity bounds, not business rules: they only catch a missing or extra zero. */
  minIdr: 10_000,
  maxIdr: 10_000_000_000,
  minUsd: 1,
  maxUsd: 1_000_000,
  senderNameMin: 2,
  senderNameMax: 100,
  /** A transaction hash is hex and of a known length on every network we accept. */
  txHashMin: 10,
  txHashMax: 120,
  exchangeNameMin: 2,
  exchangeNameMax: 100,
  referenceMin: 2,
  referenceMax: 100,
  noteMax: 500,
  reasonMax: 500,
  /** Payments one buyer may submit per hour, over all their orders. */
  perHour: 20,
} as const;

/**
 * Which reference field the buyer must fill in for each method, so web and api ask for the same thing.
 * Every method also needs an amount and a proof file.
 */
export const PAYMENT_REFERENCE_FIELD: Record<PaymentMethod, 'senderName' | 'txHash' | 'exchangeName'> = {
  BANK_IDR: 'senderName',
  USDT: 'txHash',
  EXCHANGE: 'exchangeName',
};

/** Body of POST /api/orders/:id/payments. */
export interface SubmitPaymentInput {
  method: PaymentMethod;
  /** What was actually sent, in the currency of the method (see `paymentCurrency`). */
  amount: number;
  /** Private storage key from POST /api/media/presign-upload with purpose PRIVATE_FILE. */
  proofKey: string;
  /** BANK_IDR: whose account the transfer came from (often not the buyer — see §11). */
  senderName?: string;
  /** USDT: the transaction hash. */
  txHash?: string;
  /** EXCHANGE: which exchange the buyer paid. */
  exchangeName?: string;
  /** EXCHANGE: the exchange's transfer reference, so the incoming rupiah can be matched. */
  reference?: string;
  note?: string;
}

/** Body of POST /api/admin/payments/:id/reject. */
export interface RejectPaymentInput {
  reason?: string;
}

export interface PaymentView {
  id: string;
  orderId: string;
  /** The order's human-readable code, for the admin list. */
  orderCode: string;
  purpose: PaymentPurpose;
  method: PaymentMethod;
  status: PaymentStatus;
  /** Exact decimal strings; `amountIdr` is null for USDT, `amountUsd` is always set. */
  amountUsd: string;
  amountIdr: number | null;
  senderName: string | null;
  txHash: string | null;
  exchangeName: string | null;
  reference: string | null;
  note: string | null;
  /** Private key; open it through GET /api/media/download-url (buyer and admins only). */
  proofKey: string;
  submittedBy: { id: string; name: string };
  submittedAt: string;
  /** The admin who verified or rejected it, and why. Null while the payment is waiting. */
  decidedBy: { id: string; name: string } | null;
  decidedAt: string | null;
  rejectionReason: string | null;
}

/** What the buyer sees on the payment page, and what the admin sees above the order's payments. */
export interface PaymentSummary {
  /** The order total for this purpose, as an exact decimal string. */
  dueUsd: string;
  /** Sum of the VERIFIED payments. Submitted ones are deliberately not counted. */
  verifiedUsd: string;
  /** `dueUsd` minus `verifiedUsd`, floored at zero. */
  remainingUsd: string;
  /** Payments still waiting for an admin. */
  submittedCount: number;
  payments: PaymentView[];
}

/** Where to send the money. Read from config, so going live is an `.env` change (dev uses mock values). */
export interface PaymentInstructions {
  bank: { name: string; accountNumber: string; accountHolder: string } | null;
  usdt: { network: string; address: string } | null;
  exchange: { name: string; contact: string; instructions: string } | null;
  /** True while any of the three is still a development placeholder. */
  mock: boolean;
}
