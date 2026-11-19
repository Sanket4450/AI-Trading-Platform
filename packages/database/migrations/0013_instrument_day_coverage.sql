-- Replace market_data_coverage with instrument_day_coverage.
--
-- The old table stored a derived verdict, gap metrics and a polymorphic
-- evidence blob. The replacement stores only what the candles cannot answer on
-- their own: how many session minutes were expected and how many distinct
-- minutes are present. Rows exist only for days the instrument was expected to
-- trade, so `not_applicable` is no longer a stored state. Missing minutes are
-- read as `expected_bars - stored_bars` and are never stored.
--
-- This table is a rebuildable cache. Refill it with the `coverage-rebuild` job
-- (POST /system/coverage/rebuild) or the nightly `coverage-recompute` job.

DROP TABLE IF EXISTS market_data_coverage;

CREATE TABLE instrument_day_coverage (
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE NO ACTION,
  trading_date date NOT NULL,
  expected_bars integer NOT NULL,
  stored_bars integer NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT instrument_day_coverage_pkey PRIMARY KEY (instrument_id, trading_date),
  CONSTRAINT chk_instrument_day_coverage_counts CHECK (
    expected_bars > 0 AND stored_bars >= 0 AND stored_bars <= expected_bars
  )
);

CREATE INDEX idx_instrument_day_coverage_trading_date
  ON instrument_day_coverage (trading_date);

-- Days with no expected minutes no longer have a row, so the counter that
-- tracked them has no meaning.
ALTER TABLE instrument_data_status
  DROP CONSTRAINT IF EXISTS chk_instrument_status_counters;

ALTER TABLE instrument_data_status
  DROP COLUMN IF EXISTS not_applicable_days;

ALTER TABLE instrument_data_status
  ADD CONSTRAINT chk_instrument_status_counters CHECK (
    expected_days >= 0 AND complete_days >= 0 AND partial_days >= 0
    AND missing_days >= 0 AND open_critical_issues >= 0
    AND target_to >= target_from
  );

-- The rollup was computed from the dropped table. Reset it so the next
-- coverage run repopulates the counters from the new rows.
UPDATE instrument_data_status
   SET expected_days = 0,
       complete_days = 0,
       partial_days = 0,
       missing_days = 0,
       data_status = 'pending',
       computed_at = NULL;
