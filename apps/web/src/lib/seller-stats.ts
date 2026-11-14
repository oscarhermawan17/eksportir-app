import type { OrderStatus, OrderView, ProductView, SellerProfileView } from '@balitrade/shared';

/**
 * What the seller dashboard counts, in one place and as plain functions, so that every number on the
 * screen has a definition that can be read and checked. Two of them are easy to get subtly wrong:
 *
 * - "Live in the catalog" is not simply APPROVED. When an admin switches a category off (T26) its
 *   listings leave the shop while keeping their status, so counting APPROVED alone tells a seller
 *   their products are on sale when buyers cannot see them.
 * - "Out of stock" only means something for a listing that is otherwise live; a draft with no stock
 *   is not losing anyone a sale.
 */

/** Visible to buyers right now: the same rule the catalog applies (`visibleToBuyers` in the API). */
export const isLive = (product: ProductView): boolean => product.status === 'APPROVED' && product.categoryActive;

/** Approved, but out of the shop because its category was switched off — not the seller's doing. */
export const isHiddenByCategory = (product: ProductView): boolean =>
  product.status === 'APPROVED' && !product.categoryActive;

/** Live and unbuyable: made-to-order listings have no stock to run out of. */
export const isOutOfStock = (product: ProductView): boolean =>
  isLive(product) && product.type === 'READY_STOCK' && product.stockQty === 0;

/** An admin sent it back; the seller has to change something. */
export const needsFix = (product: ProductView): boolean => product.status === 'REJECTED';

/** Waiting on BaliTrade, not on the seller. */
export const isInReview = (product: ProductView): boolean => product.status === 'PENDING_REVIEW';

/** The order is waiting for this person to do something (the API decides what they may do). */
export const needsAnswer = (order: OrderView): boolean => order.actions.length > 0;

/**
 * Agreed and under way: money, quality control or shipping is moving. Listed one by one rather than as
 * a range, so a status added later has to be placed here on purpose instead of drifting in.
 */
const IN_PROGRESS: readonly OrderStatus[] = [
  'ACCEPTED',
  'AWAITING_PAYMENT',
  'PAYMENT_SUBMITTED',
  'PAYMENT_VERIFIED',
  'IN_QC',
  'QC_READY',
  'QC_APPROVED',
  'ISSUE',
  'AWAITING_SHIPPING_PAYMENT',
  'SHIPPING_PAID',
  'SHIPPED',
  'ARRIVED',
];

export const isInProgress = (order: OrderView): boolean => IN_PROGRESS.includes(order.status);

export interface SellerStats {
  /** Needs the seller to act. */
  toAnswer: number;
  needsFix: number;
  outOfStock: number;
  hiddenByCategory: number;
  /** Informational. */
  live: number;
  inReview: number;
  inProgress: number;
  unreadMessages: number;
}

export function sellerStats(products: ProductView[], orders: OrderView[], unreadMessages: number): SellerStats {
  const count = <T,>(items: T[], matches: (item: T) => boolean): number => items.filter(matches).length;
  return {
    toAnswer: count(orders, needsAnswer),
    needsFix: count(products, needsFix),
    outOfStock: count(products, isOutOfStock),
    hiddenByCategory: count(products, isHiddenByCategory),
    live: count(products, isLive),
    inReview: count(products, isInReview),
    inProgress: count(orders, isInProgress),
    unreadMessages,
  };
}

/** Parts of the shop profile that are still empty. Keys are message keys under `Seller.gaps`. */
export type ProfileGap = 'about' | 'location' | 'phone';

/**
 * A shop with no description, no location or no phone number looks unfinished to a buyer and is harder
 * for BaliTrade to work with — and an application cannot be approved at all without a location.
 */
export function profileGaps(profile: SellerProfileView | null, phone: string | null): ProfileGap[] {
  if (profile === null) {
    return [];
  }
  const gaps: ProfileGap[] = [];
  if (!profile.about?.trim()) gaps.push('about');
  if (profile.qcZone === null) gaps.push('location');
  if (!phone?.trim()) gaps.push('phone');
  return gaps;
}
