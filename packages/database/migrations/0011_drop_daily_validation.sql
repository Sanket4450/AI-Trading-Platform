-- Remove the daily-oracle validation feature.
--
-- The table was evidence for a daily-versus-minute comparison. Strict coverage
-- remains; the comparison columns and the reconciled data status go with it.
-- `market_data_ingestion_runs.run_type = 'daily_validation'` stays allowed so
-- historical run rows remain valid.

DROP TABLE IF EXISTS market_data_daily_validation;

ALTER TABLE market_data_coverage
  DROP CONSTRAINT IF EXISTS chk_coverage_validation_status,
  DROP COLUMN IF EXISTS validation_status,
  DROP COLUMN IF EXISTS daily_volume,
  DROP COLUMN IF EXISTS minute_volume,
  DROP COLUMN IF EXISTS volume_delta_pct,
  DROP COLUMN IF EXISTS ohlc_match;

DROP INDEX IF EXISTS idx_coverage_date_validation;

-- Old coverage rows keep the comparison evidence in `details`; remove it.
UPDATE market_data_coverage
   SET details = details - 'comparison'
 WHERE details ? 'comparison';

-- No oracle remains to prove a gap was trade-free.
UPDATE instrument_data_status
   SET data_status = 'partial_mismatch'
 WHERE data_status = 'partial_reconciled';

ALTER TABLE instrument_data_status
  DROP CONSTRAINT IF EXISTS chk_instrument_status_data;

ALTER TABLE instrument_data_status
  ADD CONSTRAINT chk_instrument_status_data CHECK (
    data_status IN ('complete','partial_mismatch','missing','pending','not_applicable','needs_review')
  );

-- Settings that only configured the removed feature.
DELETE FROM system_settings
 WHERE key IN ('data.validation.daily_oracle', 'data.quality.volume_tolerance_pct');
