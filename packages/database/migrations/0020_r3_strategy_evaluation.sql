-- R3 research evaluation: run ledger, per-instrument-day explainability and research signal scope.
-- Forward-only. Existing live-signal columns stay; a research row and a live row are mutually
-- exclusive through the scope check.

ALTER TABLE job_runs DROP CONSTRAINT chk_job_runs_name;
ALTER TABLE job_runs ADD CONSTRAINT chk_job_runs_name
  CHECK (job_name IN (
    'instrument-sync','calendar-sync','historical-backfill','historical-finalize',
    'intraday-sync','coverage-recompute','coverage-rebuild','quality-scan',
    'ingestion-reconcile','refresh-materialized-view','ensure-partitions',
    'strategy-evaluation'));

ALTER TABLE job_run_events DROP CONSTRAINT chk_job_run_events_stage;
ALTER TABLE job_run_events ADD CONSTRAINT chk_job_run_events_stage
  CHECK (stage IN (
    'prepare','fetch','normalize','persist','fixture','reconcile','chunks',
    'repair','instruments','clear','scan','stale','sweep','issues',
    'refresh','ensure','evaluate','finalize'));

CREATE TABLE strategy_evaluation_runs (
  id                            uuid PRIMARY KEY,
  strategy_version_id           uuid NOT NULL REFERENCES strategy_versions(id) ON DELETE RESTRICT,
  configuration_version_id      uuid NOT NULL REFERENCES configuration_versions(id) ON DELETE RESTRICT,
  risk_configuration_version_id uuid REFERENCES configuration_versions(id) ON DELETE RESTRICT,
  account_id                    uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  from_date                     date NOT NULL,
  to_date                       date NOT NULL,
  initial_capital               numeric(20,2) NOT NULL,
  universe                      jsonb NOT NULL,
  status                        varchar(20) NOT NULL DEFAULT 'queued',
  note                          text,
  job_run_id                    uuid REFERENCES job_runs(id) ON DELETE SET NULL,
  error                         jsonb,
  created_by                    uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  started_at                    timestamptz,
  finished_at                   timestamptz,
  CONSTRAINT chk_evaluation_runs_dates CHECK (from_date <= to_date),
  CONSTRAINT chk_evaluation_runs_capital CHECK (initial_capital > 0),
  CONSTRAINT chk_evaluation_runs_time
    CHECK (finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at),
  CONSTRAINT chk_evaluation_runs_status
    CHECK (status IN ('queued','running','completed','failed','cancelled')),
  CONSTRAINT chk_evaluation_runs_universe CHECK (jsonb_typeof(universe) = 'object'),
  CONSTRAINT chk_evaluation_runs_error CHECK (error IS NULL OR jsonb_typeof(error) = 'object')
);

CREATE INDEX idx_evaluation_runs_version_created
  ON strategy_evaluation_runs (strategy_version_id, created_at DESC);
CREATE INDEX idx_evaluation_runs_status
  ON strategy_evaluation_runs (status);
CREATE INDEX idx_evaluation_runs_job
  ON strategy_evaluation_runs (job_run_id);
CREATE UNIQUE INDEX uq_evaluation_runs_active
  ON strategy_evaluation_runs (strategy_version_id)
  WHERE status IN ('queued','running');

CREATE TABLE strategy_evaluation_results (
  id                uuid PRIMARY KEY,
  evaluation_run_id uuid NOT NULL REFERENCES strategy_evaluation_runs(id) ON DELETE CASCADE,
  trading_date      date NOT NULL,
  instrument_id     uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  status            varchar(20) NOT NULL,
  reason_code       varchar(40),
  diagnostics       jsonb NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_evaluation_results_status
    CHECK (status IN ('signal','no_signal','skipped')),
  CONSTRAINT chk_evaluation_results_reason
    CHECK ((status = 'signal' AND reason_code IS NULL)
        OR (status <> 'signal' AND reason_code IS NOT NULL)),
  CONSTRAINT chk_evaluation_results_diagnostics CHECK (jsonb_typeof(diagnostics) = 'object')
);

CREATE UNIQUE INDEX uq_evaluation_result_day
  ON strategy_evaluation_results (evaluation_run_id, trading_date, instrument_id);
CREATE INDEX idx_evaluation_results_day
  ON strategy_evaluation_results (evaluation_run_id, trading_date);
CREATE INDEX idx_evaluation_results_status
  ON strategy_evaluation_results (evaluation_run_id, status);
CREATE INDEX idx_evaluation_results_reason
  ON strategy_evaluation_results (evaluation_run_id, reason_code);
CREATE INDEX idx_evaluation_results_instrument
  ON strategy_evaluation_results (instrument_id);

ALTER TABLE signals ALTER COLUMN trading_session_id DROP NOT NULL;
ALTER TABLE signals
  ADD COLUMN evaluation_run_id uuid REFERENCES strategy_evaluation_runs(id) ON DELETE CASCADE;

ALTER TABLE signals
  ADD CONSTRAINT chk_signals_scope
    CHECK (num_nonnulls(trading_session_id, evaluation_run_id) = 1);
ALTER TABLE signals
  ADD CONSTRAINT chk_signals_quantity_whole
    CHECK (quantity IS NULL OR quantity = trunc(quantity));
ALTER TABLE signals
  ADD CONSTRAINT chk_signals_evidence_object
    CHECK (jsonb_typeof(evidence) = 'object');

CREATE UNIQUE INDEX uq_signals_research_decision
  ON signals (evaluation_run_id, strategy_version_id, instrument_id, candle_start, signal_type)
  WHERE evaluation_run_id IS NOT NULL;
CREATE UNIQUE INDEX uq_signals_live_decision
  ON signals (trading_session_id, strategy_version_id, instrument_id, candle_start, signal_type)
  WHERE trading_session_id IS NOT NULL;
CREATE INDEX idx_signals_run_timeline
  ON signals (evaluation_run_id, signal_at)
  WHERE evaluation_run_id IS NOT NULL;
CREATE INDEX idx_signals_instrument_candle
  ON signals (instrument_id, candle_start DESC);
