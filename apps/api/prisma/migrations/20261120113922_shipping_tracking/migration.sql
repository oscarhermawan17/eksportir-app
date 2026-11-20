-- CreateEnum
CREATE TYPE "TrackingMilestone" AS ENUM ('PACKED', 'HANDED_TO_CARGO', 'DEPARTED_BALI', 'ARRIVED_DESTINATION_AIRPORT', 'CUSTOMS', 'WITH_LOCAL_PARTNER', 'DELIVERED');

-- CreateTable
CREATE TABLE "shipping_bills" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "total_usd" DECIMAL(12,2) NOT NULL,
    "fx_rate" DECIMAL(12,4) NOT NULL,
    "weight_kg" DECIMAL(10,2) NOT NULL,
    "cartons" INTEGER NOT NULL,
    "photo_key" TEXT,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "shipping_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "milestone" "TrackingMilestone" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "awb" TEXT,
    "photo_key" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shipping_bills_order_id_created_at_idx" ON "shipping_bills"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_events_order_id_milestone_key" ON "tracking_events"("order_id", "milestone");

-- AddForeignKey
ALTER TABLE "shipping_bills" ADD CONSTRAINT "shipping_bills_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_bills" ADD CONSTRAINT "shipping_bills_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
