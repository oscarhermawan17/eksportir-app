-- AlterTable
ALTER TABLE "users" ADD COLUMN     "admin_chat_consent_at" TIMESTAMP(3),
ADD COLUMN     "admin_chat_consent_version" TEXT;
