-- CreateEnum
CREATE TYPE "ImageSource" AS ENUM ('OFFICIAL', 'COMMUNITY', 'HOME_MANDIR');

-- CreateEnum
CREATE TYPE "ImageStatus" AS ENUM ('PROCESSING', 'AUTO_REJECTED', 'PENDING', 'PRIVATE', 'PUBLIC', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "OfferingKind" AS ENUM ('FLOWER', 'MALA', 'DIYA', 'BHOG', 'SPECIAL');

-- CreateEnum
CREATE TYPE "RitualAction" AS ENUM ('OFFERING', 'AARTI_COMPLETE', 'BELL', 'DARSHAN');

-- CreateEnum
CREATE TYPE "CoinTxnReason" AS ENUM ('PURCHASE', 'OFFERING', 'REWARD', 'REFUND', 'ADMIN_ADJUST');

-- CreateTable
CREATE TABLE "deities" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "weekday" INTEGER,
    "default_image_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temples" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_hi" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "photography_restricted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "temples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deity_images" (
    "id" UUID NOT NULL,
    "deity_id" UUID NOT NULL,
    "temple_id" UUID,
    "source" "ImageSource" NOT NULL,
    "status" "ImageStatus" NOT NULL DEFAULT 'PROCESSING',
    "uploaded_by_id" UUID,
    "object_key" TEXT NOT NULL,
    "variants" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "phash" TEXT,
    "possible_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "moderation_score" JSONB,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "anchor_x" DOUBLE PRECISION,
    "anchor_y" DOUBLE PRECISION,
    "credit_name" TEXT,
    "show_credit" BOOLEAN NOT NULL DEFAULT true,
    "consent_at" TIMESTAMP(3),
    "license_info" TEXT,
    "reject_reason" TEXT,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deity_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_reports" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" UUID NOT NULL,
    "image_id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_items" (
    "id" UUID NOT NULL,
    "kind" "OfferingKind" NOT NULL,
    "name_hi" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "icon_url" TEXT NOT NULL,
    "sprite_url" TEXT NOT NULL,
    "animation_key" TEXT NOT NULL,
    "particle_count" INTEGER NOT NULL DEFAULT 20,
    "coin_cost" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "offering_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_item_deities" (
    "offering_item_id" UUID NOT NULL,
    "deity_id" UUID NOT NULL,

    CONSTRAINT "offering_item_deities_pkey" PRIMARY KEY ("offering_item_id","deity_id")
);

-- CreateTable
CREATE TABLE "aartis" (
    "id" UUID NOT NULL,
    "deity_id" UUID NOT NULL,
    "title_hi" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "audio_key" TEXT NOT NULL,
    "lyrics_key" TEXT NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "license_info" TEXT,

    CONSTRAINT "aartis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_deities" (
    "user_id" UUID NOT NULL,
    "deity_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "selected_image_id" UUID,

    CONSTRAINT "user_deities_pkey" PRIMARY KEY ("user_id","deity_id")
);

-- CreateTable
CREATE TABLE "ritual_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "deity_id" UUID NOT NULL,
    "action" "RitualAction" NOT NULL,
    "offering_item_id" UUID,
    "aarti_id" UUID,
    "coins_spent" INTEGER NOT NULL DEFAULT 0,
    "local_date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ritual_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_streaks" (
    "user_id" UUID NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "last_date" TEXT,
    "freezes_left" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_streaks_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_badges" (
    "user_id" UUID NOT NULL,
    "badge_key" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_badges_pkey" PRIMARY KEY ("user_id","badge_key")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "frame_key" TEXT NOT NULL,
    "colors" JSONB NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "deity_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_wallets" (
    "user_id" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coin_wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "coin_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" "CoinTxnReason" NOT NULL,
    "ref_type" TEXT,
    "ref_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_packs" (
    "id" UUID NOT NULL,
    "coins" INTEGER NOT NULL,
    "bonus_coins" INTEGER NOT NULL DEFAULT 0,
    "product_id_ios" TEXT NOT NULL,
    "product_id_android" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "coin_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_purchases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "coin_pack_id" UUID NOT NULL,
    "store_transaction_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "raw_event" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_rules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "coins" INTEGER NOT NULL,
    "daily_cap" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deities_slug_key" ON "deities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "deities_default_image_id_key" ON "deities"("default_image_id");

-- CreateIndex
CREATE INDEX "temples_city_idx" ON "temples"("city");

-- CreateIndex
CREATE INDEX "deity_images_deity_id_source_status_idx" ON "deity_images"("deity_id", "source", "status");

-- CreateIndex
CREATE INDEX "deity_images_uploaded_by_id_idx" ON "deity_images"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "deity_images_phash_idx" ON "deity_images"("phash");

-- CreateIndex
CREATE UNIQUE INDEX "image_reports_image_id_reported_by_id_key" ON "image_reports"("image_id", "reported_by_id");

-- CreateIndex
CREATE INDEX "moderation_logs_image_id_idx" ON "moderation_logs"("image_id");

-- CreateIndex
CREATE INDEX "offering_item_deities_deity_id_idx" ON "offering_item_deities"("deity_id");

-- CreateIndex
CREATE INDEX "aartis_deity_id_idx" ON "aartis"("deity_id");

-- CreateIndex
CREATE INDEX "user_deities_selected_image_id_idx" ON "user_deities"("selected_image_id");

-- CreateIndex
CREATE INDEX "ritual_logs_user_id_local_date_idx" ON "ritual_logs"("user_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "themes_key_key" ON "themes"("key");

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_created_at_idx" ON "coin_transactions"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "coin_purchases_store_transaction_id_key" ON "coin_purchases"("store_transaction_id");

-- CreateIndex
CREATE INDEX "coin_purchases_user_id_idx" ON "coin_purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_rules_key_key" ON "reward_rules"("key");

-- AddForeignKey
ALTER TABLE "deities" ADD CONSTRAINT "deities_default_image_id_fkey" FOREIGN KEY ("default_image_id") REFERENCES "deity_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temples" ADD CONSTRAINT "temples_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deity_images" ADD CONSTRAINT "deity_images_deity_id_fkey" FOREIGN KEY ("deity_id") REFERENCES "deities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deity_images" ADD CONSTRAINT "deity_images_temple_id_fkey" FOREIGN KEY ("temple_id") REFERENCES "temples"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deity_images" ADD CONSTRAINT "deity_images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_reports" ADD CONSTRAINT "image_reports_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "deity_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_reports" ADD CONSTRAINT "image_reports_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "deity_images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_item_deities" ADD CONSTRAINT "offering_item_deities_offering_item_id_fkey" FOREIGN KEY ("offering_item_id") REFERENCES "offering_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_item_deities" ADD CONSTRAINT "offering_item_deities_deity_id_fkey" FOREIGN KEY ("deity_id") REFERENCES "deities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aartis" ADD CONSTRAINT "aartis_deity_id_fkey" FOREIGN KEY ("deity_id") REFERENCES "deities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_deities" ADD CONSTRAINT "user_deities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_deities" ADD CONSTRAINT "user_deities_deity_id_fkey" FOREIGN KEY ("deity_id") REFERENCES "deities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_deities" ADD CONSTRAINT "user_deities_selected_image_id_fkey" FOREIGN KEY ("selected_image_id") REFERENCES "deity_images"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ritual_logs" ADD CONSTRAINT "ritual_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ritual_logs" ADD CONSTRAINT "ritual_logs_deity_id_fkey" FOREIGN KEY ("deity_id") REFERENCES "deities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ritual_logs" ADD CONSTRAINT "ritual_logs_offering_item_id_fkey" FOREIGN KEY ("offering_item_id") REFERENCES "offering_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ritual_logs" ADD CONSTRAINT "ritual_logs_aarti_id_fkey" FOREIGN KEY ("aarti_id") REFERENCES "aartis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_wallets" ADD CONSTRAINT "coin_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coin_purchases" ADD CONSTRAINT "coin_purchases_coin_pack_id_fkey" FOREIGN KEY ("coin_pack_id") REFERENCES "coin_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Coin balances can never go below 0 (docs/modules/01-virtual-mandir.md §5 Rules). Hand-written: Prisma has no CHECK syntax.
ALTER TABLE "coin_wallets" ADD CONSTRAINT "coin_wallets_balance_non_negative" CHECK ("balance" >= 0);
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_balance_after_non_negative" CHECK ("balance_after" >= 0);
ALTER TABLE "coin_transactions" ADD CONSTRAINT "coin_transactions_amount_non_zero" CHECK ("amount" <> 0);
