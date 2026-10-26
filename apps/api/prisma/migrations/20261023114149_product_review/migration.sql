-- AlterTable
ALTER TABLE "products" ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
