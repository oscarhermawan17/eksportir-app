/** Keep OrderStatus in sync with the enum in apps/api/prisma/schema.prisma (flow: docs/ARCHITECTURE.md §6). */
export const OrderStatus = {
  REQUESTED: 'REQUESTED',
  ACCEPTED: 'ACCEPTED',
  CHANGE_PROPOSED: 'CHANGE_PROPOSED',
  DECLINED: 'DECLINED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',
  IN_QC: 'IN_QC',
  QC_READY: 'QC_READY',
  QC_APPROVED: 'QC_APPROVED',
  ISSUE: 'ISSUE',
  AWAITING_SHIPPING_PAYMENT: 'AWAITING_SHIPPING_PAYMENT',
  SHIPPING_PAID: 'SHIPPING_PAID',
  SHIPPED: 'SHIPPED',
  ARRIVED: 'ARRIVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

/** The seller's answer to an order item (T16). */
export const OrderItemResponse = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CHANGE_PROPOSED: 'CHANGE_PROPOSED',
} as const;
export type OrderItemResponse = (typeof OrderItemResponse)[keyof typeof OrderItemResponse];

/** Countries BaliTrade ships to (labels under `Orders.countries` in apps/web/messages). */
export const DELIVERY_COUNTRIES = ['RU', 'KZ', 'UZ', 'KG', 'AM', 'BY', 'OTHER'] as const;
export type DeliveryCountry = (typeof DELIVERY_COUNTRIES)[number];

export const ORDER_LIMITS = {
  qtyMax: 1_000_000,
  noteMax: 500,
  nameMin: 2,
  nameMax: 100,
  addressMin: 10,
  addressMax: 500,
  /** Order requests one buyer may send per hour (all products together). */
  requestsPerHour: 20,
  /** Optional reason that goes with declining, proposing a change or cancelling. */
  reasonMax: 500,
} as const;

/** Where BaliTrade delivers. Only the buyer and the admins see it; sellers hand their goods to BaliTrade. */
export interface DeliveryAddress {
  /** Name as shown on the buyer's ID. */
  fullName: string;
  phone: string;
  country: DeliveryCountry;
  /** Street, city and postal code. */
  address: string;
}

/** Body of POST /api/orders. */
export interface CreateOrderInput {
  productId: string;
  qty: number;
  /** "Note to seller", e.g. size or colour; details are discussed in the order chat. */
  note?: string;
  delivery: DeliveryAddress;
}

/** "OR-1001": the human-readable number of an order. */
export const orderCode = (number: number): string => `OR-${1000 + number}`;

/** What a person can do to an order. The seller answers a request; the buyer decides about a proposed change or cancels. */
export type OrderAction = 'ACCEPT' | 'DECLINE' | 'PROPOSE_CHANGE' | 'ACCEPT_CHANGE' | 'CANCEL';

/** Who may take each action (admins read orders but do not take these actions). */
const ACTION_ACTOR: Record<OrderAction, 'BUYER' | 'SELLER'> = {
  ACCEPT: 'SELLER',
  DECLINE: 'SELLER',
  PROPOSE_CHANGE: 'SELLER',
  ACCEPT_CHANGE: 'BUYER',
  CANCEL: 'BUYER',
};

/**
 * Allowed transitions (docs/ARCHITECTURE.md §6) for this stage of the project. ACCEPT goes straight to AWAITING_PAYMENT
 * because there is one item per order; ACCEPTED is kept for the multi-seller cart of MVP 1.1. Later tasks add the
 * payment, QC and shipping transitions here.
 */
const TRANSITIONS: Partial<Record<OrderStatus, Partial<Record<OrderAction, OrderStatus>>>> = {
  REQUESTED: { ACCEPT: 'AWAITING_PAYMENT', DECLINE: 'DECLINED', PROPOSE_CHANGE: 'CHANGE_PROPOSED', CANCEL: 'CANCELLED' },
  // The seller may revise the proposal or withdraw it (DECLINE); the buyer accepts it or cancels.
  CHANGE_PROPOSED: { ACCEPT_CHANGE: 'AWAITING_PAYMENT', PROPOSE_CHANGE: 'CHANGE_PROPOSED', DECLINE: 'DECLINED', CANCEL: 'CANCELLED' },
  AWAITING_PAYMENT: { CANCEL: 'CANCELLED' },
};

/** The status an action leads to, or null when the action is not possible in this status. The single source of truth for transitions. */
export function nextOrderStatus(status: OrderStatus, action: OrderAction): OrderStatus | null {
  return TRANSITIONS[status]?.[action] ?? null;
}

export function actionActor(action: OrderAction): 'BUYER' | 'SELLER' {
  return ACTION_ACTOR[action];
}

/** The actions this viewer can take now (none for admins, and none once the order has ended). */
export function orderActionsFor(viewer: OrderViewer, status: OrderStatus): OrderAction[] {
  if (viewer === 'ADMIN') return [];
  return (Object.keys(ACTION_ACTOR) as OrderAction[]).filter((action) => ACTION_ACTOR[action] === viewer && nextOrderStatus(status, action) !== null);
}

/** Body of POST /api/orders/:id/decline and /cancel. */
export interface OrderReasonInput {
  reason?: string;
}

/** Body of POST /api/orders/:id/propose-change: a smaller quantity than requested. */
export interface ProposeChangeInput {
  qty: number;
  reason?: string;
}

/** Which side of the order the viewer is on. */
export type OrderViewer = 'BUYER' | 'SELLER' | 'ADMIN';

export interface OrderView {
  id: string;
  code: string;
  status: OrderStatus;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
  viewer: OrderViewer;
  buyer: { id: string; name: string };
  seller: { id: string; displayName: string };
  /** What this viewer can do now (empty for admins and for ended orders). */
  actions: OrderAction[];
  /** The seller's proposed change with its totals (status CHANGE_PROPOSED), else null. */
  proposal: { qty: number; itemsUsd: string; totalUsd: string } | null;
  /** One item per order in MVP 1.0. Title, unit and prices are snapshots from the moment of the request. */
  item: {
    productId: string | null;
    title: string;
    unit: string;
    qty: number;
    unitPriceIdr: number;
    unitPriceUsd: string;
    note: string | null;
    sellerResponse: OrderItemResponse;
    proposedQty: number | null;
  };
  /** USD amounts as exact decimal strings ("500.00"). Shipping is added later (T19). */
  totals: { itemsUsd: string; qcFeeUsd: string; totalUsd: string };
  /** IDR per USD used for this order. */
  fxRate: string;
  /** Null for the seller. */
  delivery: DeliveryAddress | null;
  /** The chat of this order (buyer, seller and admin). */
  conversationId: string | null;
}
