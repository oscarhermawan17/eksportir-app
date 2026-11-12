-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_id" TEXT NOT NULL,
    "name_ru" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_active_archived_at_sort_order_idx" ON "product_categories"("active", "archived_at", "sort_order");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- Backfill: the nine categories that were the PRODUCT_CATEGORIES constant, with the labels that were in
-- apps/web/messages/*.json under Products.categories. This has to run BEFORE the foreign key below, or
-- every existing product would violate it.
INSERT INTO "product_categories" ("id", "slug", "name_en", "name_id", "name_ru", "sort_order", "updated_at")
SELECT gen_random_uuid()::text, v.slug, v.name_en, v.name_id, v.name_ru, v.sort_order, CURRENT_TIMESTAMP
FROM (VALUES
  ('COFFEE_TEA', 'Coffee & tea', 'Kopi & teh', 'Кофе и чай', 0),
  ('FOOD_SPICES', 'Food & spices', 'Makanan & rempah', 'Еда и специи', 10),
  ('HANDICRAFTS', 'Handicrafts', 'Kerajinan tangan', 'Ремесленные изделия', 20),
  ('HOME_DECOR', 'Home decor', 'Dekorasi rumah', 'Декор для дома', 30),
  ('FASHION_APPAREL', 'Fashion & apparel', 'Fashion & pakaian', 'Одежда и мода', 40),
  ('BAGS_ACCESSORIES', 'Bags & accessories', 'Tas & aksesori', 'Сумки и аксессуары', 50),
  ('BEAUTY_WELLNESS', 'Beauty & wellness', 'Kecantikan & kesehatan', 'Красота и здоровье', 60),
  ('FURNITURE', 'Furniture', 'Furnitur', 'Мебель', 70),
  ('OTHER', 'Other', 'Lainnya', 'Другое', 80)
) AS v(slug, name_en, name_id, name_ru, sort_order)
ON CONFLICT ("slug") DO NOTHING;

-- Defensive: a product carrying any other key (hand-edited data, a key removed from the constant in the
-- past) gets a row too, so adding the foreign key cannot fail. The OWNER renames or archives it afterwards.
INSERT INTO "product_categories" ("id", "slug", "name_en", "name_id", "name_ru", "sort_order", "updated_at")
SELECT gen_random_uuid()::text, p."category", p."category", p."category", p."category", 999, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "category" FROM "products") AS p
ON CONFLICT ("slug") DO NOTHING;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_fkey" FOREIGN KEY ("category") REFERENCES "product_categories"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
