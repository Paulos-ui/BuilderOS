-- Six-digit email sign-in codes.
-- Only a salted hash of the code is stored; the plaintext never persists.
CREATE TABLE IF NOT EXISTS "email_otps" (
  "id"         TEXT NOT NULL,
  "email"      TEXT NOT NULL,
  "code_hash"  TEXT NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_otps_pkey" PRIMARY KEY ("id")
);

-- The verify path always looks up the newest unused code for an address.
CREATE INDEX IF NOT EXISTS "email_otps_email_created_at_idx"
  ON "email_otps" ("email", "created_at" DESC);
