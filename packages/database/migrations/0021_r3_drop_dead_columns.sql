-- R3 column cleanup. Seven columns with no producer/consumer and no planned owner.
-- No table is dropped. See docs/operations/schema-column-audit.md for the evidence per column.

ALTER TABLE providers DROP COLUMN IF EXISTS capabilities;

ALTER TABLE raw_provider_payloads
  DROP COLUMN IF EXISTS http_method,
  DROP COLUMN IF EXISTS http_status;

ALTER TABLE market_candles_1m DROP COLUMN IF EXISTS created_at;

ALTER TABLE risk_decisions DROP COLUMN IF EXISTS created_at;

ALTER TABLE orders DROP COLUMN IF EXISTS order_ref_id;

ALTER TABLE reconciliations DROP COLUMN IF EXISTS raw_payload_id;
