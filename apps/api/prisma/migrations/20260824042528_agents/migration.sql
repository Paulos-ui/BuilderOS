-- CreateEnum
CREATE TYPE "ApplicationStage" AS ENUM ('DRAFTING', 'REVIEWING', 'SUBMITTED', 'WON', 'REJECTED', 'ABANDONED');

-- DropIndex
DROP INDEX "email_otps_email_created_at_idx";

-- DropIndex
DROP INDEX "opportunities_chains_idx";

-- DropIndex
DROP INDEX "opportunities_embedding_idx";

-- DropIndex
DROP INDEX "opportunities_status_deadline_idx";

-- CreateTable
CREATE TABLE "tracked_applications" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "opportunity_id" TEXT,
    "title" TEXT NOT NULL,
    "source_url" TEXT,
    "stage" "ApplicationStage" NOT NULL DEFAULT 'DRAFTING',
    "deadline" TIMESTAMP(3),
    "notes" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "last_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_records" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "application_id" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "evidence_url" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "chain_tx_hash" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "agent_key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "x402_order_id" TEXT,
    "amount_minor" INTEGER,
    "currency" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_applications_builder_profile_id_stage_idx" ON "tracked_applications"("builder_profile_id", "stage");

-- CreateIndex
CREATE INDEX "tracked_applications_deadline_idx" ON "tracked_applications"("deadline");

-- CreateIndex
CREATE INDEX "proof_records_builder_profile_id_occurred_at_idx" ON "proof_records"("builder_profile_id", "occurred_at");

-- CreateIndex
CREATE INDEX "usage_records_builder_profile_id_created_at_idx" ON "usage_records"("builder_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "email_otps_email_created_at_idx" ON "email_otps"("email", "created_at");
