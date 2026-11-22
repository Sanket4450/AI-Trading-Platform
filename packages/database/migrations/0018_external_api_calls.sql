-- Ledger of every outbound network call: one row per request attempt, append-only.
--
-- Success payloads are never stored here; the payload tables already own that data and
-- duplicating them would dwarf the rest of the database. Only failed calls keep a body, and it
-- is capped by the check below. Retention is 90 days, enforced by the maintenance job.

CREATE TABLE external_api_calls (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_run_id    uuid REFERENCES job_runs(id) ON DELETE SET NULL,
  instrument_id uuid REFERENCES instruments(id) ON DELETE SET NULL,
  started_at    timestamptz NOT NULL DEFAULT clock_timestamp(),
  latency_ms    integer NOT NULL,
  service       varchar(32) NOT NULL,
  operation     varchar(64) NOT NULL,
  request_scope jsonb NOT NULL DEFAULT '{"path":{},"query":{},"body":{}}'::jsonb,
  status_code   smallint,
  outcome       varchar(32) NOT NULL,
  error_body    text,

  CONSTRAINT chk_external_api_calls_latency CHECK (latency_ms >= 0),
  CONSTRAINT chk_external_api_calls_status
    CHECK (status_code IS NULL OR status_code BETWEEN 100 AND 599),
  CONSTRAINT chk_external_api_calls_scope CHECK (
    jsonb_typeof(request_scope) = 'object'
    AND jsonb_typeof(request_scope -> 'path') = 'object'
    AND jsonb_typeof(request_scope -> 'query') = 'object'
    AND jsonb_typeof(request_scope -> 'body') = 'object'
  ),
  CONSTRAINT chk_external_api_calls_outcome CHECK (outcome IN (
    'success','contract_error','auth_error','client_error','throttled',
    'server_error','timeout','network_error','unknown')),
  CONSTRAINT chk_external_api_calls_error_body CHECK (
    error_body IS NULL OR (outcome <> 'success' AND octet_length(error_body) <= 8192))
);

-- Retention sweep and time-series reads.
CREATE INDEX idx_external_api_calls_started
  ON external_api_calls (started_at);

-- Job detail page: newest calls of one run, keyset paged on id.
CREATE INDEX idx_external_api_calls_job
  ON external_api_calls (job_run_id, id DESC) WHERE job_run_id IS NOT NULL;

-- Failure triage across runs.
CREATE INDEX idx_external_api_calls_failures
  ON external_api_calls (service, outcome, started_at DESC) WHERE outcome <> 'success';

CREATE INDEX idx_external_api_calls_instrument
  ON external_api_calls (instrument_id, started_at DESC) WHERE instrument_id IS NOT NULL;

-- Rows are never rewritten; only the retention delete removes them.
CREATE TRIGGER trg_external_api_calls_immutable
  BEFORE UPDATE ON external_api_calls
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
