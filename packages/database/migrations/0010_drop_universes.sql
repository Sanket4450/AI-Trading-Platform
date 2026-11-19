-- Universe removal: instrument scope is now a flag on the instrument row.
-- Forward-only; the dropped membership data is intentionally not migrated.

ALTER TABLE "instruments"
  ADD COLUMN IF NOT EXISTS "is_sync_target" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "idx_instruments_is_sync_target"
  ON "instruments" ("is_sync_target");

DROP TABLE IF EXISTS "strategy_universe_members";
DROP TABLE IF EXISTS "instrument_universe_members";
DROP TABLE IF EXISTS "instrument_universe_versions";
DROP TABLE IF EXISTS "instrument_universes";
