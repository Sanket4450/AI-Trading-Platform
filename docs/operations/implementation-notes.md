# Implementation notes — monorepo setup

The plan of record is `context/monorepo-setup-plan.html`. This note records the versions and deviations that
were observed while executing it.

## Verified toolchain

| Tool              | Installed                                           |
| ----------------- | --------------------------------------------------- |
| Node.js           | 24.19.0 LTS                                         |
| pnpm              | 11.28.8                                             |
| Nx                | 22.7.12                                             |
| Next.js           | 16.4.2                                              |
| React / React DOM | 19.3.0                                              |
| NestJS            | 12.0.1                                              |
| TypeScript        | 5.9.3 (web, packages, tests) and 6.0.3 (Nest apps)  |
| Vitest            | 3.2.7 (web, packages, tests) and 4.1.12 (Nest apps) |
| PostgreSQL        | external — `DATABASE_URL` is the source of truth    |
| Redis             | Redis Stack (`redis/redis-stack`)                   |

## Deviations from the plan

1. **pnpm 11 rather than pnpm 12.** The installed Corepack-managed pnpm is 11.28.8. pnpm 11 already uses
   `allowBuilds` and stores workspace settings in `pnpm-workspace.yaml`, so the plan's configuration model is
   preserved.
2. **NestJS 12 rather than NestJS 11.** The current official Nest CLI generates Nest 12 with ESM/NodeNext,
   Vitest 4 and oxlint. The generated layout was kept; the CLI's Rust-based oxlint setup was extended to the
   entire workspace.
3. **Web build forces `NODE_ENV=production`.** Nx loads the root `.env`, which contains
   `NODE_ENV=development`. Next.js 16 fails to prerender its internal `_global-error` route when the build runs
   with `NODE_ENV=development`. The web build script is therefore `NODE_ENV=production next build`.
4. **`pnpm dev` starts the three apps, not every package watcher.** It first builds the shared packages, then runs
   `web`, `api` and `worker` in parallel. Start a package watcher separately with
   `pnpm --filter @ai-trading/<package> dev` when changing that package.
5. **The root layout keeps the shadcn tooltip provider and toaster.** They build correctly once the web build runs
   in production mode.
6. **Linting is Oxlint across the whole workspace.** All 16 projects use Oxlint 1.x, the Rust-based linter,
   with one root `.oxlintrc.json`. Nest apps use Vitest 4; web, packages and the cross-cutting test project use
   Vitest 3. Both run through Nx targets.
7. **The API runs on port 8000.** Port 4000 was already occupied in the local environment, so `API_PORT`, the
   Upstox redirect URI, Docker port mappings, Swagger/health URLs and every command reference now use `8000`.
8. **Stale dev processes are cleaned with `pnpm dev:stop`.** Interrupted `nest start --watch` or `node dist/main`
   processes can keep holding 3000/8000. `pnpm ports` shows listeners and `pnpm dev:stop` stops them.
9. **ESLint was removed in favour of Oxlint.** The previous mixed ESLint/oxlint setup is gone. Oxlint runs in every
   app, package and test project against the root config. The old Nx ESLint module-boundary rule is replaced by
   `scripts/check-boundaries.mjs`, which reads the Nx project graph and enforces the architecture contracts.

## Verification performed

```bash
pnpm lint                # oxlint across all projects + architecture boundaries
pnpm nx run-many -t typecheck test build
pnpm format:check
pnpm dev                 # web :3000, API :8000, worker
curl http://127.0.0.1:8000/api/v1/health
pnpm --filter @ai-trading/tests test:e2e
docker compose --env-file .env -f infra/docker/docker-compose.yml ps
pnpm db:generate && pnpm db:migrate
```

All 16 Nx projects pass typecheck, lint, test and build. The Playwright dashboard smoke test passes. Redis reports healthy, the external PostgreSQL is reachable through `DATABASE_URL`, and the R1 migrations are applied.

## R1 implementation notes

The plan of record is `context/r1-implementation-plan.html`. R1 is implemented end to end: schema, migrations,
seed, repositories, configuration management, API, dashboard, worker jobs and authentication.

### Database

- **56 logical tables + 1 materialized view.** The explicit M:N tables are
  `user_account_access`, `account_instrument_permissions`, `strategy_config_bindings` and
  `strategy_activations`.
- **Drizzle schema mirrors the database.** `packages/database/schema/*.ts` defines the tables, checks and simple
  indexes. `drizzle-kit generate` produces the base migration from `schema/drizzle.ts`.
- **Custom SQL is explicit.** `0001_partitioned_market.sql` creates the two partitioned tables and monthly
  partitions. `0002_foreign_keys.sql` adds every cross-table FK. `0003_indexes_constraints.sql` adds partial
  unique and BRIN indexes. `0004_immutability.sql` adds updated-at and append-only triggers.
  `0005_materialized_view.sql` creates `mv_instrument_daily_stats`. `0006_partition_maintenance.sql` adds
  partition helpers.
- **Migration runner.** `pnpm db:migrate` runs `packages/database/migrate.ts`, which applies numbered SQL files in
  order, records checksums in `schema_migrations`, and refuses to continue if an applied file changed.
- **End timestamps are nullable.** `effective_to`, `valid_to`, `deactivated_at`, `ended_at`, `closed_at`,
  `exit_at`, `finished_at` and similar columns are nullable so open-ended records do not need sentinel dates.
  Checks use `end IS NULL OR end > start`.
- **UUIDs.** Application repositories and the seed pass UUIDv7 values explicitly. The database fallback is
  `gen_random_uuid()` so raw SQL inserts still work.
- **Partition horizon.** Candle partitions cover 2022-01 through 2027-03 (63 partitions). Quote partitions cover
  2026-01 through 2027-03 (15 partitions). `ensure_market_partitions()` extends them.
- **R1 has no live orders.** The `orders` table exists for R5; R1 seeds and verifies zero rows.

### Seed

- The seed is idempotent and refuses to run without `SEED_OPERATOR_EMAIL` and `SEED_OPERATOR_PASSWORD`.
- Reference fixture: NIFTY 50 index and 50 NSE cash equities with known ISINs, all flagged
  `is_sync_target`, NSE/BSE exchanges, Upstox/simulated/CSV providers, two years of weekday calendar
  rows, the `orb-15m` strategy, parameter/risk/system configuration versions and their bindings.
- Upstox keys for the fixture are `NSE_EQ|<ISIN>` or `PENDING:<SYMBOL>` until the real instrument master is
  synced. The canonical `instruments.id` never changes.
- The seed writes one audit row per run. Reference and configuration counts remain stable.

### API and security

- **Authentication.** Argon2id password hashes, opaque 32-byte session tokens hashed with SHA-256 in
  `user_sessions`, HttpOnly session cookies, revocation and expiry. The web app stores the token in its own
  HttpOnly cookie and forwards it as a Bearer token from server components and the `/api/proxy` route handler.
- **Research-mode enforcement.** `assertResearchMode()` refuses to start the API or worker when
  `TRADING_MODE` is not `offline` or `research`. `SystemControlService.onModuleInit()` also refuses to start
  when an active account is outside those modes.
- **No order routes.** `OrdersModule`, `TradingModule`, `PositionsModule`, `RiskModule`, `BacktestsModule`,
  `ReportsModule` and `NotificationsModule` are no longer imported into the API. The tables remain for later
  releases.
- **Credentials.** `CONFIG_ENCRYPTION_KEY` drives AES-256-GCM envelope encryption. The API returns credential
  metadata only; ciphertext is never exposed.
- **API surface.** Health, auth, accounts, instruments (including coverage and fetch status),
  strategies, configuration, jobs, audit, settings (including provider state and provider-wide issues) and
  system status. See Swagger at `/api/docs`.
- **Ingestion writes.** A per-instrument fetch and a materialized-view refresh create `job_runs` and enqueue
  BullMQ jobs. R2 findings are written to the current-state `system_issues` ledger and are cleared by the
  operation that later succeeds; there is no acknowledge/resolve workflow.

### Worker

- `HistoricalDataModule` handles `historical-backfill`, `instrument-sync`, `calendar-sync` and
  `coverage-recompute`.
- `MaintenanceModule` handles `refresh-materialized-view` and `ensure-partitions`.
- Upstox is read-only. The adapter has no order, modify or cancel method.
- When `UPSTOX_API_KEY` or `UPSTOX_ACCESS_TOKEN` is empty, a provider job completes with
  `result.skipped=true` and a clear reason instead of failing the worker.
- The calendar sync uses the checked-in NSE fixture because Upstox does not expose a market-calendar endpoint.
  Replace it with a reviewed calendar source before R6.
- Scheduled jobs: instrument and calendar sync at 08:00 IST, materialized-view refresh at 16:00 IST, partition
  maintenance on the first of the month. `WORKER_SCHEDULES_ENABLED=false` disables them.

### Dashboard

- Operator routes: `/`, `/accounts`, `/accounts/[id]`, `/instruments`, `/instruments/[id]`, the coverage day
  detail, `/issues`, `/strategies`, `/strategies/[id]`, `/jobs`, `/jobs/[id]`, `/api-calls`, `/audit` and
  `/settings`. Issue details open in a dialog rather than a dedicated route.
- Server components read the API through `apps/web/src/lib/api.ts`; browser mutations call the API through
  `apps/web/src/lib/api-browser.ts` and the `/api/proxy/[...path]` route handler, so the token stays HttpOnly
  and each write appears in the browser network tab.
- `apps/web/src/proxy.ts` protects every route except login and auth callbacks. Next.js 16 replaced the
  `middleware` convention with `proxy`.
- The dashboard is dark-first, responsive at 390px, and shows the active trading mode on every screen.

### Deviations and follow-ups

1. **Migration order.** The plan's `0001_platform` depends on `providers` and `instruments` created in
   `0002_reference`. The implementation uses a dependency-correct order: generated base schema, then partitioned
   market tables, foreign keys, indexes, immutability, view and maintenance. The logical grouping is unchanged.
2. **Seed requires a password.** Per the R1 decision, the seed fails until `SEED_OPERATOR_PASSWORD` is set. It
   never prints or stores plaintext.
3. **Calendar source.** The R1 calendar is a fixture. The plan's implementation check for an authoritative
   special-session calendar remains open.
4. **Upstox status strings.** The mapping is covered by unit tests but must be confirmed against a live order book
   before R5.
5. **Net equity formula.** The R1 schema stores the inputs; the exact formula remains an R5/R6 check.
6. **Retention and KMS.** Candle retention, quote retention and key rotation ownership remain operational
   decisions before R7.
7. **Future Drizzle generation.** The R1 custom SQL uses the `0001`–`0007` range. Before running
   `drizzle-kit generate` in a later release, point it at a fresh output directory or rename the generated file to
   the next free number; do not overwrite the checked-in custom migrations. The runtime applies
   `packages/database/migrations/*.sql` in filename order.
8. **Instrument master size.** The first real sync can be large; `INSTRUMENT_SYNC_LIMIT` caps the fixture-sized
   R1 run. Raise it deliberately and monitor the transaction.

### Verification performed

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm --filter @ai-trading/tests test:integration
pnpm --filter @ai-trading/domain test
pnpm --filter @ai-trading/configuration test
pnpm --filter @ai-trading/adapters test
pnpm --filter @ai-trading/api test
pnpm --filter @ai-trading/api build
pnpm --filter @ai-trading/worker build
pnpm --filter @ai-trading/web build
```

The database verification reports 56 logical tables, 1 materialized view, 63 candle partitions, 15 quote
partitions, zero live orders and a parameters binding for every strategy version. The API smoke test covers
login, every read route, configuration create/idempotency/diff/bind, settings update and a bounded backfill. The
worker processes the backfill and records a skipped result when Upstox credentials are empty. The Playwright
suite is a single desktop dashboard smoke test with no page or server errors.

### Infrastructure layout

- `infra/docker/docker-compose.yml` starts Redis Stack only. PostgreSQL is external and configured solely
  through `DATABASE_URL` in the workspace `.env`. RedisInsight is available at http://localhost:8001.
- `infra/docker/docker-compose.apps.yml` composes the API, worker and web containers against that external
  database and the Compose Redis service.
- `.dockerignore` remains at the repository root because Docker only reads it from the build context root; the
  Dockerfiles still use the repository root as their build context.

## R2 implementation notes

The plan of record is `context/r2-implementation-plan.html`. R2 adds historical ingestion, strict
coverage, the instrument catalog and the quality workflow without changing the modular monolith or the
R1 lifecycle tables.

### Database

- **60 logical tables at the end of 0008.** `0008_r2_ingestion_quality.sql` adds gap fields to
  `market_data_coverage`, dedupe and lifecycle fields to `data_quality_issues` (replaced by
  `system_issues` in 0015), a unique raw-payload key and `instrument_data_status`.
- The migration is additive. It preflights duplicate raw payloads before creating the unique index and
  preserves legacy resolved/ignored issues with an explicit migration note.
- The seed flags the 51 reference instruments as `is_sync_target`, creates one status row per target,
  a 2022–2027 NSE calendar, corrected tick sizes and a research-mode account/system setting.
- `0009_process_tracking.sql` added the first job stage columns and the append-only
  `job_run_events` stream behind `/jobs`.
- `0010_drop_universes.sql` replaces versioned instrument universes and strategy membership rows with
  `instruments.is_sync_target`.
- `0011_drop_daily_validation.sql` removes the daily-oracle validation feature: the
  `market_data_daily_validation` table, the coverage comparison columns and the `partial_reconciled`
  data status.
- `0012_drop_ingestion_runs.sql` removes the per-chunk `market_data_ingestion_runs` ledger.
- `0014_job_ledger_v2.sql` rebuilds `job_runs` and `job_run_events` as the current ledger: one row per
  BullMQ job, typed `instrument_id`, structured `error`, six event columns (`stage`, `type`,
  `occurred_at`, `data`) and a `latest_event_id` pointer. The old ledger is discarded by design.
  At this point the database has 55 logical tables; `0018_external_api_calls.sql` adds the 56th.
- `0015_system_issues.sql` drops `data_quality_issues` and creates `system_issues`, a current-state
  ledger with `source`, `kind`, `severity`, provider/instrument scope, a unique `dedupe_key`,
  occurrence counters and a mechanism-owned `payload`. Resolved rows are deleted, not stored.
- `0016_drop_redundant_columns.sql` removes the columns listed in
  `docs/operations/schema-column-audit.md`: duplicate timestamps, cash/INR/IST constants,
  same-row calculations and unused reserved-feature fields. The `positions` open-position guard
  moves from the derived `status` to `closed_at IS NULL`. No logical table is dropped.
- `0018_external_api_calls.sql` adds `external_api_calls`, the append-only ledger of every outbound
  network request: one row per attempt with service, operation, instrument, latency, status,
  classified outcome, the three-bucket `request_scope` and a capped error body. Successful
  response bodies are never stored — the payload tables already own them. The maintenance job
  deletes rows older than 90 days, so the ledger stays a debugging surface rather than an archive.
- `0019_drop_job_runs_group_id.sql` drops `job_runs.group_id`, which was written once per fetch as a
  fresh UUID and never read by a query, rollup or cancellation. The partial index on the column
  drops with it.
- `pnpm db:verify` asserts 56 tables, the R2 tables and indexes, 51 sync targets, 51 status rows,
  51 primary mappings, valid tick sizes, calendar coverage and zero orders.

### Provider and pipeline

- `packages/adapters` owns the read-only V3 historical, intraday, holidays and timings calls,
  error classification and the rate-limiter interface. It still has no order method.
- `packages/market-data` owns tuple normalization, IST/UTC conversion, session windows, strict
  coverage, gap runs, the 20-rule active catalog, dedupe keys and catalog status precedence.
- The worker runs one job per instrument, iterates month chunks inside that job, and records one
  `progress` event per chunk on the job timeline. It also runs a Redis-backed three-window provider budget,
  retry/backoff and cooperative cancellation.

### API and dashboard

- The catalog-first surface adds instrument coverage status, per-instrument fetch/cancel/recompute,
  coverage day detail and the current-state issue ledger. Jobs expose instrument children and progress;
  settings expose provider state and provider-wide issues. Every mutation records an audit row.
- A broker-contract test asserts that the API does not import order, position or trading modules, that
  the Upstox adapter has no order method and that the placeholder order controller has no route.
- Reference sync and corporate-action import require the global `admin` user role.
- The dashboard adds `/instruments/[id]`, its coverage day detail, issue dialogs on the instrument and
  settings pages, and the instrument table inside `/jobs/[id]`. Job views patch from the Socket.IO event
  stream and refetch on reconnect instead of polling.

### Open checks

The 18 checks in the R2 appendix remain open until a live token is available. The most important are:
first/last bar labeling, response ordering, zero-volume index behavior, daily-versus-minute volume
tolerance, 2022–2026 special-session windows, tick-size history, `Retry-After` behavior, BOD refresh
time and the NIFTY index identity test. The checked-in fixtures are provisional where marked.

### Verification performed

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm nx run-many -t typecheck -p api web worker tests
pnpm nx run-many -t test -p domain configuration market-data adapters api worker web
```

The external PostgreSQL migration 0008 applied successfully, the R2 seed completed and `db:verify`
reported the R2 tables, 1 materialized view, 63 candle partitions, 15 quote partitions, 51 sync targets
with status rows and primary mappings, 2191 calendar days and zero orders. The subsequent
`0010_drop_universes.sql`, `0011_drop_daily_validation.sql` and `0012_drop_ingestion_runs.sql`
migrations leave 55 logical tables; `0018_external_api_calls.sql` brings the current count to 56.

### Live read-only checks (2026-10-27)

A live, read-only Upstox smoke test was run with the operator token. No order endpoint was called.

| Check             | Result                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Instrument master | 82,291 rows. RELIANCE tick 10 paise, HDFCBANK 5, MARUTI 100; NIFTY 50 index has no tick.                   |
| Tick transform    | The paise-to-rupee transform produces 0.1000, 0.0500 and 1.0000 as required.                               |
| Historical order  | January 2022 RELIANCE returned 7,500 minute bars in descending order. Sorting is required.                 |
| Bar labeling      | After sorting, the first bar is 09:15 and the last is 15:29; 15:30 is excluded.                            |
| Daily oracle      | 20 daily rows. Minute volume was 1.0583% below daily volume for the month. (Feature removed in 0011.)      |
| Holidays          | The current-year endpoint returned 22 rows and revealed that the provisional 2026 fixture had wrong dates. |
| Timings           | NSE on 2026-10-23 was 09:15–15:30 IST; the 2026 Muhurat session is 14:20–15:30 IST.                        |

Consequences:

- The provisional 2026 holiday fixture was replaced with the live list. Settlement holidays where NSE
  remains open are not treated as market holidays.
- Special sessions can fall on a weekend. The calendar now treats a reviewed special session as a
  trading day even when the weekday is Saturday or Sunday. 2026-02-01 is a normal 09:15–15:30 Budget
  Day session and 2026-11-08 is the 14:20–15:30 Muhurat session.
- The daily-versus-minute volume tolerance default was provisionally 2% (`0.02`), not the plan's
  0.5%, because the observed RELIANCE January 2022 difference was 1.0583%. Open check #4 is closed by
  removal: `0011_drop_daily_validation.sql` drops the oracle and leaves strict coverage only.
- A full backfill was **not** started. The plan's stop condition applied at the time; the daily-oracle
  feature was later removed, so completeness now rests on strict coverage alone.
- `0013_instrument_day_coverage.sql` replaces `market_data_coverage` with `instrument_day_coverage`:
  `instrument_id`, `trading_date`, `expected_bars`, `stored_bars`, `checked_at`. The verdict, gap
  metrics and evidence blob were dropped because they are derived; `not_applicable` rows were dropped
  because the calendar and listing window already express that. The table is a rebuildable cache,
  refilled by the `coverage-rebuild` job (`POST /system/coverage/rebuild`) or the nightly
  `coverage-recompute`.

### Calendar correction (2026-11-26)

The NSE fixture was corrected against `/v2/market/timings` and the V3 candle counts for RELIANCE:

- `2024-01-22`, `2024-05-20` and `2024-11-20` are NSE closures and no longer expect bars.
- The `2024-11-01` Muhurat session is `18:00-19:00` IST and `2025-10-21` is `13:45-14:45` IST.
- `2023-11-12` (Sunday, `18:15-19:15`) and `2024-05-18` (Saturday, `09:15-10:00` and `11:30-12:30`) are special sessions.
- `trading_calendar.session_breaks` records the `2024-05-18` `10:00-11:30` suspension, so break minutes are not expected bars.
- `calendar-sync` now prunes coverage rows and coverage-owned issues for dates that stop being trading days, then refreshes instrument statuses.

Provider 1-minute gaps (70 bars across six days) remain unchanged and are not filled or synthesized.

## R3 — strategy registry and opening-range breakout (2026-11-24)

### Delivered

- Session-scoped strategy contract v2 in `packages/trading-engine`; supporting data types, reason
  codes, runtime statuses and the shared ORB parameter schema/defaults in `packages/domain`.
- Pure indicator math (five-minute rollup, cumulative VWAP, seeded EMA, median, direction-aware
  tick rounding) and the deterministic ORB session evaluator in `packages/strategies`.
- Static registry keyed by `strategies.code`, `code_ref` parsing, deep schema equality and `ajv`
  parameter validation.
- Migrations `0020_r3_strategy_evaluation.sql` and `0021_r3_drop_dead_columns.sql`; 58 logical
  tables and one materialized view.
- `orb-15m` version 2 (`opening-range-breakout@1.0.0`) with the shared schema and bindings to the
  existing parameter, risk and system configuration versions. Version 1 remains `validated`.
- `strategy-evaluation` job, worker processor and module registration, day-batched evaluation,
  per-day delete/insert idempotency, cancellation between days and progress per day.
- API create/list/detail/results/signals/cancel routes with admin-only mutation, pinned configs,
  universe snapshot, active-run `409`, queue rollback and audit actions
  `strategy.evaluation_run.created` / `.cancelled`.
- Runtime status on `GET /strategies` and `GET /strategies/:id`, plus the `/strategies/[id]/evaluations`
  and run-detail dashboard routes.

### Decisions and deviations

- The shared ORB schema includes the seeded `strategy` key and the documented optional parameters so
  the immutable configuration v1 remains valid without being rewritten.
- `signal_at` is the bar close; `candle_start` is the bar start.
- R3 enforces the plan's one-open-position session book even if a config says more. Values above one
  are not implemented in this release.
- The evaluator treats any incomplete decision bar as `decision_bar_incomplete` for the day and any
  missing index decision bar as `index_data_gap`; both are visible skipped results, never filled.
- Volume history and NIFTY EMA history are loaded from prior complete sessions/day-batched; the
  worker never holds a year of candles in memory.
- No browser verification was performed by policy. Verification is lint, typecheck, unit,
  broker-contract and testcontainers integration tests plus `db:verify`.

### Open checks

1. NIFTY 50 index coverage for the evaluation range. The gate remains open until a reviewed backfill
   report includes the index; otherwise a real run records `index_*` reasons.
2. Corporate-action import completeness for the selected universe.
3. Historical tick-size changes inside a range are not reconstructed.
4. The below-VWAP rule is only reachable after an earlier decision bar raises cumulative VWAP above
   a later bar that still closes above the opening-range high.
5. Costs, slippage, fills, equity curve and metrics remain R4.
