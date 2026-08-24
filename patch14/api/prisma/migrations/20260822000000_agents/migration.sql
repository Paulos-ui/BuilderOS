-- BuilderFlow: applications a builder is actively pursuing.
CREATE TABLE IF NOT EXISTS "tracked_applications" (
  "id"                 TEXT NOT NULL,
  "builder_profile_id" TEXT NOT NULL,
  "opportunity_id"     TEXT,
  "title"              TEXT NOT NULL,
  "source_url"         TEXT,
  "stage"              TEXT NOT NULL DEFAULT 'DRAFTING',
  "deadline"           TIMESTAMP(3),
  "notes"              TEXT,
  "checklist"          JSONB NOT NULL DEFAULT '[]',
  "last_score"         INTEGER,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tracked_applications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tracked_applications_profile_stage_idx"
  ON "tracked_applications" ("builder_profile_id", "stage");
CREATE INDEX IF NOT EXISTS "tracked_applications_deadline_idx"
  ON "tracked_applications" ("deadline");

-- BuilderRep: proof-of-work records derived from completed applications.
CREATE TABLE IF NOT EXISTS "proof_records" (
  "id"                 TEXT NOT NULL,
  "builder_profile_id" TEXT NOT NULL,
  "application_id"     TEXT,
  "kind"               TEXT NOT NULL,
  "title"              TEXT NOT NULL,
  "description"        TEXT,
  "evidence_url"       TEXT,
  "occurred_at"        TIMESTAMP(3) NOT NULL,
  "verified"           BOOLEAN NOT NULL DEFAULT false,
  "chain_tx_hash"      TEXT,
  "metadata"           JSONB NOT NULL DEFAULT '{}',
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proof_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "proof_records_profile_idx"
  ON "proof_records" ("builder_profile_id", "occurred_at" DESC);

-- BuilderPay: metered agent usage, settled over x402.
CREATE TABLE IF NOT EXISTS "usage_records" (
  "id"                 TEXT NOT NULL,
  "builder_profile_id" TEXT NOT NULL,
  "agent_key"          TEXT NOT NULL,
  "operation"          TEXT NOT NULL,
  "billable"           BOOLEAN NOT NULL DEFAULT true,
  "settled"            BOOLEAN NOT NULL DEFAULT false,
  "x402_order_id"      TEXT,
  "amount_minor"       INTEGER,
  "currency"           TEXT,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "usage_records_profile_created_idx"
  ON "usage_records" ("builder_profile_id", "created_at" DESC);
