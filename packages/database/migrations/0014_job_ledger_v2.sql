-- Job ledger v2: one row per BullMQ job, append-only stage facts, no parent plan rows.
-- The previous ledger is discarded on purpose so the new shape starts empty.

DROP TABLE IF EXISTS job_run_events CASCADE;
DROP TABLE IF EXISTS job_runs CASCADE;

CREATE TABLE job_runs (
  id              uuid PRIMARY KEY,
  job_name        varchar(80) NOT NULL,
  queue_name      varchar(40) NOT NULL,
  status          varchar(20) NOT NULL DEFAULT 'queued',
  group_id        uuid,
  instrument_id   uuid REFERENCES instruments(id) ON DELETE SET NULL,
  attempt         smallint NOT NULL DEFAULT 0,
  max_attempts    smallint NOT NULL DEFAULT 1,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  result          jsonb,
  error           jsonb,
  latest_event_id bigint,
  created_at      timestamptz NOT NULL DEFAULT clock_timestamp(),
  started_at      timestamptz,
  finished_at     timestamptz,
  CONSTRAINT chk_job_runs_status
    CHECK (status IN ('queued','running','succeeded','failed','partially_failed','cancelled')),
  CONSTRAINT chk_job_runs_name
    CHECK (job_name IN (
      'instrument-sync','calendar-sync','historical-backfill','historical-finalize',
      'intraday-sync','coverage-recompute','coverage-rebuild','quality-scan',
      'ingestion-reconcile','refresh-materialized-view','ensure-partitions')),
  CONSTRAINT chk_job_runs_time
    CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CONSTRAINT chk_job_runs_attempt CHECK (attempt >= 0),
  CONSTRAINT chk_job_runs_max_attempts CHECK (max_attempts >= 1),
  CONSTRAINT chk_job_runs_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT chk_job_runs_error CHECK (error IS NULL OR jsonb_typeof(error) = 'object')
);

CREATE TABLE job_run_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_run_id  uuid NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
  stage       varchar(40) NOT NULL,
  type        varchar(16) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT chk_job_run_events_type
    CHECK (type IN ('entered','progress','completed','failed','skipped','warning')),
  CONSTRAINT chk_job_run_events_stage
    CHECK (stage IN (
      'prepare','fetch','normalize','persist','fixture','reconcile','chunks',
      'repair','instruments','clear','scan','stale','sweep','issues',
      'refresh','ensure','finalize')),
  CONSTRAINT chk_job_run_events_data CHECK (jsonb_typeof(data) = 'object')
);

-- `latest_event_id` is a soft pointer maintained by the writer. No FK: a job row and its
-- events are deleted together, and a circular constraint would only add cascade risk.
CREATE INDEX idx_job_runs_created
  ON job_runs (created_at DESC);
CREATE INDEX idx_job_runs_status_started
  ON job_runs (status, started_at);
CREATE INDEX idx_job_runs_name_status_finished
  ON job_runs (job_name, status, finished_at DESC);
CREATE INDEX idx_job_runs_group
  ON job_runs (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_job_runs_instrument
  ON job_runs (instrument_id, created_at DESC) WHERE instrument_id IS NOT NULL;
CREATE INDEX idx_job_runs_latest_event
  ON job_runs (latest_event_id) WHERE latest_event_id IS NOT NULL;

CREATE UNIQUE INDEX uq_job_runs_active_backfill
  ON job_runs (instrument_id)
  WHERE job_name = 'historical-backfill' AND status IN ('queued','running');

CREATE INDEX idx_job_run_events_run
  ON job_run_events (job_run_id, id);
CREATE INDEX idx_job_run_events_stage
  ON job_run_events (job_run_id, stage, id);
CREATE INDEX idx_job_run_events_time
  ON job_run_events (occurred_at);
