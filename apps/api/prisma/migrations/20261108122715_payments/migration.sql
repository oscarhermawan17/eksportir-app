-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_IDR', 'USDT', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('GOODS', 'SHIPPING');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL DEFAULT 'GOODS',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUBMITTED',
    "amount_usd" DECIMAL(12,2) NOT NULL,
    "amount_idr" INTEGER,
    "sender_name" TEXT,
    "tx_hash" TEXT,
    "exchange_name" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "proof_key" TEXT NOT NULL,
    "submitted_by_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "rejection_reason" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_order_id_submitted_at_idx" ON "payments"("order_id", "submitted_at");

-- CreateIndex
CREATE INDEX "payments_status_submitted_at_idx" ON "payments"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
