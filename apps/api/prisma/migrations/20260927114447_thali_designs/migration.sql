-- CreateEnum
CREATE TYPE "UnlockItemType" AS ENUM ('THALI');

-- AlterEnum
ALTER TYPE "CoinTxnReason" ADD VALUE 'UNLOCK';

-- AlterTable
ALTER TABLE "ritual_logs" ADD COLUMN     "thali_id" UUID;

-- CreateTable
CREATE TABLE "thali_designs" (
    "id" UUID NOT NULL,
    "name_hi" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "image_key" TEXT NOT NULL,
    "flame_style" TEXT NOT NULL,
    "coin_cost" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thali_designs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_unlocks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "item_type" "UnlockItemType" NOT NULL,
    "item_id" UUID NOT NULL,
    "coins_spent" INTEGER NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mandir_settings" (
    "user_id" UUID NOT NULL,
    "selected_thali_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mandir_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "user_unlocks_user_id_item_type_idx" ON "user_unlocks"("user_id", "item_type");

-- CreateIndex
CREATE UNIQUE INDEX "user_unlocks_user_id_item_type_item_id_key" ON "user_unlocks"("user_id", "item_type", "item_id");

-- CreateIndex
CREATE INDEX "user_mandir_settings_selected_thali_id_idx" ON "user_mandir_settings"("selected_thali_id");

-- AddForeignKey
ALTER TABLE "ritual_logs" ADD CONSTRAINT "ritual_logs_thali_id_fkey" FOREIGN KEY ("thali_id") REFERENCES "thali_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_unlocks" ADD CONSTRAINT "user_unlocks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mandir_settings" ADD CONSTRAINT "user_mandir_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mandir_settings" ADD CONSTRAINT "user_mandir_settings_selected_thali_id_fkey" FOREIGN KEY ("selected_thali_id") REFERENCES "thali_designs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
