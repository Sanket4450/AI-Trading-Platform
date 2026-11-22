# Schema column audit — R2

**Date:** 2026-11-20
**Scope:** all 55 logical tables in `packages/database/schema/*.ts` (plus the SQL-only checks in
`packages/database/migrations/`).
**Method:** each column was checked against the Drizzle schema, the repositories, the worker ingestion and
quality services, the seed, the API DTOs and the web types. A column is called *dead* when no code writes or
reads it, and *duplicate* when another column in the same row always carries the same value.

> **Update — 2026-11-21.** `0015_system_issues.sql` replaced `data_quality_issues` with
> `system_issues`, so the `data_quality_issues.created_at` item below no longer exists; `system_issues`
> has no redundant column. The remaining list is prepared for removal in
> `0016_drop_redundant_columns.sql`, including the previously flagged future-use and audit-snapshot
> columns, per the explicit decision to remove all of them.

## How to read this

| Label          | Meaning                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Remove**     | No producer, no consumer, or an exact duplicate. Safe to drop in an R2 cleanup.                |
| **Derived**    | Pure function of other columns in the same row. Drop only if you want one source of truth.      |
| **Reserved**   | The table is reserved for R3–R6 and has no writer yet. Do not treat "unused" as "wrong".        |
| **Write-only** | Written but never read. Kept on purpose as audit/lineage evidence unless stated otherwise.      |

## Executive summary

- **18 columns are definitively removable** across 16 tables. Four of them are the trading-calendar
  auction/settlement fields.
- **6 further columns are derived** inside active R2 tables or reserved tables. They are listed separately
  because dropping them changes how a future feature computes its output.
- **30 tables have no producer in R2.** They are deliberately reserved for execution, backtesting,
  notifications and reports. They should not be dropped as part of a column cleanup; the ones that are
  already read by the API (`notifications`, `reports`, `health-snapshots`, `sessions`, `risk-events`) will
  simply stay empty.
- `mv_instrument_daily_stats` is refreshed by a job but never queried. That is a view-usage question, not a
  column question.

---

## 1. Definitive removals (R2 cleanup)

| #  | Table.column                                         | Why it can go                                                                                                                                  |
| -- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | `user_sessions.last_seen_at`                         | Written by `touchSession()` on **every authenticated request** and never read. Session expiry is absolute (`expires_at`); there is no idle-timeout. |
| 2  | `trading_calendar.settlement_date`                   | Both writers set `NULL` (`seed.ts`, `syncTradingCalendarFixture`). No business logic reads it.                                                  |
| 3  | `trading_calendar.pre_open_start`                    | Fixture constant `09:00` for normal sessions and `NULL` for special sessions. The calendar API is not consumed by the web app.                  |
| 4  | `trading_calendar.closing_auction_start`             | Both writers set it to `session_close`. It is an exact duplicate of another column.                                                              |
| 5  | `trading_calendar.closing_auction_end`               | Fixture constant `15:40` for normal sessions and `NULL` for special sessions. Only echoed by an unused DTO.                                      |
| 6  | `corporate_actions.record_date`                      | `importCorporateActions()` hard-codes `recordDate: null`; no reader uses it.                                                                     |
| 7  | `instrument_provider_mappings.raw_payload_id`        | No insert path sets it. Only projected by `listInstrumentMappings()`; always `NULL`.                                                             |
| 8  | `job_runs.queue_name`                                | Deterministic from `job_name` via `queueNameOf()` in `packages/domain/jobs.ts`. Stored only for display and cancellation routing.                  |
| 9  | `data_quality_issues.created_at`                     | Dropped with the table in `0015_system_issues.sql`; `detected_at` duplicated the insert timestamp.                                                |
| 10 | `system_health_snapshots.created_at`                 | `captured_at` is the insert timestamp. Exact duplicate. (The table also has no active writer — see §3.)                                          |
| 11 | `market_quote_snapshots.created_at`                  | `captured_at` is the snapshot timestamp. Exact duplicate. (The table also has no active writer — see §3.)                                         |
| 12 | `broker_position_snapshots.created_at`               | `captured_at` is the snapshot timestamp. Exact duplicate.                                                                                        |
| 13 | `holdings_snapshots.created_at`                      | `captured_at` is the snapshot timestamp. Exact duplicate.                                                                                        |
| 14 | `account_equity_snapshots.created_at`                | `captured_at` is the snapshot timestamp. Exact duplicate.                                                                                        |
| 15 | `trade_costs.created_at`                             | `computed_at` is the insert timestamp (`now()`). Exact duplicate.                                                                                 |
| 16 | `risk_events.created_at`                             | `occurred_at` is the insert timestamp (`now()`). Exact duplicate.                                                                                 |
| 17 | `position_events.created_at`                         | `occurred_at` is the insert timestamp (`now()`). Exact duplicate.                                                                                 |
| 18 | `fills.exchange_timestamp`                           | The R1 plan maps the Upstox `exchange_timestamp` field to `fills.executed_at`; the second timestamp has no distinct definition.                    |

### Optional in the same group

These are written but never read. They are useful audit/lineage data, so they are **not** recommended for
removal in this pass:

- `users.last_login_at`
- `user_sessions.ip_address`, `user_sessions.user_agent`
- `audit_log.user_agent`
- `user_account_access.granted_by`
- `strategies.created_by`, `strategy_versions.created_by`
- `account_instrument_permissions.created_by`
- `raw_provider_payloads.endpoint`, `http_method`, `request_params`, `http_status`, `content_encoding`
- `providers.kind`, `providers.capabilities`, `providers.is_active`
- `exchanges.mic`, `exchanges.name`, `exchanges.timezone`, `exchanges.currency`, `exchanges.is_active`

### Dead fields with no current use case

| Table.column                                                                        | Why                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `account_instrument_permissions.max_quantity`, `max_open_quantity`, `reason`        | No risk engine exists in R2 and the API does not select them. They become meaningful only when R3 risk evaluation is built.            |
| `strategy_activations.configuration_version_id`                                     | No writer; the value duplicates the configuration in `strategy_config_bindings`. Keep until the activation workflow is implemented.     |
| `trading_sessions.configuration_version_id`, `notes`                                | No writer; neither column is selected by `listTradingSessions()`.                                                                       |
| `notification_events.sent_at`, `read_at`                                             | Never written or read. Keep if the notification delivery feature is still planned.                                                      |
| `report_runs.generated_at`, `file_ref`                                               | Never written or read. Keep if the report generator is still planned.                                                                   |

---

## 2. Derived columns (decision at implementation time)

These are not dead. They are pure functions of other columns in the same row. Removing them makes the
database the single source of truth at the cost of computing on read.

| Table.column                                                                | Derivation                                                       |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `fills.gross_amount`                                                        | `quantity × price`                                               |
| `trade_costs.total`                                                         | sum of the seven charge columns                                  |
| `positions.market_value`                                                    | `quantity × last_price`                                          |
| `positions.status`                                                          | open while `quantity <> 0`, closed when `closed_at` is set       |
| `round_trip_trades.net_pnl`                                                 | `gross_pnl − costs_total`                                        |
| `round_trip_trades.r_multiple`                                              | `net_pnl ÷ (entry_price − initial_stop) × quantity` (long)       |
| `round_trip_trades.status`                                                  | open while `exit_at` is `NULL`                                   |
| `backtest_trades.net_pnl`                                                   | `gross_pnl − costs_total`                                        |
| `backtest_trades.r_multiple`                                                | `net_pnl ÷ (entry_price − initial_stop) × quantity` (long)       |
| `daily_performance.net_pnl`                                                 | `gross_pnl − costs`                                              |
| `daily_performance.return_pct`                                              | `net_pnl ÷ opening_equity`                                       |
| `daily_performance.win_rate`                                                | `winning_trades ÷ trades_count`                                  |
| `strategy_performance_daily.net_pnl`                                        | `gross_pnl − costs`                                              |
| `strategy_performance_daily.win_rate`                                       | `winning_trades ÷ trades_count`                                  |
| `strategy_performance_daily.expectancy`                                     | `net_pnl ÷ trades_count`                                         |
| `risk_decisions.risk_amount`                                                | `account_equity × risk_percent`                                  |
| `risk_decisions.stop_distance`                                              | `abs(entry_price − stop_price)` from the signal                  |
| `reconciliations.mismatches_count`                                          | `count(*)` of `reconciliation_issues` for the reconciliation     |
| `account_equity_snapshots.net_equity`                                       | available cash + collateral + position value + unsettled profit  |
| `account_equity_snapshots.drawdown_pct`                                     | `(peak_equity − net_equity) ÷ peak_equity`                       |

**Do not remove:**

- `strategy_performance_daily.profit_factor` — needs gross profit and gross loss, which are not stored.
- `daily_performance.max_drawdown_pct` — needs the intraday equity series, not just this row.
- `holdings_snapshots.pnl`, `day_change`, `day_change_pct` — these are broker payload values (source data),
  even though they look derived.
- `orders.pending_quantity` — the R1 plan treats it as a broker-reported counter, not our computation.
- `market_candles_1m.trading_date` — derived from `candle_start` in IST, but it is the partition/pruning key.
- `instrument_data_status.expected_days`, `complete_days`, `partial_days`, `missing_days`,
  `open_critical_issues` — an intentional persisted projection ("recomputed by the worker, never on read").
- `instrument_day_coverage` — the rebuildable coverage cache by design.

---

## 3. Tables with no producer in R2

These tables are defined and some are read by the API, but nothing inserts rows. They are reserved for later
releases and should not be dropped merely to satisfy a column cleanup.

| Group                | Tables                                                                                                                    | Consumer today                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Execution / R3+      | `signals`, `risk_decisions`, `orders`, `order_events`, `fills`, `trade_costs`, `positions`, `position_events`, `broker_position_snapshots`, `holdings_snapshots`, `round_trip_trades`, `reconciliations`, `reconciliation_issues` | placeholder modules, zero rows         |
| Backtesting / R6     | `backtest_runs`, `backtest_windows`, `backtest_trades`, `backtest_equity_curve`, `backtest_metrics`, `strategy_promotion_reviews`                                                                             | placeholder module, zero rows          |
| Analytics / R6       | `daily_performance`, `strategy_performance_daily`                                                                                                                                         | none                                   |
| Operations           | `system_health_snapshots`, `notification_events`, `report_runs`                                                                                                                           | read-only endpoints, zero rows         |
| Read-only projections| `account_equity_snapshots`, `trading_sessions`, `risk_events`, `strategy_activations`, `market_quote_snapshots`                                                              | account/system pages, zero rows        |
| Eventing             | `domain_events`                                                                                                                                                                           | none                                   |

`market_quote_snapshots` is the only partitioned table in this group. The repository has
`upsertQuoteSnapshots()`, but no worker or API calls it.

---

## 4. Table-by-table list

Legend: **—** = no removal recommended.

### Platform (`platform.ts`)

| Table                           | Remove                     |
| ------------------------------- | -------------------------- |
| `users`                         | —                          |
| `user_sessions`                 | `last_seen_at`             |
| `accounts`                      | —                          |
| `user_account_access`           | —                          |
| `broker_credentials`            | —                          |
| `audit_log`                     | —                          |
| `domain_events`                 | entire table (reserved)    |
| `account_instrument_permissions`| see §1 dead fields         |

### Reference (`reference.ts`)

| Table                           | Remove                                                                     |
| ------------------------------- | -------------------------------------------------------------------------- |
| `providers`                     | — (optional write-only fields above)                                       |
| `exchanges`                     | — (optional write-only fields above)                                       |
| `instruments`                   | —                                                                          |
| `instrument_provider_mappings`  | `raw_payload_id`                                                           |
| `trading_calendar`              | `settlement_date`, `pre_open_start`, `closing_auction_start`, `closing_auction_end` |
| `corporate_actions`             | `record_date`                                                              |
| `raw_provider_payloads`         | —                                                                          |

### Market (`market.ts`)

| Table                       | Remove                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `market_candles_1m`         | —                                                                      |
| `market_quote_snapshots`    | `created_at`; whole table is reserved until live quotes are wired       |
| `instrument_day_coverage`   | —                                                                      |
| `instrument_data_status`    | —                                                                      |

### Operations (`operations.ts`)

| Table                       | Remove                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `daily_performance`         | derived columns in §2 (table reserved)                                 |
| `strategy_performance_daily`| derived columns in §2 (table reserved)                                 |
| `job_runs`                  | `queue_name`, `group_id`                                               |
| `job_run_events`            | —                                                                      |
| `system_health_snapshots`   | `created_at` (also no producer)                                        |
| `notification_events`       | — (table reserved)                                                     |
| `report_runs`               | — (table reserved)                                                     |
| `system_settings`           | —                                                                      |

### Strategy (`strategy.ts`)

| Table                       | Remove                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `strategies`                | —                                                                      |
| `strategy_versions`         | —                                                                      |
| `configuration_versions`    | —                                                                      |
| `strategy_config_bindings`  | —                                                                      |
| `strategy_activations`      | `configuration_version_id` (table reserved)                            |
| `trading_sessions`          | `configuration_version_id`, `notes` (table reserved)                   |
| `risk_events`               | `created_at` (table reserved)                                          |

### Execution (`execution.ts`)

| Table                         | Remove                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| `signals`                     | —                                                                      |
| `risk_decisions`              | derived columns in §2                                                  |
| `orders`                      | `pending_quantity` is **kept** (broker-reported); no definite removal   |
| `order_events`                | —                                                                      |
| `fills`                       | `exchange_timestamp`; `gross_amount` in §2                             |
| `trade_costs`                 | `created_at`; `total` in §2                                            |
| `positions`                   | derived columns in §2                                                  |
| `position_events`             | `created_at`                                                           |
| `broker_position_snapshots`   | `created_at`                                                           |
| `holdings_snapshots`          | `created_at` (broker `pnl`/`day_change` values stay)                   |
| `account_equity_snapshots`    | `created_at`; derived columns in §2                                    |
| `round_trip_trades`           | derived columns in §2                                                  |
| `reconciliations`             | derived columns in §2                                                  |
| `reconciliation_issues`       | —                                                                      |

### Backtesting (`backtesting.ts`)

| Table                        | Remove                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `backtest_runs`              | —                                                                      |
| `backtest_windows`           | —                                                                      |
| `backtest_trades`            | derived columns in §2                                                  |
| `backtest_equity_curve`      | —                                                                      |
| `backtest_metrics`           | —                                                                      |
| `strategy_promotion_reviews` | —                                                                      |

---

## 5. Implementation order (if the removals are approved)

1. New forward-only migration `0015_drop_redundant_columns.sql`:
   - `user_sessions.last_seen_at`
   - `trading_calendar.settlement_date`, `pre_open_start`, `closing_auction_start`, `closing_auction_end`
   - `corporate_actions.record_date`
   - `instrument_provider_mappings.raw_payload_id`
   - `job_runs.queue_name`
   - `system_health_snapshots.created_at`
   - `market_quote_snapshots.created_at`
   - `broker_position_snapshots.created_at`
   - `holdings_snapshots.created_at`
   - `account_equity_snapshots.created_at`
   - `trade_costs.created_at`
   - `risk_events.created_at`
   - `position_events.created_at`
   - `fills.exchange_timestamp`

   `DROP COLUMN` also drops the dependent checks/indexes on those columns; no table count changes.

2. Mirror the removals in the Drizzle schema files.

3. Code follow-ups:
   - `packages/database/repositories/platform.ts`: remove `lastSeenAt` and `touchSession()`.
   - `apps/api/src/modules/auth/auth.service.ts`: remove the `touchSession` import and call.
   - `packages/database/repositories/reference.ts`: drop the four calendar fields from the select, set
     `recordDate` to nothing, and stop projecting `rawPayloadId` on mappings.
   - `packages/database/repositories/jobs.ts`, `apps/api/src/modules/jobs/jobs.service.ts`,
     `apps/worker/src/observability/job-store.ts`: derive `queueName` with `queueNameOf(jobName)`.
   - `apps/api/src/modules/system-control/dto/system-response.dto.ts`: remove the four calendar fields.
   - `tests/integration/r1-database.test.ts`: stop inserting `job_runs.queue_name`.
   - `docs/operations/job-ledger.md`: remove `queue_name` from the ledger description.

4. Verify:
   - `pnpm db:migrate && pnpm db:verify` (55 tables and the view counts must not change).
   - `pnpm lint`, plus `pnpm nx run-many -t typecheck test -p database api worker web tests`.
   - No browser verification by policy.

## 6. Derived columns (same-row computations)

| #  | Table.column                                    | Derived from                                                      |
| -- | ----------------------------------------------- | ----------------------------------------------------------------- |
| 1  | `fills.gross_amount`                            | `quantity × price`                                                |
| 2  | `trade_costs.total`                             | sum of brokerage, STT, exchange, SEBI, stamp, GST, other charges  |
| 3  | `positions.market_value`                        | `quantity × last_price`                                           |
| 4  | `positions.unrealized_pnl`                      | `(last_price − average_price) × quantity`                         |
| 5  | `positions.status`                              | open while quantity is non-zero; closed when `closed_at` is set   |
| 6  | `round_trip_trades.net_pnl`                     | `gross_pnl − costs_total`                                        |
| 7  | `round_trip_trades.r_multiple`                  | `net_pnl ÷ (entry_price − initial_stop) × quantity` (long)        |
| 8  | `round_trip_trades.status`                      | open while `exit_at` is `NULL`                                    |
| 9  | `backtest_trades.net_pnl`                       | `gross_pnl − costs_total`                                        |
| 10 | `backtest_trades.r_multiple`                    | `net_pnl ÷ (entry_price − initial_stop) × quantity` (long)        |
| 11 | `daily_performance.net_pnl`                     | `gross_pnl − costs`                                               |
| 12 | `daily_performance.return_pct`                  | `net_pnl ÷ opening_equity`                                        |
| 13 | `daily_performance.win_rate`                    | `winning_trades ÷ trades_count`                                   |
| 14 | `strategy_performance_daily.net_pnl`            | `gross_pnl − costs`                                               |
| 15 | `strategy_performance_daily.win_rate`           | `winning_trades ÷ trades_count`                                   |
| 16 | `strategy_performance_daily.expectancy`         | `net_pnl ÷ trades_count`                                          |
| 17 | `risk_decisions.risk_amount`                    | `account_equity × risk_percent`                                   |
| 18 | `risk_decisions.stop_distance`                  | `abs(entry_price − stop_price)` from the signal                   |
| 19 | `reconciliations.mismatches_count`              | `count(*)` of `reconciliation_issues` for the reconciliation      |
| 20 | `account_equity_snapshots.net_equity`           | available cash + collateral + position value + unsettled profit   |
| 21 | `account_equity_snapshots.drawdown_pct`         | `(peak_equity − net_equity) ÷ peak_equity`                       |
| 22 | `market_quote_snapshots.net_change`             | `last_price − close` (same row)                                   |

`round_trip_trades.gross_pnl` and `backtest_trades.gross_pnl` are also mathematically derivable from
entry/exit/quantity/direction; they are kept as the stored trade result and are not listed as removable.

## 7. Dead fields with no future use case

These are not waiting for R3–R6. They are constant for the planned NSE/BSE cash-equity, INR, IST product
and/or have no consumer in any release:

| # | Table.column                                   | Why there is no future use                                                                                     |
| - | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1 | `accounts.timezone`                            | The business timezone is `Asia/Kolkata` for the whole system (`ui.timezone`, exchange timezone). No per-account timezone logic exists or is planned. |
| 2 | `exchanges.timezone`                           | NSE and BSE are both IST; market timezone is a system constant.                                                |
| 3 | `exchanges.currency`                           | NSE/BSE settlement is INR; there is no FX or multi-currency P&L.                                               |
| 4 | `trade_costs.currency`                         | Cost model is INR-only; the column is always `INR`.                                                            |
| 5 | `instruments.lot_size`                         | Cash equities and indices always trade in units of 1; derivatives are explicitly out of scope. It is exposed but used in no calculation. |
| 6 | `broker_position_snapshots.multiplier`         | Always 1 for cash equities; it only matters for derivatives.                                                   |
| 7 | `orders.status_message`                        | Merge into `orders.status_message_raw`; the normalized text can be derived from the raw RMS message.           |
| 8 | `users.failed_login_count`                     | Incremented on failure but never read, and no lockout policy sets `users.status = 'locked'`. Remove unless account lockout is committed. |
| 9 | `raw_provider_payloads.content_encoding`       | The payload is stored already decoded as `jsonb`, so the original content encoding is never needed for replay or retention. |
| 10| `providers.is_active`                          | No provider retirement flow reads or writes it. Keep only if provider deactivation is planned.                  |
| 11| `exchanges.is_active`                          | No exchange retirement flow reads or writes it. Keep only if venue deactivation is planned.                     |

**Conditional but probably permanent:** `exchanges.mic`, `exchanges.name`. Both are unread today. They are
standard reference labels, so keep them if the exchange master will ever be shown or exported; otherwise
they are also removable.

## 8. Decision taken

The operator chose to remove every column in the definitive, derived and no-future-use lists, plus the
previously flagged future-use and audit-snapshot columns. That scope is implemented in
`0016_drop_redundant_columns.sql` and the matching schema/repository/API/web/worker changes.

The empty reserved tables themselves are retained; only their redundant columns are dropped.
