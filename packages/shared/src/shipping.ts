import type { OrderStatus } from './orders.js';

/**
 * Shipping (T19). After quality control BaliTrade packs and weighs the goods, bills the air-cargo cost, and once that
 * is paid hands the cartons to the cargo company and updates the tracking by hand. Owner's decisions of 2026-11-20:
 * the bill has several lines (freight, export documents, …), its rupiah rate is the one in force when it is issued,
 * and the seller sees the tracking but not the bill.
 */

export const SHIPPING_LIMITS = {
  linesMax: 10,
  labelMin: 2,
  labelMax: 80,
  /** USD per line; sanity bounds that catch a missing or extra zero. */
  lineMinUsd: 0.01,
  lineMaxUsd: 100_000,
  weightMinKg: 0.1,
  weightMaxKg: 10_000,
  cartonsMin: 1,
  cartonsMax: 1_000,
  noteMax: 500,
} as const;

export interface ShippingBillLine {
  /** What the amount is for, e.g. "Air cargo to Moscow" or "Export documents". */
  label: string;
  /** Exact decimal string, two places ("244.00"). */
  amountUsd: string;
}

/** Body of POST /api/admin/orders/:id/shipping-bill. The total is computed by the API, never sent. */
export interface IssueShippingBillInput {
  lines: { label: string; amountUsd: number }[];
  weightKg: number;
  cartons: number;
  /** Optional photo of the packed cartons: a private key the admin uploaded (PRIVATE_FILE). */
  photoKey?: string;
  note?: string;
}

export interface ShippingBillView {
  id: string;
  lines: ShippingBillLine[];
  totalUsd: string;
  /** IDR per USD frozen when the bill was issued; rupiah payments of the bill are converted with it. */
  fxRate: string;
  weightKg: string;
  cartons: number;
  /** Short-lived signed link to the carton photo, or null. */
  photoUrl: string | null;
  note: string | null;
  /** ISO timestamp. */
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  /** True once a revision exists: older bills are kept, the newest one is what is due. */
  revised: boolean;
}

/** Response of GET /api/orders/:id/shipping-bill (buyer and admins; the seller gets 404). */
export interface ShippingBillResponse {
  bill: ShippingBillView | null;
}

/** Keep in sync with the enum in apps/api/prisma/schema.prisma. Labels: `Tracking.milestones` in apps/web/messages. */
export const TRACKING_MILESTONES = [
  'PACKED',
  'HANDED_TO_CARGO',
  'DEPARTED_BALI',
  'ARRIVED_DESTINATION_AIRPORT',
  'CUSTOMS',
  'WITH_LOCAL_PARTNER',
  'DELIVERED',
] as const;
export type TrackingMilestone = (typeof TRACKING_MILESTONES)[number];

/**
 * The order statuses in which each milestone may be added. Packing happens before the bill (the bill needs the
 * weight); the goods leave only after the shipping money is confirmed; everything after that happens in transit.
 */
const MILESTONE_STATUSES: Record<TrackingMilestone, readonly OrderStatus[]> = {
  PACKED: ['QC_APPROVED', 'AWAITING_SHIPPING_PAYMENT', 'SHIPPING_PAID'],
  HANDED_TO_CARGO: ['SHIPPING_PAID'],
  DEPARTED_BALI: ['SHIPPED'],
  ARRIVED_DESTINATION_AIRPORT: ['SHIPPED'],
  CUSTOMS: ['SHIPPED'],
  WITH_LOCAL_PARTNER: ['SHIPPED'],
  DELIVERED: ['SHIPPED'],
};

/** The milestones that move the order itself; the others only add to the timeline. */
export const MILESTONE_ACTION: Partial<Record<TrackingMilestone, 'SHIP' | 'DELIVER'>> = {
  HANDED_TO_CARGO: 'SHIP',
  DELIVERED: 'DELIVER',
};

export const TRACKING_LIMITS = {
  noteMax: 500,
  /** Air waybill number: 3-digit airline prefix and 8-digit serial (IATA), with or without the dash. */
  awbPattern: /^\d{3}-?\d{8}$/,
  /** How far back a milestone may be dated, so a typo in the year is caught. */
  maxDaysBack: 60,
} as const;

/** Why this milestone cannot be added now, or null when it can. Shared by the API and the admin form. */
export function trackingMilestoneProblem(
  status: OrderStatus,
  existing: readonly TrackingMilestone[],
  milestone: TrackingMilestone,
): 'ALREADY_ADDED' | 'NOT_NOW' | null {
  if (existing.includes(milestone)) return 'ALREADY_ADDED';
  return MILESTONE_STATUSES[milestone].includes(status) ? null : 'NOT_NOW';
}

/** The milestones an admin may add now, in timeline order (for the form's select). */
export function availableMilestones(status: OrderStatus, existing: readonly TrackingMilestone[]): TrackingMilestone[] {
  return TRACKING_MILESTONES.filter((milestone) => trackingMilestoneProblem(status, existing, milestone) === null);
}

/** Body of POST /api/admin/orders/:id/tracking. */
export interface AddTrackingEventInput {
  milestone: TrackingMilestone;
  /** ISO date-time; defaults to now. Not in the future and not more than TRACKING_LIMITS.maxDaysBack ago. */
  occurredAt?: string;
  note?: string;
  /** Required for HANDED_TO_CARGO, refused for the others. */
  awb?: string;
  photoKey?: string;
}

export interface TrackingEventView {
  id: string;
  milestone: TrackingMilestone;
  occurredAt: string;
  note: string | null;
  awb: string | null;
  photoUrl: string | null;
  createdBy: { id: string; name: string } | null;
}

/** Response of GET /api/orders/:id/tracking (buyer, seller and admins), oldest first. */
export interface TrackingResponse {
  events: TrackingEventView[];
}
