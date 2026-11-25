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
  /**
   * Where the buyer was told to send this money when they submitted it ("BCA 1234567890 a.n. …" or "USDT TRC20 T…"),
   * so an old payment is still checked against the right account after the account changes. Null for payments made
   * before 2026-11-26 and for the exchange method.
   */
  destination: string | null;
}

/** What the buyer sees on the payment page, and what the admin sees above the order's payments. */
export interface PaymentSummary {
  /** What these payments are for: the goods (T17) or the shipping bill (T19). */
  purpose: PaymentPurpose;
  /** The total for this purpose, as an exact decimal string (0.00 for shipping before a bill exists). */
  dueUsd: string;
  /** IDR per USD that converts rupiah payments of this purpose: the order's rate for goods, the bill's for shipping. */
  fxRate: string;
  /** Sum of the VERIFIED payments. Submitted ones are deliberately not counted. */
  verifiedUsd: string;
  /** `dueUsd` minus `verifiedUsd`, floored at zero. */
  remainingUsd: string;
  /** Payments still waiting for an admin. */
  submittedCount: number;
  payments: PaymentView[];
}

/**
 * Where to send the money. Bank and USDT come from the OWNER's payment settings (2026-11-26), falling back to the
 * `PAY_*` env values until those are saved once; the exchange still comes from env.
 */
export interface PaymentInstructions {
  bank: { name: string; accountNumber: string; accountHolder: string } | null;
  usdt: { network: string; address: string } | null;
  exchange: { name: string; contact: string; instructions: string } | null;
  /** True while any of the three is still a development placeholder. */
  mock: boolean;
}

/** The USDT networks BaliTrade may receive on. The wrong one loses the buyer's funds, so it is a closed list. */
export const USDT_NETWORKS = ['TRC20', 'ERC20', 'BEP20'] as const;
export type UsdtNetwork = (typeof USDT_NETWORKS)[number];

/**
 * Whether an address has the shape of its network: TRC20 (Tron) = "T" + 33 base58 characters; ERC20 and BEP20 (both
 * EVM) = "0x" + 40 hex. A shape check, not a checksum: it catches a pasted wrong-network address or a cut-off one.
 */
export function isUsdtAddressFor(network: UsdtNetwork, address: string): boolean {
  return network === 'TRC20' ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) : /^0x[0-9a-fA-F]{40}$/.test(address);
}

/** The OWNER's payment settings as admins see them (FINANCE reads, only the OWNER saves). */
export interface AdminPaymentSettingsView {
  /** False until the OWNER saves once; the payment page then still uses the env values. */
  saved: boolean;
  bankEnabled: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  usdtEnabled: boolean;
  usdtNetwork: UsdtNetwork;
  usdtAddress: string;
  showTestWarning: boolean;
  /**
   * The exchange method still comes from env, and env marks it as a placeholder (PAY_MOCK): buyers keep seeing the
   * test warning while it is offered, whatever `showTestWarning` says.
   */
  exchangeIsPlaceholder: boolean;
  updatedBy: { id: string; name: string } | null;
  updatedAt: string | null;
}

/**
 * Body of PUT /api/admin/payment-settings. The account number and the address are typed twice; the API refuses the
 * save when the two differ, because one wrong digit sends a buyer's money elsewhere.
 */
export interface PaymentSettingsInput {
  bankEnabled: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankAccountNumberConfirm: string;
  bankAccountHolder: string;
  usdtEnabled: boolean;
  usdtNetwork: UsdtNetwork;
  usdtAddress: string;
  usdtAddressConfirm: string;
  showTestWarning: boolean;
}
