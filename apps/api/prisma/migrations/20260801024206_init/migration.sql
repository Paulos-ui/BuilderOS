-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL', 'WALLET', 'BOTH');

-- CreateEnum
CREATE TYPE "OpportunityCategory" AS ENUM ('GRANT', 'HACKATHON', 'BOUNTY', 'ACCELERATOR', 'ECOSYSTEM_FUND');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('OPEN', 'CLOSED', 'STALE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'SCORED', 'SUBMITTED', 'WON', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttestationType" AS ENUM ('GRANT_COMPLETED', 'CONTRIBUTION_VERIFIED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SETTLED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "wallet_address" TEXT,
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'EMAIL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_nonces" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "address" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builder_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "github_username" TEXT,
    "chains" JSONB NOT NULL DEFAULT '[]',
    "languages" JSONB NOT NULL DEFAULT '[]',
    "bio" TEXT,
    "embedding" vector(1536),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "builder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "OpportunityCategory" NOT NULL,
    "chains" JSONB NOT NULL DEFAULT '[]',
    "funding_min" DECIMAL(65,30),
    "funding_max" DECIMAL(65,30),
    "deadline" TIMESTAMP(3),
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "last_verified_at" TIMESTAMP(3) NOT NULL,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
    "embedding" vector(1536),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_matches" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "score" DECIMAL(65,30) NOT NULL,
    "reason" JSONB NOT NULL DEFAULT '{}',
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "opportunity_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL DEFAULT '{}',
    "score" DECIMAL(65,30),
    "score_breakdown" JSONB,
    "model_version" TEXT,
    "prompt_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attestations" (
    "id" TEXT NOT NULL,
    "builder_profile_id" TEXT NOT NULL,
    "application_id" TEXT,
    "type" "AttestationType" NOT NULL,
    "chain_tx_hash" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "from_ref" TEXT NOT NULL,
    "to_builder_profile_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "x402_payment_id" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "user_id" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "cost_usd" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "auth_nonces_address_idx" ON "auth_nonces"("address");

-- CreateIndex
CREATE UNIQUE INDEX "magic_link_tokens_token_key" ON "magic_link_tokens"("token");

-- CreateIndex
CREATE INDEX "magic_link_tokens_email_idx" ON "magic_link_tokens"("email");

-- CreateIndex
CREATE UNIQUE INDEX "builder_profiles_user_id_key" ON "builder_profiles"("user_id");

-- CreateIndex
CREATE INDEX "opportunities_deadline_status_idx" ON "opportunities"("deadline", "status");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_matches_builder_profile_id_opportunity_id_key" ON "opportunity_matches"("builder_profile_id", "opportunity_id");

-- CreateIndex
CREATE INDEX "applications_builder_profile_id_status_idx" ON "applications"("builder_profile_id", "status");

-- CreateIndex
CREATE INDEX "agent_runs_agent_name_created_at_idx" ON "agent_runs"("agent_name", "created_at");

-- AddForeignKey
ALTER TABLE "auth_nonces" ADD CONSTRAINT "auth_nonces_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builder_profiles" ADD CONSTRAINT "builder_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_matches" ADD CONSTRAINT "opportunity_matches_builder_profile_id_fkey" FOREIGN KEY ("builder_profile_id") REFERENCES "builder_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_matches" ADD CONSTRAINT "opportunity_matches_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_builder_profile_id_fkey" FOREIGN KEY ("builder_profile_id") REFERENCES "builder_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_builder_profile_id_fkey" FOREIGN KEY ("builder_profile_id") REFERENCES "builder_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_to_builder_profile_id_fkey" FOREIGN KEY ("to_builder_profile_id") REFERENCES "builder_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
