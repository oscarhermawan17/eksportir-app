/** Keep in sync with the `SellerStatus` enum in apps/api/prisma/schema.prisma. */
export const SellerStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type SellerStatus = (typeof SellerStatus)[keyof typeof SellerStatus];

/** A Bali regency/city where sellers are located; also the unit for QC fees. */
export interface QcZoneOption {
  id: string;
  name: string;
}

/** The logged-in seller's own profile (GET /api/sellers/me). */
export interface SellerProfileView {
  id: string;
  displayName: string;
  about: string | null;
  qcZone: QcZoneOption | null;
  status: SellerStatus;
  /** Set by an admin when status is REJECTED. */
  rejectionReason: string | null;
}

/** Seller application as seen by admins (GET /api/admin/sellers). */
export interface AdminSellerView extends SellerProfileView {
  createdAt: string;
  reviewedAt: string | null;
  qcZone: (QcZoneOption & { feeUsd: string }) | null;
  user: { id: string; name: string; email: string; phone: string | null };
}
