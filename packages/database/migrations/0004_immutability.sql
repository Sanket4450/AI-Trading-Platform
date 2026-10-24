-- Immutability and audit guards.
--
-- The application never updates configuration payloads, event streams or
-- financial rows in place. These triggers make that a database guarantee
-- rather than a convention.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || target.table_name || '_updated_at'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        'trg_' || target.table_name || '_updated_at',
        target.table_name
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only and cannot be changed',
    TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE OR REPLACE FUNCTION protect_strategy_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'strategy_versions rows cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;

  IF NEW.strategy_id IS DISTINCT FROM OLD.strategy_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.code_ref IS DISTINCT FROM OLD.code_ref
     OR NEW.parameter_schema IS DISTINCT FROM OLD.parameter_schema THEN
    RAISE EXCEPTION 'Released strategy versions are immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;

  RETURN NEW;
END;
$$;

-- Configuration snapshots are insert-only.
CREATE TRIGGER trg_configuration_versions_immutable
  BEFORE UPDATE OR DELETE ON configuration_versions
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Event streams and audit are append-only.
CREATE TRIGGER trg_audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER trg_domain_events_append_only
  BEFORE UPDATE OR DELETE ON domain_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER trg_order_events_append_only
  BEFORE UPDATE OR DELETE ON order_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER trg_position_events_append_only
  BEFORE UPDATE OR DELETE ON position_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Raw payloads may be deleted by retention but never rewritten.
CREATE TRIGGER trg_raw_provider_payloads_no_update
  BEFORE UPDATE ON raw_provider_payloads
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Strategy versions allow status promotion but not code or schema changes.
CREATE TRIGGER trg_strategy_versions_immutable
  BEFORE UPDATE OR DELETE ON strategy_versions
  FOR EACH ROW EXECUTE FUNCTION protect_strategy_version();

-- Reference entities are retired, never deleted.
CREATE TRIGGER trg_instruments_no_delete
  BEFORE DELETE ON instruments
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER trg_accounts_no_delete
  BEFORE DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- Financial records are never hard-deleted.
DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'orders',
    'fills',
    'trade_costs',
    'positions',
    'round_trip_trades',
    'reconciliations',
    'reconciliation_issues',
    'backtest_runs',
    'backtest_windows',
    'backtest_trades',
    'backtest_equity_curve',
    'backtest_metrics',
    'strategy_promotion_reviews',
    'daily_performance',
    'strategy_performance_daily'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger WHERE tgname = 'trg_' || target || '_no_delete'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION reject_mutation()',
        'trg_' || target || '_no_delete',
        target
      );
    END IF;
  END LOOP;
END;
$$;
