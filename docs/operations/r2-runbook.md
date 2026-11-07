# R2 operations runbook

R2 turns the R1 cockpit into a research data platform. It ingests Upstox V3 1-minute history,
proves completeness with strict coverage and a daily OHLCV oracle, and still cannot place an order.

## Prerequisites

- Node.js 24, pnpm 11.28.8.
- PostgreSQL 17+ reachable through `DATABASE_URL`.
- Redis Stack for BullMQ and the global provider budget.
- `TRADING_MODE=research` or `offline`. `backtesting`, `paper` and `live` are refused at startup.
- `CONFIG_ENCRYPTION_KEY` for credential storage.
- Optional `UPSTOX_API_KEY` and `UPSTOX_ACCESS_TOKEN` for live ingestion. Without them provider jobs
  complete as `succeeded` with `result.skipped=true`.

## First setup

```bash
pnpm install
cp .env.example .env
# Set DATABASE_URL, SEED_OPERATOR_EMAIL, SEED_OPERATOR_PASSWORD, CONFIG_ENCRYPTION_KEY.
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm db:verify
```

`pnpm db:seed` creates the `nifty-50` universe with 51 ranked members, a 2022–2027 NSE calendar
fixture, corrected tick sizes and one `instrument_data_status` row per member. The fixture is
provisional where marked; reconcile it with NSE circulars before relying on it for promotion.

## Daily operation

| IST time | Days         | Job                         | Purpose                                                        |
| -------- | ------------ | --------------------------- | -------------------------------------------------------------- |
| 08:00    | Mon–Fri      | `instrument-sync`           | Refresh the BOD master, mappings and tick sizes.               |
| 08:05    | Mon–Fri      | `calendar-sync`             | Reconcile the current year with Upstox holidays and timings.   |
| 08:15    | Mon–Fri      | `historical-finalize`       | Replace the previous session's partial bar with final history. |
| 08:30    | Mon–Fri      | `ingestion-reconcile`       | Mark stale running chunks failed and surface them.             |
| 16:00    | Mon–Fri      | `intraday-sync`             | Capture the current session; the last bar stays non-final.     |
| 16:15    | Mon–Fri      | `coverage-recompute`        | Recompute strict coverage and project instrument status.       |
| 16:30    | Mon–Fri      | `quality-scan`              | Scan the last 10 trading days.                                 |
| 17:00    | Mon–Fri      | `daily-validation`          | Fetch daily candles and compare with the minute aggregate.     |
| 18:00    | Mon–Fri      | `refresh-materialized-view` | Rebuild the daily projection once.                             |
| 09:00    | Saturday     | `quality-scan` (full)       | Full integrity scan.                                           |
| 08:00    | 1st of month | `ensure-partitions`         | Create future candle and quote partitions.                     |

Every market-data schedule checks the reviewed calendar first. `WORKER_SCHEDULES_ENABLED=false`
disables all schedules for maintenance.

## Token procedure

1. Generate the access token in the Upstox developer portal.
2. Put it in `.env` as `UPSTOX_ACCESS_TOKEN`. Never commit `.env`.
3. Restart the worker so the new environment is loaded.
4. Retry failed chunks from the backfill detail page. Completed chunks are skipped.
5. A 401 fails fast with a token message; the system does not retry a token storm.
6. A 429 pauses the global Redis budget, honours `Retry-After` and retries with jitter.

R2 does not store the token in `broker_credentials`; that remains an R6 concern.

## Initial backfill

The catalog is the entry point.

1. Open `/instruments`.
2. Select one row or a set, choose `missing only`, and press **Preview**.
3. Confirm the resolved instrument count, blocked mappings, sessions, requests and skipped months.
4. Press **Confirm and launch**. A second request for an active instrument returns the existing run.
5. Watch rows move through Queued, Fetching, Verifying and then their data status.
6. Open `/data` for the heatmap, plans, runs and issues.
7. Export or record the acceptance evidence from the backfill detail page.

The first full run is roughly 2,958 monthly requests for 51 instruments. The provider budget, not
network latency, dominates: at 1,600 requests per 30 minutes the floor is about 45 minutes.

## Resume and recovery

- **Worker killed mid-backfill**: run `ingestion-reconcile` from the scheduler or the data console.
  Runs older than 15 minutes are marked failed; launch a new missing-month fetch from the catalog.
  Completed chunks are skipped.
- **Redis unavailable**: queue and limiter fail. Start Redis, restart the worker and retry queued or
  failed jobs. No database state is lost.
- **Database unavailable**: restore PostgreSQL and restart the worker. In-flight batches roll back;
  resume from the chunk ledger.
- **Provider schema change**: stop the plan, keep the raw payload, update the contract fixture and
  parser, then replay from raw.
- **Bad calendar fixture**: correct the reviewed fixture in a new migration or seed change, rerun
  calendar sync and coverage. Do not edit historical rows blindly.
- **Unexpected corporate action**: import the reviewed action, confirm the factors, rerun validation
  and the backtest preflight.

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:verify
```

`pnpm db:verify` expects 61 logical tables, the R2 tables and indexes, 51 nifty-50 members with status
rows and primary mappings, a 2022–2027 calendar, valid tick sizes and zero orders.

The daily-versus-minute volume tolerance defaults to 2% (`0.02`) provisionally. A live RELIANCE
January 2022 check measured a 1.0583% difference, likely from closing-auction or non-minute volume in
the daily candle. Resolve the exact treatment before the full backfill.

The integration suite uses testcontainers PostgreSQL and a fixture provider. It never needs a live
Upstox token.
