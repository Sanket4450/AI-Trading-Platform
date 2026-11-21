-- Replace data_quality_issues with a current-state issue ledger.
--
-- An issue row exists only while the problem is active. The detecting job owns
-- the identity (`dedupe_key`) and the type-specific structure (`payload`), so a
-- successful re-run can delete the exact row it previously raised. There is no
-- status, acknowledgement or resolution lifecycle.
--
-- Forward-only: the old table is intentionally not migrated.

DROP TABLE IF EXISTS data_quality_issues;

CREATE TABLE system_issues (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source           varchar(64) NOT NULL,
  kind             varchar(64) NOT NULL,
  severity         varchar(32) NOT NULL,
  provider_id      uuid REFERENCES providers(id),
  instrument_id    uuid REFERENCES instruments(id),
  dedupe_key       varchar(64) NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_system_issues_dedupe UNIQUE (dedupe_key),
  CONSTRAINT chk_system_issues_severity CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT chk_system_issues_occurrence CHECK (occurrence_count > 0)
);

CREATE INDEX idx_system_issues_triage
  ON system_issues (source, kind, last_seen_at DESC);

CREATE INDEX idx_system_issues_instrument
  ON system_issues (instrument_id, last_seen_at DESC);

CREATE INDEX idx_system_issues_provider
  ON system_issues (provider_id, last_seen_at DESC);
