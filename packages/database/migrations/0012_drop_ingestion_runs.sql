-- Remove the per-chunk ingestion ledger.
--
-- `job_runs` is the orchestration record (one plan, one child job per
-- instrument) and `job_run_events` already carries per-chunk steps and metrics.
-- Coverage rows remain the completeness evidence, and candles keep their
-- raw-payload lineage. The chunk ledger therefore adds no unique capability.
--
-- Order matters: backfill the derived status, drop the dependent columns and
-- foreign keys, then drop the table.

-- 1. Preserve the derived last-success timestamp ---------------------------

UPDATE instrument_data_status AS status
   SET last_success_at = COALESCE(
     (
       SELECT max(job.finished_at)
         FROM job_runs AS job
        WHERE job.job_name = 'historical-backfill'
          AND job.status = 'succeeded'
          AND job.payload ->> 'instrumentId' = status.instrument_id::text
     ),
     status.last_success_at
   );

-- 2. Drop dependent columns and foreign keys -------------------------------

ALTER TABLE market_candles_1m
  DROP CONSTRAINT IF EXISTS fk_market_candles_1m_ingestion_run_id,
  DROP COLUMN IF EXISTS ingestion_run_id;

ALTER TABLE instrument_data_status
  DROP COLUMN IF EXISTS last_run_id,
  DROP COLUMN IF EXISTS active_run_id;

DROP TABLE IF EXISTS market_data_ingestion_runs;

-- 3. Replace the chunk-level guards on job_runs ----------------------------

-- The worker already closes a partially successful child job with this status.
ALTER TABLE job_runs
  DROP CONSTRAINT IF EXISTS chk_job_runs_status_2;

ALTER TABLE job_runs
  ADD CONSTRAINT chk_job_runs_status_2 CHECK (
    status IN ('queued', 'running', 'succeeded', 'partially_failed', 'failed', 'retrying', 'cancelled')
  );

-- A request could enqueue a second child before the worker created its first
-- chunk row. Keep the newest active child per instrument and close the rest so
-- the unique index below can be created safely.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY payload ->> 'instrumentId'
           ORDER BY created_at DESC, id DESC
         ) AS position
    FROM job_runs
   WHERE job_name = 'historical-backfill'
     AND status IN ('queued', 'running')
     AND payload ->> 'instrumentId' IS NOT NULL
)
UPDATE job_runs AS job
   SET status = 'cancelled',
       finished_at = now(),
       error_message = 'Superseded while enforcing one active backfill per instrument'
  FROM ranked
 WHERE job.id = ranked.id
   AND ranked.position > 1;

-- One active manual backfill per instrument, expressed on the child job.
CREATE UNIQUE INDEX IF NOT EXISTS uq_job_runs_active_backfill
  ON job_runs ((payload ->> 'instrumentId'))
  WHERE job_name = 'historical-backfill'
    AND status IN ('queued', 'running')
    AND payload ->> 'instrumentId' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_runs_status_started
  ON job_runs (status, started_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_job_runs_name_status_finished
  ON job_runs (job_name, status, finished_at);

-- Instrument-level lookups across child jobs.
CREATE INDEX IF NOT EXISTS idx_job_runs_payload_instrument
  ON job_runs ((payload ->> 'instrumentId'))
  WHERE payload ->> 'instrumentId' IS NOT NULL;
