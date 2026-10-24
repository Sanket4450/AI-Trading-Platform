-- Daily projection used by universe selection and the dashboard.
-- This is a rebuildable cache, never a source of truth.

CREATE MATERIALIZED VIEW "mv_instrument_daily_stats" AS
SELECT
  c."instrument_id" AS instrument_id,
  c."trading_date" AS trading_date,
  (array_agg(c."open" ORDER BY c."candle_start"))[1] AS open,
  max(c."high") AS high,
  min(c."low") AS low,
  (array_agg(c."close" ORDER BY c."candle_start" DESC))[1] AS close,
  sum(c."volume") AS volume,
  sum(c."close" * c."volume") AS traded_value,
  sum((((c."high" + c."low" + c."close") / 3) * c."volume"))
    / nullif(sum(c."volume"), 0) AS vwap_approx,
  count(*)::integer AS bar_count
FROM "market_candles_1m" c
GROUP BY c."instrument_id", c."trading_date";

CREATE UNIQUE INDEX "uq_mv_instrument_daily_stats"
  ON "mv_instrument_daily_stats" ("instrument_id", "trading_date");

CREATE INDEX "idx_mv_instrument_daily_stats_date_value"
  ON "mv_instrument_daily_stats" ("trading_date", "traded_value" DESC);

CREATE OR REPLACE FUNCTION refresh_instrument_daily_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_instrument_daily_stats;
END;
$$;

COMMENT ON MATERIALIZED VIEW "mv_instrument_daily_stats"
  IS 'Rebuildable daily OHLCV, traded value and approximate VWAP projection from 1-minute candles.';
