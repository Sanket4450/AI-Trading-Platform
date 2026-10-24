-- Market data tables are range-partitioned by month.
-- They are created here rather than by drizzle-kit because partitioned tables,
-- per-partition indexes and future partition maintenance are explicit SQL.

CREATE TABLE "market_candles_1m" (
  "instrument_id" uuid NOT NULL,
  "candle_start" timestamp with time zone NOT NULL,
  "trading_date" date NOT NULL,
  "open" numeric(20, 4) NOT NULL,
  "high" numeric(20, 4) NOT NULL,
  "low" numeric(20, 4) NOT NULL,
  "close" numeric(20, 4) NOT NULL,
  "volume" numeric(20, 4) DEFAULT '0' NOT NULL,
  "source_provider_id" uuid NOT NULL,
  "ingestion_run_id" uuid,
  "raw_payload_id" uuid,
  "is_final" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_market_candles_1m" PRIMARY KEY ("instrument_id", "candle_start"),
  CONSTRAINT "chk_market_candles_1m_open_positive" CHECK ("open" > 0),
  CONSTRAINT "chk_market_candles_1m_high_bounds" CHECK ("high" >= greatest("open", "close", "low")),
  CONSTRAINT "chk_market_candles_1m_low_positive" CHECK ("low" > 0),
  CONSTRAINT "chk_market_candles_1m_low_bounds" CHECK ("low" <= least("open", "close", "high")),
  CONSTRAINT "chk_market_candles_1m_close_positive" CHECK ("close" > 0),
  CONSTRAINT "chk_market_candles_1m_volume_non_negative" CHECK ("volume" >= 0)
) PARTITION BY RANGE ("candle_start");

CREATE INDEX "idx_market_candles_1m_instrument_date"
  ON "market_candles_1m" ("instrument_id", "trading_date", "candle_start");
CREATE INDEX "idx_market_candles_1m_trading_date"
  ON "market_candles_1m" ("trading_date");
CREATE INDEX "idx_market_candles_1m_source_provider_id"
  ON "market_candles_1m" ("source_provider_id");
CREATE INDEX "idx_market_candles_1m_start_brin"
  ON "market_candles_1m" USING brin ("candle_start");

CREATE TABLE "market_quote_snapshots" (
  "instrument_id" uuid NOT NULL,
  "captured_at" timestamp with time zone NOT NULL,
  "trading_date" date NOT NULL,
  "last_price" numeric(20, 4) NOT NULL,
  "average_price" numeric(20, 4),
  "open" numeric(20, 4),
  "high" numeric(20, 4),
  "low" numeric(20, 4),
  "close" numeric(20, 4),
  "volume" numeric(20, 4),
  "best_bid_price" numeric(20, 4),
  "best_bid_quantity" numeric(20, 4),
  "best_ask_price" numeric(20, 4),
  "best_ask_quantity" numeric(20, 4),
  "total_buy_quantity" numeric(20, 4),
  "total_sell_quantity" numeric(20, 4),
  "lower_circuit_limit" numeric(20, 4),
  "upper_circuit_limit" numeric(20, 4),
  "net_change" numeric(20, 4),
  "source_provider_id" uuid,
  "raw_payload_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "pk_market_quote_snapshots" PRIMARY KEY ("instrument_id", "captured_at"),
  CONSTRAINT "chk_market_quote_snapshots_last_price_positive" CHECK ("last_price" > 0),
  CONSTRAINT "chk_market_quote_snapshots_high_low" CHECK ("high" IS NULL OR "low" IS NULL OR "high" >= "low"),
  CONSTRAINT "chk_market_quote_snapshots_volume_non_negative" CHECK ("volume" IS NULL OR "volume" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_bid_price_non_negative" CHECK ("best_bid_price" IS NULL OR "best_bid_price" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_bid_quantity_non_negative" CHECK ("best_bid_quantity" IS NULL OR "best_bid_quantity" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_ask_price_non_negative" CHECK ("best_ask_price" IS NULL OR "best_ask_price" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_ask_quantity_non_negative" CHECK ("best_ask_quantity" IS NULL OR "best_ask_quantity" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_buy_quantity_non_negative" CHECK ("total_buy_quantity" IS NULL OR "total_buy_quantity" >= 0),
  CONSTRAINT "chk_market_quote_snapshots_sell_quantity_non_negative" CHECK ("total_sell_quantity" IS NULL OR "total_sell_quantity" >= 0)
) PARTITION BY RANGE ("captured_at");

CREATE INDEX "idx_market_quote_snapshots_instrument_time"
  ON "market_quote_snapshots" ("instrument_id", "captured_at" DESC);
CREATE INDEX "idx_market_quote_snapshots_date"
  ON "market_quote_snapshots" ("trading_date");

-- Candle history starts in January 2022. Create monthly partitions through
-- the current month plus five months so backfills never hit a missing range.
DO $$
DECLARE
  month_start date := DATE '2022-01-01';
  month_end date;
  partition_name text;
BEGIN
  WHILE month_start < DATE '2027-04-01' LOOP
    month_end := (month_start + INTERVAL '1 month')::date;
    partition_name := 'market_candles_1m_' || to_char(month_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF market_candles_1m FOR VALUES FROM (%L) TO (%L)',
      partition_name, month_start::timestamptz, month_end::timestamptz
    );
    month_start := month_end;
  END LOOP;
END
$$;

-- Quote snapshots only became useful when live execution arrived. Keep a
-- shorter history; retention is 90 days in R1.
DO $$
DECLARE
  month_start date := DATE '2026-01-01';
  month_end date;
  partition_name text;
BEGIN
  WHILE month_start < DATE '2027-04-01' LOOP
    month_end := (month_start + INTERVAL '1 month')::date;
    partition_name := 'market_quote_snapshots_' || to_char(month_start, 'YYYY_MM');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF market_quote_snapshots FOR VALUES FROM (%L) TO (%L)',
      partition_name, month_start::timestamptz, month_end::timestamptz
    );
    month_start := month_end;
  END LOOP;
END
$$;
