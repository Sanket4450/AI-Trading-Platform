-- 1. Chunk ledger -----------------------------------------------------------

ALTER TABLE market_data_ingestion_runs
  ADD COLUMN IF NOT EXISTS parent_job_run_id uuid REFERENCES job_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS chunk_count integer,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS request_fingerprint char(64),
  ADD COLUMN IF NOT EXISTS http_status smallint,
  ADD COLUMN IF NOT EXISTS provider_error_code varchar(40),
  ADD COLUMN IF NOT EXISTS rows_skipped integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rows_updated integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS rate_limited_until timestamptz;

ALTER TABLE market_data_ingestion_runs
  DROP CONSTRAINT IF EXISTS chk_market_data_ingestion_runs_run_type_1,
  DROP CONSTRAINT IF EXISTS chk_market_data_ingestion_runs_status_4;

ALTER TABLE market_data_ingestion_runs
  ADD CONSTRAINT chk_market_data_ingestion_runs_run_type_1
    CHECK (run_type IN (
      'instrument_master', 'historical_backfill', 'historical_repair',
      'intraday_sync', 'quote_snapshot', 'corporate_actions', 'calendar',
      'daily_validation', 'quality_scan'
    )),
  ADD CONSTRAINT chk_market_data_ingestion_runs_status_4
    CHECK (status IN ('queued', 'running', 'succeeded', 'partially_failed', 'failed', 'cancelled')),
  ADD CONSTRAINT chk_runs_counters
    CHECK (
      rows_fetched >= 0 AND rows_written >= 0 AND rows_rejected >= 0
      AND rows_skipped >= 0 AND rows_updated >= 0
      AND (duration_ms IS NULL OR duration_ms >= 0)
    ),
  ADD CONSTRAINT chk_runs_chunk
    CHECK (
      (chunk_index IS NULL OR chunk_index >= 0)
      AND (chunk_count IS NULL OR chunk_count > 0)
      AND attempt > 0
      AND (http_status IS NULL OR (http_status BETWEEN 100 AND 599))
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_parent_chunk
  ON market_data_ingestion_runs (parent_job_run_id, instrument_id, chunk_index)
  WHERE parent_job_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ingestion_parent_status
  ON market_data_ingestion_runs (parent_job_run_id, status);

CREATE INDEX IF NOT EXISTS idx_ingestion_stale_running
  ON market_data_ingestion_runs (status, started_at)
  WHERE status = 'running';

-- One active manual backfill per instrument. Scheduled repair and intraday
-- runs are deliberately exempt.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_active_instrument
  ON market_data_ingestion_runs (instrument_id)
  WHERE status IN ('queued', 'running')
    AND run_type = 'historical_backfill'
    AND instrument_id IS NOT NULL;

-- 2. Strict coverage plus the daily oracle ---------------------------------

ALTER TABLE market_data_coverage
  ADD COLUMN IF NOT EXISTS gap_run_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_gap_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_volume numeric(20,4),
  ADD COLUMN IF NOT EXISTS minute_volume numeric(20,4),
  ADD COLUMN IF NOT EXISTS volume_delta_pct numeric(10,6),
  ADD COLUMN IF NOT EXISTS ohlc_match boolean,
  ADD COLUMN IF NOT EXISTS validation_status varchar(30) NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE market_data_coverage
  DROP CONSTRAINT IF EXISTS chk_market_data_coverage_status_4;

ALTER TABLE market_data_coverage
  ADD CONSTRAINT chk_market_data_coverage_status_4
    CHECK (status IN ('complete', 'partial', 'missing', 'not_applicable')),
  ADD CONSTRAINT chk_coverage_gap_runs
    CHECK (gap_run_count >= 0 AND max_gap_minutes >= 0),
  ADD CONSTRAINT chk_coverage_validation_status
    CHECK (validation_status IN (
      'not_checked', 'pending', 'matched', 'volume_reconciled',
      'volume_mismatch', 'ohlc_mismatch', 'daily_missing', 'minute_missing', 'error'
    ));

CREATE INDEX IF NOT EXISTS idx_coverage_date_validation
  ON market_data_coverage (trading_date, validation_status);

-- 3. Issue dedupe and lifecycle --------------------------------------------

ALTER TABLE data_quality_issues
  ADD COLUMN IF NOT EXISTS rule_id varchar(40),
  ADD COLUMN IF NOT EXISTS dedupe_key char(64),
  ADD COLUMN IF NOT EXISTS occurrence_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolution_note text;

-- Legacy R1 resolutions predate the note requirement. Preserve them with an
-- explicit migration note instead of failing the new constraint.
UPDATE data_quality_issues
   SET resolution_note = 'R2 migration: legacy resolution had no note'
 WHERE status IN ('resolved', 'ignored')
   AND (resolution_note IS NULL OR length(trim(resolution_note)) = 0);

ALTER TABLE data_quality_issues
  DROP CONSTRAINT IF EXISTS chk_data_quality_issues_issue_type_1;

ALTER TABLE data_quality_issues
  ADD CONSTRAINT chk_data_quality_issues_issue_type_1
    CHECK (issue_type IN (
      'missing_bar', 'duplicate_bar', 'invalid_ohlc', 'stale_quote', 'gap',
      'outlier', 'corporate_action_mismatch', 'mapping_missing',
      'coverage_shortfall', 'calendar_mismatch', 'provider_revision',
      'volume_mismatch', 'volume_reconciled', 'stale_ingestion',
      'schema_invalid', 'instrument_missing', 'tick_size_mismatch',
      'rate_limit_exhausted', 'partial_bar', 'unsupported_instrument',
      'duplicate_mapping'
    )),
  ADD CONSTRAINT chk_quality_occurrence
    CHECK (occurrence_count > 0),
  ADD CONSTRAINT chk_quality_resolution
    CHECK (
      status NOT IN ('resolved', 'ignored')
      OR (resolution_note IS NOT NULL AND length(trim(resolution_note)) > 0)
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_quality_open_dedupe
  ON data_quality_issues (dedupe_key)
  WHERE status IN ('open', 'acknowledged') AND dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quality_last_seen
  ON data_quality_issues (status, last_seen_at DESC);

-- 4. Raw payload idempotency ------------------------------------------------

DO $$
DECLARE
  duplicate_groups integer;
BEGIN
  SELECT count(*) INTO duplicate_groups
  FROM (
    SELECT provider_id, request_fingerprint, payload_sha256
    FROM raw_provider_payloads
    GROUP BY provider_id, request_fingerprint, payload_sha256
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_groups > 0 THEN
    RAISE EXCEPTION
      'R2 preflight: % duplicate raw payload group(s). Keep the earliest row per key and repoint references before applying 0008.',
      duplicate_groups;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_raw_payload_request_hash
  ON raw_provider_payloads (provider_id, request_fingerprint, payload_sha256);

-- 5. Persisted catalog projection ------------------------------------------

CREATE TABLE IF NOT EXISTS instrument_data_status (
  instrument_id uuid PRIMARY KEY REFERENCES instruments(id),
  target_from date NOT NULL,
  target_to date NOT NULL,
  fetch_status varchar(20) NOT NULL DEFAULT 'not_requested',
  data_status varchar(20) NOT NULL DEFAULT 'pending',
  expected_days integer NOT NULL DEFAULT 0,
  complete_days integer NOT NULL DEFAULT 0,
  partial_days integer NOT NULL DEFAULT 0,
  missing_days integer NOT NULL DEFAULT 0,
  not_applicable_days integer NOT NULL DEFAULT 0,
  open_critical_issues integer NOT NULL DEFAULT 0,
  last_run_id uuid REFERENCES market_data_ingestion_runs(id),
  active_run_id uuid REFERENCES market_data_ingestion_runs(id),
  last_success_at timestamptz,
  computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_instrument_status_counters CHECK (
    expected_days >= 0 AND complete_days >= 0 AND partial_days >= 0
    AND missing_days >= 0 AND not_applicable_days >= 0
    AND open_critical_issues >= 0 AND target_to >= target_from
  ),
  CONSTRAINT chk_instrument_status_fetch CHECK (
    fetch_status IN ('not_requested','queued','fetching','fetched','partial','failed','cancelled','stale')
  ),
  CONSTRAINT chk_instrument_status_data CHECK (
    data_status IN ('complete','partial_reconciled','partial_mismatch','missing','pending','not_applicable','needs_review')
  )
);

CREATE INDEX IF NOT EXISTS idx_instrument_status_fetch
  ON instrument_data_status (fetch_status, data_status);

CREATE INDEX IF NOT EXISTS idx_instrument_status_last_success
  ON instrument_data_status (last_success_at);

-- 6. Daily-versus-minute evidence ------------------------------------------

CREATE TABLE IF NOT EXISTS market_data_daily_validation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id),
  trading_date date NOT NULL,
  source_provider_id uuid NOT NULL REFERENCES providers(id),
  daily_open numeric(20,4),
  daily_high numeric(20,4),
  daily_low numeric(20,4),
  daily_close numeric(20,4),
  daily_volume numeric(20,4),
  minute_open numeric(20,4),
  minute_high numeric(20,4),
  minute_low numeric(20,4),
  minute_close numeric(20,4),
  minute_volume numeric(20,4),
  volume_delta_pct numeric(10,6),
  ohlc_match boolean,
  volume_match boolean,
  status varchar(30) NOT NULL,
  ingestion_run_id uuid REFERENCES market_data_ingestion_runs(id),
  raw_payload_id uuid REFERENCES raw_provider_payloads(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_daily_validation_status CHECK (
    status IN ('matched','volume_reconciled','volume_mismatch','ohlc_mismatch','daily_missing','minute_missing','error')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_validation_instrument_date_provider
  ON market_data_daily_validation (instrument_id, trading_date, source_provider_id);

CREATE INDEX IF NOT EXISTS idx_daily_validation_date_status
  ON market_data_daily_validation (trading_date, status);

CREATE INDEX IF NOT EXISTS idx_daily_validation_instrument_date
  ON market_data_daily_validation (instrument_id, trading_date);

-- 7. Standard updated-at triggers ------------------------------------------

DROP TRIGGER IF EXISTS trg_instrument_data_status_updated_at ON instrument_data_status;
CREATE TRIGGER trg_instrument_data_status_updated_at
  BEFORE UPDATE ON instrument_data_status
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_market_data_daily_validation_updated_at ON market_data_daily_validation;
CREATE TRIGGER trg_market_data_daily_validation_updated_at
  BEFORE UPDATE ON market_data_daily_validation
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
