-- Ensure pgvector is available (no-op if the extension already exists).
CREATE EXTENSION IF NOT EXISTS vector;

-- IVFFlat index for cosine distance on opportunity embeddings.
-- `lists` trades index build time against query recall; 100 is a reasonable
-- default for corpora in the low tens of thousands. Revisit if the table
-- grows past that.
CREATE INDEX IF NOT EXISTS opportunities_embedding_idx
  ON opportunities USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Supports the structured half of the hybrid query.
CREATE INDEX IF NOT EXISTS opportunities_status_deadline_idx
  ON opportunities (status, deadline);

-- GIN index so the `chains ? 'goat'` containment predicate is indexed
-- rather than scanned.
CREATE INDEX IF NOT EXISTS opportunities_chains_idx
  ON opportunities USING gin (chains jsonb_path_ops);
