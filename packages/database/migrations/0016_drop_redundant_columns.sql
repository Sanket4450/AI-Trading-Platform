-- Drop the columns identified as redundant in docs/operations/schema-column-audit.md.
--
-- Every dropped column is a duplicate timestamp, a constant for the NSE/BSE cash-equity
-- INR/IST scope, a value that is computed from another column, or a reserved-feature
-- column that is not read anywhere. The audit records the business reason for each.

ALTER TABLE users DROP COLUMN IF EXISTS failed_login_count;

ALTER TABLE user_sessions DROP COLUMN IF EXISTS last_seen_at;

ALTER TABLE accounts DROP COLUMN IF EXISTS timezone;

ALTER TABLE providers DROP COLUMN IF EXISTS is_active;

ALTER TABLE exchanges
  DROP COLUMN IF EXISTS mic,
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS timezone,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS is_active;

ALTER TABLE instruments DROP COLUMN IF EXISTS lot_size;

ALTER TABLE instrument_provider_mappings DROP COLUMN IF EXISTS raw_payload_id;

ALTER TABLE trading_calendar
  DROP COLUMN IF EXISTS pre_open_start,
  DROP COLUMN IF EXISTS closing_auction_start,
  DROP COLUMN IF EXISTS closing_auction_end,
  DROP COLUMN IF EXISTS settlement_date;

ALTER TABLE corporate_actions DROP COLUMN IF EXISTS record_date;

ALTER TABLE raw_provider_payloads DROP COLUMN IF EXISTS content_encoding;

ALTER TABLE market_quote_snapshots
  DROP COLUMN IF EXISTS net_change,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE daily_performance
  DROP COLUMN IF EXISTS net_pnl,
  DROP COLUMN IF EXISTS return_pct,
  DROP COLUMN IF EXISTS win_rate;

ALTER TABLE strategy_performance_daily
  DROP COLUMN IF EXISTS net_pnl,
  DROP COLUMN IF EXISTS win_rate,
  DROP COLUMN IF EXISTS expectancy;

ALTER TABLE job_runs DROP COLUMN IF EXISTS queue_name;

ALTER TABLE system_health_snapshots DROP COLUMN IF EXISTS created_at;

ALTER TABLE notification_events
  DROP COLUMN IF EXISTS sent_at,
  DROP COLUMN IF EXISTS read_at;

ALTER TABLE report_runs
  DROP COLUMN IF EXISTS generated_at,
  DROP COLUMN IF EXISTS file_ref;

ALTER TABLE strategy_activations DROP COLUMN IF EXISTS configuration_version_id;

ALTER TABLE trading_sessions
  DROP COLUMN IF EXISTS configuration_version_id,
  DROP COLUMN IF EXISTS notes;

ALTER TABLE risk_events DROP COLUMN IF EXISTS created_at;

ALTER TABLE account_instrument_permissions
  DROP COLUMN IF EXISTS max_quantity,
  DROP COLUMN IF EXISTS max_open_quantity,
  DROP COLUMN IF EXISTS reason;

ALTER TABLE risk_decisions
  DROP COLUMN IF EXISTS risk_amount,
  DROP COLUMN IF EXISTS stop_distance;

ALTER TABLE orders DROP COLUMN IF EXISTS status_message;

ALTER TABLE fills
  DROP COLUMN IF EXISTS gross_amount,
  DROP COLUMN IF EXISTS exchange_timestamp;

ALTER TABLE trade_costs
  DROP COLUMN IF EXISTS total,
  DROP COLUMN IF EXISTS currency,
  DROP COLUMN IF EXISTS created_at;

-- `positions.status` was the state behind the open-position unique index. Preserve
-- the invariant on the lifecycle timestamp instead of the derived label.
DROP INDEX IF EXISTS uq_positions_open;

ALTER TABLE positions
  DROP COLUMN IF EXISTS market_value,
  DROP COLUMN IF EXISTS unrealized_pnl,
  DROP COLUMN IF EXISTS status;

CREATE UNIQUE INDEX uq_positions_open
  ON positions (account_id, instrument_id, product)
  WHERE closed_at IS NULL;

ALTER TABLE positions
  ADD CONSTRAINT chk_positions_open_quantity
  CHECK (closed_at IS NOT NULL OR quantity <> 0);

ALTER TABLE position_events DROP COLUMN IF EXISTS created_at;

ALTER TABLE broker_position_snapshots
  DROP COLUMN IF EXISTS multiplier,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE holdings_snapshots DROP COLUMN IF EXISTS created_at;

ALTER TABLE account_equity_snapshots
  DROP COLUMN IF EXISTS net_equity,
  DROP COLUMN IF EXISTS drawdown_pct,
  DROP COLUMN IF EXISTS created_at;

ALTER TABLE round_trip_trades
  DROP COLUMN IF EXISTS net_pnl,
  DROP COLUMN IF EXISTS r_multiple,
  DROP COLUMN IF EXISTS status;

ALTER TABLE reconciliations DROP COLUMN IF EXISTS mismatches_count;

ALTER TABLE backtest_trades
  DROP COLUMN IF EXISTS net_pnl,
  DROP COLUMN IF EXISTS r_multiple;
