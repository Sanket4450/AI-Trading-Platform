-- 1. Stage columns on the existing run ledger ------------------------------

ALTER TABLE job_runs
  ADD COLUMN IF NOT EXISTS current_stage varchar(60),
  ADD COLUMN IF NOT EXISTS stage_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_total smallint,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS summary text;

DO $$
BEGIN
  ALTER TABLE job_runs
    ADD CONSTRAINT chk_job_runs_duration
      CHECK (duration_ms IS NULL OR duration_ms >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE job_runs
    ADD CONSTRAINT chk_job_runs_stage_total
      CHECK (stage_total IS NULL OR stage_total >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_runs_created
  ON job_runs (created_at DESC);

-- 2. Append-only event timeline --------------------------------------------

CREATE TABLE IF NOT EXISTS job_run_events (
  id bigserial PRIMARY KEY,
  job_run_id uuid NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  kind varchar(16) NOT NULL,
  level varchar(8) NOT NULL DEFAULT 'info',
  stage_key varchar(60),
  message text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metric_key varchar(50),
  metric_value numeric(20,4),
  metric_unit varchar(16),
  CONSTRAINT chk_job_run_events_kind
    CHECK (kind IN ('lifecycle','stage','step','metric','warning','error')),
  CONSTRAINT chk_job_run_events_level
    CHECK (level IN ('debug','info','warn','error'))
);

CREATE INDEX IF NOT EXISTS idx_job_run_events_run
  ON job_run_events (job_run_id, id);

CREATE INDEX IF NOT EXISTS idx_job_run_events_time
  ON job_run_events (occurred_at);

CREATE INDEX IF NOT EXISTS idx_job_run_events_metric
  ON job_run_events (job_run_id, metric_key, id DESC)
  WHERE metric_key IS NOT NULL;
