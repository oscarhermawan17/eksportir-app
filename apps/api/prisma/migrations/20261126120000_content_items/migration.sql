-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('HOW_IT_WORKS_STEP', 'FAQ');

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "title_en" TEXT NOT NULL,
    "title_id" TEXT NOT NULL,
    "title_ru" TEXT NOT NULL,
    "body_en" TEXT NOT NULL,
    "body_id" TEXT NOT NULL,
    "body_ru" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_items_kind_active_sort_order_idx" ON "content_items"("kind", "active", "sort_order");


-- Seed: the steps and questions that /how-it-works showed from the message files until now, word for word, in all three
-- languages, so the page reads the same the moment this migration runs. From here on the OWNER edits them on /admin/content.
INSERT INTO "content_items" ("id", "kind", "title_en", "title_id", "title_ru", "body_en", "body_id", "body_ru", "sort_order", "updated_at") VALUES
  ('seed-step-1', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Find a product', 'Temukan produk', 'Найдите товар', 'Browse products from Bali sellers and pick what you need.', 'Telusuri produk penjual Bali dan pilih yang Anda butuhkan.', 'Выберите нужное среди товаров продавцов с Бали.', 10, CURRENT_TIMESTAMP),
  ('seed-step-2', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Discuss', 'Diskusi', 'Обсудите', 'Chat with the seller and our team, and agree on the details.', 'Chat dengan penjual dan tim kami, lalu sepakati detailnya.', 'Пообщайтесь с продавцом и нашей командой и договоритесь о деталях.', 20, CURRENT_TIMESTAMP),
  ('seed-step-3', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Pay securely', 'Bayar dengan aman', 'Оплатите безопасно', 'Your payment is held by BaliTrade until your goods arrive.', 'Pembayaran Anda ditahan BaliTrade sampai barang tiba.', 'Ваш платёж удерживает BaliTrade до получения товара.', 30, CURRENT_TIMESTAMP),
  ('seed-step-4', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Quality check', 'Pemeriksaan kualitas', 'Проверка качества', 'We inspect and send you a photo and video report to approve.', 'Kami memeriksa dan mengirim laporan foto dan video untuk Anda setujui.', 'Мы проверяем товар и присылаем фото- и видеоотчёт для вашего подтверждения.', 40, CURRENT_TIMESTAMP),
  ('seed-step-5', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Ship', 'Kirim', 'Отправка', 'We pack and send by air cargo, and you can follow the tracking.', 'Kami mengemas dan mengirim lewat kargo udara, dan Anda bisa memantau pelacakannya.', 'Мы упаковываем и отправляем авиагрузом, а вы следите за отслеживанием.', 50, CURRENT_TIMESTAMP),
  ('seed-step-6', 'HOW_IT_WORKS_STEP'::"ContentKind", 'Receive', 'Terima', 'Получение', 'Confirm arrival, then the seller gets paid.', 'Konfirmasi barang tiba, lalu penjual dibayar.', 'Подтвердите получение — после этого продавец получает оплату.', 60, CURRENT_TIMESTAMP),
  ('seed-faq-1', 'FAQ'::"ContentKind", 'How does BaliTrade protect my payment?', 'Bagaimana BaliTrade melindungi pembayaran saya?', 'Как BaliTrade защищает мой платёж?', 'Your payment is held by BaliTrade until your goods arrive. The seller is paid only after you confirm delivery.', 'Pembayaran Anda ditahan BaliTrade sampai barang tiba. Penjual baru dibayar setelah Anda mengonfirmasi penerimaan.', 'Ваш платёж удерживается BaliTrade до получения товара. Продавец получает оплату только после того, как вы подтвердите доставку.', 10, CURRENT_TIMESTAMP),
  ('seed-faq-2', 'FAQ'::"ContentKind", 'What if the goods don’t pass quality control?', 'Bagaimana jika barang tidak lolos kontrol kualitas?', 'Что, если товар не пройдёт контроль качества?', 'We will first help you find a replacement. If you prefer, you can get a full refund.', 'Kami akan lebih dulu membantu mencarikan barang pengganti. Jika Anda lebih suka, Anda bisa mendapat pengembalian dana penuh.', 'Сначала мы поможем найти замену. Если вы предпочитаете, можно получить полный возврат средств.', 20, CURRENT_TIMESTAMP),
  ('seed-faq-3', 'FAQ'::"ContentKind", 'Can I order more than the stock shown?', 'Bisakah saya memesan lebih dari stok yang tampil?', 'Можно ли заказать больше, чем есть в наличии?', 'Yes. Ask the seller and BaliTrade in the product chat about a larger quantity. Made-to-order products have a lead time set by the seller.', 'Bisa. Tanyakan jumlah yang lebih besar kepada penjual dan BaliTrade di chat produk. Produk made to order memiliki waktu produksi yang ditentukan penjual.', 'Да. Спросите продавца и BaliTrade в чате товара о большем количестве. У товаров под заказ срок изготовления задаёт продавец.', 30, CURRENT_TIMESTAMP),
  ('seed-faq-4', 'FAQ'::"ContentKind", 'Which countries do you ship to?', 'Ke negara mana saja Anda mengirim?', 'В какие страны вы отправляете?', 'Russia and CIS countries, for example Kazakhstan, Uzbekistan, Kyrgyzstan, Armenia and Belarus. You only enter a delivery address; our team arranges the air cargo.', 'Rusia dan negara CIS, misalnya Kazakhstan, Uzbekistan, Kirgizstan, Armenia, dan Belarus. Anda cukup mengisi alamat pengiriman; tim kami yang mengatur kargo udaranya.', 'В Россию и страны СНГ, например Казахстан, Узбекистан, Кыргызстан, Армению и Беларусь. Вам нужно указать только адрес доставки; авиаперевозку организует наша команда.', 40, CURRENT_TIMESTAMP),
  ('seed-faq-5', 'FAQ'::"ContentKind", 'How long does shipping take?', 'Berapa lama pengirimannya?', 'Сколько занимает доставка?', 'Shipping time depends on the destination. Our team confirms it before you pay.', 'Lama pengiriman bergantung pada tujuan. Tim kami mengonfirmasinya sebelum Anda membayar.', 'Срок доставки зависит от направления. Наша команда подтверждает его до оплаты.', 50, CURRENT_TIMESTAMP);
