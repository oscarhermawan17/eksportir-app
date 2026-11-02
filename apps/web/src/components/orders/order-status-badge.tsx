import type { OrderStatus } from '@balitrade/shared';

const WAITING = 'bg-warning/15 text-[#8a5a00] border-warning/40';
const PROGRESS = 'bg-info/10 text-info border-info/30';
const DONE = 'bg-success/10 text-success border-success/30';
const ENDED = 'bg-muted/10 text-muted border-muted/30';

const TONES: Record<OrderStatus, string> = {
  REQUESTED: WAITING,
  ACCEPTED: PROGRESS,
  CHANGE_PROPOSED: WAITING,
  DECLINED: ENDED,
  AWAITING_PAYMENT: WAITING,
  PAYMENT_SUBMITTED: WAITING,
  PAYMENT_VERIFIED: PROGRESS,
  IN_QC: PROGRESS,
  QC_READY: WAITING,
  QC_APPROVED: PROGRESS,
  ISSUE: WAITING,
  AWAITING_SHIPPING_PAYMENT: WAITING,
  SHIPPING_PAID: PROGRESS,
  SHIPPED: PROGRESS,
  ARRIVED: PROGRESS,
  COMPLETED: DONE,
  CANCELLED: ENDED,
  REFUNDED: ENDED,
};

/** Coloured pill for an order status: amber = waiting for someone, blue = moving, green = done, grey = ended. */
export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[status]}`}>{label}</span>;
}
