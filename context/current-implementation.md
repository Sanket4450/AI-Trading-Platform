# Current implementation state (as built)

**Snapshot:** 2026-11-23. This file records what the repository actually implements, not what an
earlier plan proposed. The HTML files in `context/` are the original design records; where they
conflict with this file, the code and this file win.

R1 (foundation), R2 (research data platform) and R3 (strategy registry and ORB) are delivered.
R4–R9 are not implemented beyond placeholder packages and reserved tables.

## Release status

| Release | Scope                                                    | Status      |
| ------- | -------------------------------------------------------- | ----------- |
| R1      | Foundation, schema, auth, configuration, dashboard, jobs | Delivered   |
| R2      | Upstox historical ingestion, coverage, catalog, quality  | Delivered   |
| R3      | Strategy registry and opening-range-breakout             | Delivered   |
| R4      | Backtesting and simulated execution                      | Not started |
| R5      | Live ingestion, signals, risk and order state            | Not started |
| R6      | Sandbox, production auth, static IP and compliance       | Not started |
| R7      | Paper-trading validation and readiness gates             | Not started |
| R8      | Controlled live deployment and reconciliation            | Not started |
| R9      | Additional strategies                                    | Not started |

R2 is a research capability. The API and worker accept only `offline` or `research`; `backtesting`,
`paper` and `live` are refused at startup. There is no order route, no broker write method and no
live market-data processor.

## Workspace and toolchain

- 16 Nx projects: `apps/web`, `apps/api`, `apps/worker`, 12 `packages/*`, and `tests`.
- Node.js 24, pnpm 11.28.8, Nx 22.7.12.
- Next.js 16.4 with React 19 and Tailwind 4; NestJS 12 for both API and worker.
- TypeScript 5.9 for web, packages and tests; TypeScript 6.0 for the Nest apps.
- Vitest 3 for web, packages and tests; Vitest 4 for the Nest apps; Playwright for the e2e smoke test.
- Oxlint across every project, plus `scripts/check-boundaries.mjs` for the Nx dependency contracts.
- Shared packages build with `tsup` to `dist/`; apps consume built output, not package source.

## Runtime topology

| Process | Port / transport | Responsibility |
| ------- | ---------------- | -------------- |
| `apps/web` | `:3000` | Next.js dashboard, login, `/api/proxy` route handler, `/jobs` socket client |
| `apps/api` | `:8000`, base `/api/v1` | Session auth, read APIs, command validation, job enqueue, Swagger at `/api/docs` |
| `apps/worker` | Redis consumers + schedules | Historical ingestion, coverage, quality, reconciliation, maintenance |
| PostgreSQL | external `DATABASE_URL` | Durable source of truth; PostgreSQL 17+ |
| Redis Stack | `:6379` (`pnpm docker:up`) | BullMQ queues, provider budget, job-event pub/sub, RedisInsight on `:8001` |

`apps/web` is the only browser surface and never touches PostgreSQL. The API coordinates work and
the worker owns ingestion and maintenance.

## Dashboard routes

Operator routes in `apps/web/src/app/(dashboard)`:

- `/` — overview, health, coverage and recent activity.
- `/accounts`, `/accounts/[id]` — accounts, permissions, credentials, equity and sessions.
- `/instruments`, `/instruments/[id]`, `/instruments/[id]/coverage/[date]` — catalog, drill-down,
  month grid and coverage day detail. Instrument issues open in a dialog on the detail page.
- `/issues` — active `system_issues`; the detail view is a dialog, not a route.
- `/jobs`, `/jobs/[id]` — run ledger, stage rail, event timeline, instrument progress and the
  external API call table.
- `/api-calls` — provider-wide call ledger with filters and keyset pagination.
- `/audit` — immutable operator audit trail.
- `/settings` — runtime settings, provider state, configuration versions and provider-wide issues.
- `/strategies`, `/strategies/[id]` — strategy versions, parameter bindings, effective config and
  runtime registry status.
- `/strategies/[id]/evaluations`, `/strategies/[id]/evaluations/[runId]` — research evaluation runs,
  signal review and the instrument-day explainability ledger.
- `/login` and `/service-unavailable` are the only unauthenticated pages.

`apps/web/src/proxy.ts` protects every route except login and auth callbacks (Next.js 16 replaced
`middleware` with `proxy`). Browser mutations go through `lib/api-browser.ts` and
`/api/proxy/[...path]`, so the session token stays HttpOnly.

## API surface

Every API route is under `/api/v1`. All routes require a session except `GET /health` and
`POST /auth/login`. Swagger UI is served at `/api/docs` outside the versioned API. Active controllers:

- `health` — database/Redis liveness and readiness.
- `auth` — login, logout, current session.
- `accounts` — list, summary, detail, permissions, credentials, access, equity, sessions, credential
  rotation.
- `instruments` — search, detail, provider mappings, corporate actions, candles, corporate-action
  import.
- `instruments` (catalog) — fetch/data status, status summary, per-instrument issues, coverage
  detail, coverage day, day issues, coverage recompute, fetch preview/launch, fetch cancel.
- `strategies` — list, summary, detail, versions, effective config, create version, evaluation run
  create/list/detail/results/signals/cancel, strategy-wide signals and signal detail. Runtime status
  resolves through `@ai-trading/strategies`.
- `configuration` — list, summary, detail, diff, create, bind.
- `jobs` — list, summary, detail, events, api calls, cancel.
- `issues` — list, summary, detail.
- `api-calls` — cross-run provider call ledger.
- `audit` — list, summary, detail.
- `settings` — list and update runtime settings; provider status; instrument sync, calendar sync and
  daily-stat refresh commands.
- `system` — status, overview, jobs, coverage rebuild, ingestion reconcile, health snapshots,
  notifications, reports, trading calendar, risk events, sessions.

The `admin` user role is required for corporate-action import, instrument-master sync,
trading-calendar sync, coverage rebuild, ingestion reconcile, evaluation-run create and cancel.
Other reads and the instrument fetch/cancel commands require a valid session but no specific role.

`orders`, `positions`, `trading`, `risk`, `backtests`, `reports`, `notifications` and `market-data`
have placeholder controllers with no routes, and their Nest modules are not imported into
`AppModule`. The reserved tables exist for later releases.

## Worker jobs

Job definitions are the single source of truth in `packages/domain/jobs.ts`.

| Job | Queue | Main stages |
| --- | ----- | ----------- |
| `instrument-sync` | `historical-data` | fetch, normalize, persist, finalize |
| `calendar-sync` | `historical-data` | fixture, reconcile, finalize |
| `historical-backfill` | `historical-data` | prepare, chunks, finalize |
| `historical-finalize` | `historical-data` | prepare, repair, refresh |
| `intraday-sync` | `historical-data` | prepare, instruments, finalize |
| `coverage-recompute` | `historical-data` | prepare, instruments, finalize |
| `coverage-rebuild` | `historical-data` | clear, instruments, finalize |
| `quality-scan` | `historical-data` | scan, stale, finalize |
| `ingestion-reconcile` | `historical-data` | sweep, issues, finalize |
| `refresh-materialized-view` | `maintenance` | refresh |
| `ensure-partitions` | `maintenance` | ensure |
| `strategy-evaluation` | `strategy-evaluation` | prepare, evaluate, finalize |

Schedules run in `Asia/Kolkata` (`apps/worker/src/schedulers/market.scheduler.ts`):

| IST time | Days | Job |
| -------- | ---- | --- |
| 08:00 | Mon–Fri | `instrument-sync` |
| 08:05 | Mon–Fri | `calendar-sync` |
| 08:15 | Mon–Fri | `historical-finalize` (trading days only) |
| 08:30 | Mon–Fri | `ingestion-reconcile` |
| 16:00 | Mon–Fri | `intraday-sync` (trading days only) |
| 16:15 | Mon–Fri | `coverage-recompute` (trading days only) |
| 16:30 | Mon–Fri | `quality-scan` for the last 10 days (trading days only) |
| 18:00 | Mon–Fri | `refresh-materialized-view` |
| 09:00 | Saturday | full `quality-scan` |
| 08:00 | 1st of month | `ensure-partitions` and API-call retention purge |

`WORKER_SCHEDULES_ENABLED=false` disables every schedule. Only `historical-data`, `maintenance` and
`strategy-evaluation` processors are registered; the remaining worker folders are placeholders.
`strategy-evaluation` is operator-initiated and unscheduled, with concurrency 1.

## Data model

- 58 logical tables and one materialized view (`mv_instrument_daily_stats`).
- Migrations `0000`–`0021`. `0001`–`0021` are hand-written SQL; the runner records SHA-256
  checksums and refuses to run an edited applied migration.
- Candle partitions cover 2022-01 through 2027-03 (63 partitions). Quote partitions cover 2026-01
  through 2027-03 (15 partitions). `ensure_market_partitions()` extends them.
- `market_candles_1m` and `market_quote_snapshots` are partitioned. `instrument_day_coverage` and
  `instrument_data_status` are the rebuildable R2 caches.
- `job_runs` is one row per BullMQ job and `job_run_events` is the append-only timeline.
- `external_api_calls` is the append-only outbound-call ledger; successful bodies are never stored
  and rows older than 90 days are purged by `ensure-partitions`.
- `system_issues` is a current-state ledger: one active problem per row, cleared by the operation
  that later succeeds. There is no status history.
- `strategy_evaluation_runs` and `strategy_evaluation_results` are the R3 research run ledger and
  per-instrument-day explainability surface. `signals` stores research rows scoped by
  `evaluation_run_id`; the live scope (`trading_session_id`) remains reserved for R5.
- Reserved R4–R8 tables (`backtest_*`, `risk_decisions`, `orders`, `order_events`, `fills`,
  `positions`, `trade_costs`, `round_trip_trades`, reconciliations, promotion reviews) exist and are
  empty or unused.

### Migration history

| Migration | Effect |
| --------- | ------ |
| `0000_r1_schema` | Generated base R1 schema. |
| `0001_partitioned_market` | Partitioned candle and quote tables plus monthly partitions. |
| `0002_foreign_keys` | Cross-table foreign keys. |
| `0003_indexes_constraints` | Partial unique and BRIN indexes, extra checks. |
| `0004_immutability` | Updated-at and append-only triggers. |
| `0005_materialized_view` | `mv_instrument_daily_stats`. |
| `0006_partition_maintenance` | Partition helper functions. |
| `0007_drop_legacy` | Removes superseded R1 objects. |
| `0008_r2_ingestion_quality` | Gap fields, raw-payload uniqueness, `instrument_data_status`. |
| `0009_process_tracking` | Job stage columns and `job_run_events`. |
| `0010_drop_universes` | Replaced instrument universes with `instruments.is_sync_target`. |
| `0011_drop_daily_validation` | Removed the daily-oracle validation feature. |
| `0012_drop_ingestion_runs` | Removed the per-chunk ingestion-run ledger. |
| `0013_instrument_day_coverage` | Replaced `market_data_coverage` with `instrument_day_coverage`. |
| `0014_job_ledger_v2` | Rebuilt `job_runs`/`job_run_events` as the current ledger. |
| `0015_system_issues` | Replaced `data_quality_issues` with `system_issues`. |
| `0016_drop_redundant_columns` | Removed duplicate, constant, derived and unused columns. |
| `0017_pagination_indexes` | Composite keyset indexes for the operator lists. |
| `0018_external_api_calls` | Added the outbound provider-call ledger. |
| `0019_drop_job_runs_group_id` | Dropped the unused `job_runs.group_id`. |
| `0020_r3_strategy_evaluation` | Added evaluation runs/results, research signal scope and the `strategy-evaluation` job/stage checks. |
| `0021_r3_drop_dead_columns` | Dropped seven columns with no producer, consumer or planned owner. |

The seed creates the admin operator, one Upstox account, NSE/BSE exchanges, 51 sync targets (the
NIFTY 50 index and 50 cash equities), primary Upstox mappings, a 2022–2027 reviewed calendar
fixture, `orb-15m` strategy versions 1 and 2 with parameter/risk/system configuration versions and
their bindings, and one `instrument_data_status` row per target. Version 2 points at
`opening-range-breakout@1.0.0`; version 1 remains `validated`.

## Ingestion and data quality

- `packages/adapters` owns the read-only Upstox V3 calls: instrument master, historical and
  intraday candles, holidays and timings. It classifies errors into request, auth, permission,
  reference, contract, throttle and transient classes. There is no order, modify or cancel method.
- `packages/market-data` owns tuple normalization, IST/UTC conversion, session windows, strict
  coverage, gap runs, quality-rule definitions, dedupe keys and catalog status precedence.
- One BullMQ job runs per instrument. The job iterates month chunks inside itself and records one
  progress event per chunk. Refresh defaults to `missing_only`; `force` requires a reason.
- A Redis-backed limiter enforces the provider budget across every worker process (40/second,
  400/minute, 1,600/30 minutes by default), honors `Retry-After`, backs off with jitter and
  supports cooperative cancellation.
- A successful HTTP fetch is never treated as complete. Only strict coverage (`complete`,
  `partial`, `missing`) can claim completeness, and a missing minute is never filled with a flat
  bar.
- The active quality catalog has 21 rule definitions in `packages/market-data/quality.ts`:
  `DQ-001`–`DQ-011`, `DQ-015`, `DQ-017`, `DQ-019`–`DQ-021`, and `DQ-023`–`DQ-027`. IDs `012`,
  `013`, `014`, `016`, `018` and `022` are retired gaps; the earlier "22-rule" description is
  stale.
- Findings are written to `system_issues` and cleared when the operation succeeds. A critical
  instrument-day issue blocks the future R4 backtest preflight.

### Catalog projections

`instrument_data_status` carries a fetch status (`not_requested`, `queued`, `fetching`, `fetched`,
`partial`, `failed`, `cancelled`, `stale`) and a data status (`complete`, `partial_mismatch`,
`missing`, `pending`, `not_applicable`, `needs_review`). The UI shows one badge in a fixed
precedence, and `succeeded` is not `complete`. The catalog is a read model over stored evidence and
is never computed on read.

## Job observability

- `job_runs` and `job_run_events` are written by the worker's `JobTrackingService`.
- The worker publishes ledger facts to the Redis channel `ai-trading:job-events`.
- The API's Socket.IO gateway (`/jobs`) authenticates the session cookie and forwards broadcasts.
- `/jobs` and `/jobs/[id]` patch the server-rendered rows from that stream and refetch on reconnect;
  the HTTP response remains authoritative on first render.
- Every outbound provider attempt is recorded in `external_api_calls` and broadcast to the job
  detail page. Failed calls keep a capped error body; successful bodies are not stored.

## Authentication and configuration

- Argon2id password hashes and opaque 32-byte session tokens hashed with SHA-256 in
  `user_sessions`.
- HttpOnly session cookie for the dashboard; the same opaque token is accepted as a Bearer token.
- Session expiry defaults to 12 hours (`SESSION_TTL_HOURS`).
- `CONFIG_ENCRYPTION_KEY` drives AES-256-GCM credential encryption. The API returns credential
  metadata only, never ciphertext.
- Versioned configuration: `configuration_versions` plus `strategy_config_bindings`; a strategy
  version must have a `parameters` binding.
- `TRADING_MODE` defaults to `offline`; the R2 example uses `research`. `assertResearchMode()`
  runs at API and worker startup, and the API also refuses when an active account is outside the
  accepted modes.
- `JWT_SECRET` and `JWT_EXPIRES_IN` exist for compatibility but sessions do not use JWTs.

## Verification and tests

- `pnpm lint` runs Oxlint across all projects and `scripts/check-boundaries.mjs`.
- `pnpm db:verify` expects 58 logical tables, one materialized view, at least 63 candle partitions,
  at least 15 quote partitions, 51 sync targets with status rows and primary mappings, 2191
  calendar days in 2022–2027, valid tick sizes, the evaluation tables/indexes, the seven dropped
  columns absent, `orb-15m` version 2 bound, exactly one NIFTY 50 index and zero live orders.
- Integration tests start `postgres:17-alpine` through testcontainers and run migrations plus the
  seed.
- Broker-contract tests assert that the API does not import order, position or trading modules, that
  the Upstox adapter has no order method, and that placeholder order controllers have no routes.
- The Playwright suite is a single dashboard smoke test until a later release asks for more.

## Known open items

- The reviewed NSE calendar remains a fixture; replace it with an authoritative source before R6.
- The 18 live-token checks in the R2 appendix are still open until a production-like Upstox token
  is available.
- Production Azure hosting, static IP, managed Redis and KMS-backed key rotation are R6/R8 work.
- Metrics, alerting, retention policy for candles/quotes and the net-equity formula are not
  implemented.
- R3 delivers a session-scoped strategy contract, a static registry, the pure ORB evaluator, the
  research evaluation job and the evaluation dashboard. R4–R9 remain unimplemented.
- The R3 real-data gate is open: a real evaluation needs complete NIFTY 50 index coverage for the
  chosen range. The synthetic testcontainers proof covers the persistence path; a real run records
  `index_*` reasons when the index is incomplete.
- Provider gaps are repaired, classified and excluded, never filled. `historical-finalize` sweeps
  short days (monthly full-history sweep plus `POST /system/gaps/repair`); repeated identical
  refetches raise `provider_gap`. R3 gates on the bars it reads: a hole inside the decision window
  skips the instrument-day, a hole only in the exit window withholds the entry with
  `exit_window_incomplete`, and a short index decision window skips the day.

## Where to read more

- `docs/operations/implementation-notes.md` — implementation history and deviations.
- `docs/operations/r2-runbook.md` — token, backfill, resume and recovery procedure.
- `docs/operations/job-ledger.md` — job and event contract.
- `docs/operations/system-issues.md` — issue ledger and clear-on-success rules.
- `docs/operations/catalog-status.md` — fetch/data status precedence.
- `docs/operations/schema-column-audit.md` — column-level cleanup record.
- `docs/architecture/README.md` and `docs/architecture/adr-0001-pnpm-nx-monorepo.md` — boundaries
  and the monorepo decision.
