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
