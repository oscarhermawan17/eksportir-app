-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('READY_STOCK', 'MADE_TO_ORDER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price_idr" INTEGER NOT NULL,
    "moq" INTEGER NOT NULL DEFAULT 1,
    "stock_qty" INTEGER,
    "lead_time_days" INTEGER,
    "source_locale" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translations" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_auto" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "r2_key" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "sort" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_seller_id_status_idx" ON "products"("seller_id", "status");

-- CreateIndex
CREATE INDEX "products_status_created_at_idx" ON "products"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "product_translations_product_id_locale_key" ON "product_translations"("product_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "product_media_r2_key_key" ON "product_media"("r2_key");

-- CreateIndex
CREATE INDEX "product_media_product_id_sort_idx" ON "product_media"("product_id", "sort");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translations" ADD CONSTRAINT "product_translations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
