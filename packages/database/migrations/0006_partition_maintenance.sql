-- Create monthly partitions ahead of ingestion. Called by the worker before a
-- backfill and by the monthly maintenance job.

CREATE OR REPLACE FUNCTION ensure_monthly_partitions(
  parent_table regclass,
  from_month date,
  to_month date
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  current_month date := date_trunc('month', from_month)::date;
  next_month date;
  partition_name text;
  created integer := 0;
BEGIN
  IF to_month <= from_month THEN
    RAISE EXCEPTION 'to_month must be later than from_month';
  END IF;

  WHILE current_month < date_trunc('month', to_month)::date LOOP
    next_month := (current_month + INTERVAL '1 month')::date;
    partition_name := parent_table::text || '_' || to_char(current_month, 'YYYY_MM');

    IF to_regclass(partition_name) IS NULL THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        parent_table,
        current_month::timestamptz,
        next_month::timestamptz
      );
      created := created + 1;
    END IF;

    current_month := next_month;
  END LOOP;

  RETURN created;
END;
$$;

CREATE OR REPLACE FUNCTION ensure_market_partitions(months_ahead integer DEFAULT 5)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  start_month date := date_trunc('month', now())::date;
  end_month date := (date_trunc('month', now()) + make_interval(months => months_ahead + 1))::date;
BEGIN
  PERFORM ensure_monthly_partitions('market_candles_1m'::regclass, start_month, end_month);
  PERFORM ensure_monthly_partitions('market_quote_snapshots'::regclass, start_month, end_month);
END;
$$;

COMMENT ON FUNCTION ensure_monthly_partitions(regclass, date, date)
  IS 'Create missing monthly range partitions for a partitioned parent table.';
COMMENT ON FUNCTION ensure_market_partitions(integer)
  IS 'Ensure market data partitions exist for the current month and the requested lookahead.';
