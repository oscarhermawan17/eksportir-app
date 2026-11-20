-- CreateEnum
CREATE TYPE "QcReportStatus" AS ENUM ('READY', 'APPROVED', 'ISSUE');

-- CreateTable
CREATE TABLE "qc_reports" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "status" "QcReportStatus" NOT NULL DEFAULT 'READY',
    "checklist" JSONB NOT NULL,
    "comment" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "auto_approved" BOOLEAN NOT NULL DEFAULT false,
    "issue_reason" TEXT,

    CONSTRAINT "qc_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_media" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "qc_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_reports_status_created_at_idx" ON "qc_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "qc_reports_order_id_round_key" ON "qc_reports"("order_id", "round");

-- CreateIndex
CREATE UNIQUE INDEX "qc_media_r2_key_key" ON "qc_media"("r2_key");

-- CreateIndex
CREATE INDEX "qc_media_report_id_sort_order_idx" ON "qc_media"("report_id", "sort_order");

-- AddForeignKey
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_media" ADD CONSTRAINT "qc_media_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "qc_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
