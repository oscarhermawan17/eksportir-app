import type { ProductStatus } from '@balitrade/shared';

/**
 * The only place that decides which product status changes are allowed.
 * Seller actions: edit / submit / archive / restore. Admin review actions: approve / reject.
 */
export type ProductAction = 'edit' | 'submit' | 'archive' | 'restore' | 'approve' | 'reject';
/** @deprecated kept for existing imports; use ProductAction */
export type SellerProductAction = ProductAction;

export function nextStatus(current: ProductStatus, action: ProductAction): ProductStatus | null {
  switch (action) {
    case 'approve':
    case 'reject':
      // Only a listing that the seller has submitted can be reviewed.
      return current === 'PENDING_REVIEW' ? (action === 'approve' ? 'APPROVED' : 'REJECTED') : null;
    case 'edit':
      if (current === 'ARCHIVED') return null;
      // Changing a live listing sends it back to review; every other status keeps its state until submitted.
      return current === 'APPROVED' ? 'PENDING_REVIEW' : current;
    case 'submit':
      return current === 'DRAFT' || current === 'REJECTED' ? 'PENDING_REVIEW' : null;
    case 'archive':
      return current === 'ARCHIVED' ? null : 'ARCHIVED';
    case 'restore':
      return current === 'ARCHIVED' ? 'DRAFT' : null;
  }
}
