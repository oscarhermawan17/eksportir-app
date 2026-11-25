-- Admin-managed payment destinations (2026-11-26): one settings row saved by the OWNER, and a snapshot of where each
-- payment was sent. No data moved: until the OWNER saves, the payment page keeps using the PAY_* env values.
-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "destination" TEXT;

-- CreateTable
CREATE TABLE "payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bank_enabled" BOOLEAN NOT NULL DEFAULT false,
    "bank_name" TEXT NOT NULL DEFAULT '',
    "bank_account_number" TEXT NOT NULL DEFAULT '',
    "bank_account_holder" TEXT NOT NULL DEFAULT '',
    "usdt_enabled" BOOLEAN NOT NULL DEFAULT false,
    "usdt_network" TEXT NOT NULL DEFAULT 'TRC20',
    "usdt_address" TEXT NOT NULL DEFAULT '',
    "show_test_warning" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_settings_pkey" PRIMARY KEY ("id")
);

