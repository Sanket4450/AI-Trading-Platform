# Deployment order

**Status at 2026-11-24:** R1, R2 and R3 are delivered. R4–R9 are planned. See
`context/current-implementation.md` for the as-built inventory.

| Release | Deliverable                                                                                                 | Trading mode | Status |
| ------- | ----------------------------------------------------------------------------------------------------------- | ------------ | ------ |
| R1      | Application foundation, database schema, configuration management and dashboard                             | Offline      | Delivered |
| R2      | Upstox historical data ingestion and data-quality validation                                                | Research     | Delivered |
| R3      | Strategy registry and first opening-range-breakout implementation                                           | Research     | Delivered |
| R4      | Shared backtesting and simulated execution engine                                                           | Backtesting  | Not started; tables reserved |
| R5      | Live data ingestion, signal generation, risk engine and order-state management                              | Paper trading | Not started; tables reserved |
| R6      | Upstox sandbox integration tests, production authentication, static IP and applicable algo compliance setup | Testing      | Not started; `infra/azure` placeholder |
| R7      | Paper-trading validation and production-readiness gates                                                     | Paper trading | Not started |
| R8      | Controlled live deployment, monitoring and automated reconciliation                                         | Limited live trading | Not started |
| R9      | Add subsequent strategies through the existing strategy interface and repeat the same validation process    | Controlled expansion | Not started |

## What R1 actually delivered

- 16-project Nx workspace with pnpm, Oxlint and the architecture boundary check.
- 56-table PostgreSQL schema, migrations, seed and verification, including partitioned candle and
  quote tables.
- Session authentication, account/credential metadata, versioned strategy/risk/system configuration
  and the immutable audit trail.
- The original operator routes, jobs infrastructure and the worker job ledger.

## What R2 actually delivered

R2 is broader than "historical ingestion plus validation". Delivered scope:

- Read-only Upstox V3 instrument master, historical/intraday candles, holidays and timings.
- Per-instrument month-chunked backfills with a Redis-backed three-window provider budget, retry,
  backoff and cooperative cancellation.
- Strict coverage (`complete`, `partial`, `missing`) in `instrument_day_coverage`; missing minutes
  are never filled.
- A 20-rule active quality catalog feeding the current-state `system_issues` ledger.
- The instrument catalog with persisted fetch status, data status, active job linkage and a fixed
  badge precedence.
- Job ledger v2 with fixed stages, append-only events, instrument progress and Redis/Socket.IO live
  updates.
- The append-only `external_api_calls` ledger with a 90-day retention sweep.
- Operator surfaces for catalog, coverage day detail, issues, jobs, API calls, settings, provider
  state and configuration history.

R2 still has no order route and no broker write method. The API and worker accept only `offline` or
`research`.

## What R3 actually delivered

- Session-scoped strategy contract v2, a static registry and `ajv` parameter validation.
- The 15-minute ORB evaluator: opening range, five-minute rollup, VWAP, NIFTY EMA confirmation,
  same-slot volume, sizing, stop/target/EOD exits and the one-position/two-entry limits.
- `strategy_evaluation_runs` and `strategy_evaluation_results`, research signals scoped by
  `evaluation_run_id`, and migration `0021` dropping seven dead columns.
- The operator-initiated `strategy-evaluation` job with day-batched evaluation, per-day idempotency,
  cancellation between days and progress per day.
- Evaluation APIs and the `/strategies/[id]/evaluations` dashboard routes.
- R3 writes no order, fill, position or trade-cost row.

## Gate reminder

Live trading stays disabled until R6–R8. A local default must never enable `paper` or `live`, and
the future order path must pass through the independent risk engine rather than a strategy or
adapter call.
