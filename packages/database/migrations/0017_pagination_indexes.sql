-- Composite keyset indexes.
--
-- Keyset pagination compares whole `(sort_column, id)` tuples. A single-column index leaves the
-- tie-break to a sort, and `created_at` is not unique: a batch enqueue or one transaction writes
-- many rows with the same timestamp.

CREATE INDEX IF NOT EXISTS "idx_job_runs_created_id"
  ON "job_runs" ("created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_job_runs_status_created_id"
  ON "job_runs" ("status", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_audit_log_created_id"
  ON "audit_log" ("created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_account_equity_account_captured_id"
  ON "account_equity_snapshots" ("account_id", "captured_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_trading_sessions_account_date_id"
  ON "trading_sessions" ("account_id", "trading_date" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_configuration_versions_created_id"
  ON "configuration_versions" ("created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_system_issues_last_seen_id"
  ON "system_issues" ("last_seen_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_instruments_symbol_id"
  ON "instruments" ("trading_symbol", "id");

CREATE INDEX IF NOT EXISTS "idx_instrument_mappings_instrument_valid"
  ON "instrument_provider_mappings" ("instrument_id", "valid_from" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "idx_corporate_actions_instrument_ex_date"
  ON "corporate_actions" ("instrument_id", "ex_date" DESC, "id" DESC);
