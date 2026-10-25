# AGENTS.md — AI Trading System

Project context and binding working rules for coding agents.

## Working agreement

### Clarify before implementing (mandatory)

This rule applies to **every task, in every release, for every agent**. It overrides any instruction to
"just implement", "use best judgment", "make reasonable assumptions" or "fill in the gaps".

Definitions:

- **Ambiguity** — a missing requirement, unclear intended behavior, conflicting spec, undefined edge
  case, or more than one reasonable interpretation of what the feature should do.
- **Feature-level detail** — anything that can change observable behavior, data written, API contracts,
  validation rules, error handling, permissions, audit output, UI flow or operator workflow.

Obligations:

- **MUST** look for ambiguity before writing code, not after.
- **MUST** ask the user and wait for an answer when any ambiguity exists.
- **MUST** state each ambiguity, list the plausible interpretations, and recommend one option.
- **MUST** batch all open questions into one clarification round instead of asking one at a time.
- **MUST NOT** infer intended behavior silently, even for details that seem small.
- **MUST NOT** pick a "reasonable default" for feature-level behavior and proceed.
- **MUST NOT** postpone clarification until the implementation is finished or partially committed.
- **MUST NOT** expand scope to resolve ambiguity on your own; stop and ask.
- **MUST** treat a user-approved assumption as binding for the rest of the task and write it down.

The only cases where proceeding without asking is allowed — all must hold:

1. The requirement has exactly one reasonable interpretation.
2. The decision is internal and mechanically reversible (naming, private structure, formatting).
3. The choice cannot alter behavior, schema, contracts, security or operator-visible output.

Before writing code, emit a short check in this form:

```text
Ambiguities: <bulleted list, or "none">
Action: <"proceeding" or "asking user">
```

### Git: the user owns commits

- Never create a commit by default. Do not run `git commit`, `git commit --amend`, `git rebase`, `git push`, or any other history-changing command unless the user explicitly instructs it.
- Do not stage files with `git add` as part of normal implementation work. Leave changes in the working tree so the user can review them.
- The user reviews and creates commits. If a commit is explicitly requested, confirm the intended scope first and commit only the reviewed files.
- Never rewrite, squash, reset, or force-push history unless the user explicitly asks for that exact operation.

### Code comments

- Do not add unnecessary comments. Clear names and small functions are preferred over explanatory noise.
- Comments should describe the high- or medium-level objective of a function, module, or non-obvious decision.
- Do not narrate obvious code, restate names or types, or write multi-line blocks that repeat the implementation.
- Keep comments short: usually one or two lines explaining why the code exists or what invariant it protects.

## What this project is

A modular monolith for NSE cash-equity strategy research, backtesting, risk control and, eventually,
controlled live execution. The same strategy contract is intended to run unchanged in backtesting and
live execution.

The current implementation is **R1**: an offline operator cockpit with a complete lifecycle database
schema, configuration management, authentication, API, worker jobs and a nine-route dashboard.
R1 cannot place orders.

“R1” means release 1, not schema version 1. The schema already covers R1–R9.

### Release map

| Release | Deliverable                                                              | Roadmap mode           |
| ------- | ------------------------------------------------------------------------ | ---------------------- |
| R1      | Foundation, full database schema, configuration, dashboard, offline jobs | `offline`              |
| R2      | Upstox historical ingestion and data-quality validation                  | `research`             |
| R3      | Strategy registry and opening-range-breakout implementation              | `research`             |
| R4      | Shared backtesting and simulated execution                               | `backtesting`          |
| R5      | Live ingestion, signals, risk engine and order-state management          | `paper`                |
| R6      | Upstox sandbox, production auth, static IP and algo compliance           | `testing`              |
| R7      | Paper-trading validation and production-readiness gates                  | `paper`                |
| R8      | Controlled live deployment, monitoring and reconciliation                | `limited live`         |
| R9      | Additional strategies through the existing strategy interface            | `controlled expansion` |

The environment enum is narrower than the roadmap labels: `TRADING_MODE` accepts only `offline`,
`research`, `backtesting`, `paper` and `live`. R1 refuses to start on anything except `offline`.

R1 is complete and verified: 58 logical tables, 1 materialized view, 6 explicit M:N join tables,
monthly candle and quote partitions, a seeded operator, and zero live orders.

## Non-negotiable guardrails

- `TRADING_MODE` defaults to `offline`. The API and worker call `assertOfflineMode()` at startup and
  refuse to start outside `offline`.
- `SystemControlService.onModuleInit()` also refuses to start if any active account is not `offline`.
- R1 has **no live order routes**. The `orders` table exists for R5, but R1 verifies zero rows.
- The Upstox client is **read-only**. It deliberately has no order, modify or cancel method.
- Strategies may not import broker adapters or send orders directly.
- Every backtest and live trade must record its strategy version and configuration snapshot.
- Broker credentials are encrypted at rest. Plaintext secrets are never logged, audited or returned.

Git ownership and code-comment rules are in the Working agreement above.

## Technology stack

| Concern           | Technology / version                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| Runtime           | Node.js 24 (`.nvmrc`, `.node-version`)                                    |
| Package manager   | pnpm 11.28.8, one workspace lockfile                                      |
| Monorepo          | Nx 22.7.12, project graph, affected commands, local cache                 |
| Dashboard         | Next.js 16.4.2, React 19.3.0, App Router, Tailwind/shadcn                 |
| API               | NestJS 12.0.1, Express, Swagger                                           |
| Worker            | NestJS 12.0.1 application context, `@nestjs/schedule`, BullMQ             |
| Language          | TypeScript 6.0.x for Nest apps; TypeScript 5.9.x for web/packages/tests   |
| Unit tests        | Vitest 4.x for Nest apps; Vitest 3.2.x for web/packages/tests             |
| Lint / format     | Oxlint 1.x, Prettier 3.x with Tailwind plugin                             |
| Database          | PostgreSQL 17+ — **external**; `DATABASE_URL` is the only database source |
| ORM / migrations  | Drizzle ORM 0.44.x, drizzle-kit 0.31.x, postgres.js 3.4.x                 |
| Queue / cache     | Redis Stack (`redis/redis-stack`) + BullMQ                                |
| Broker            | Upstox V3 historical/market-data API, read-only in R1                     |
| Auth              | Argon2id password hashes, opaque sessions, HttpOnly cookies               |
| Credential crypto | AES-256-GCM with `CONFIG_ENCRYPTION_KEY`                                  |
| Containers        | Docker Compose under `infra/docker/`                                      |

PostgreSQL is **not** started by Docker Compose. Redis is.

## Repository map

```text
.
├── apps/
│   ├── web/                 Next.js dashboard (:3000)
│   ├── api/                 NestJS HTTP API (:8000)
│   └── worker/              NestJS background jobs (no HTTP port)
├── packages/
│   ├── domain/              Shared types, hashing, pricing, queue names
│   ├── configuration/       Env validation, offline assertion, JSON schemas
│   ├── database/            Drizzle schema, migrations, repositories, seed, verify
│   ├── adapters/            Upstox read-only client; simulated broker placeholder
│   ├── trading-engine/      Strategy contract; registry/indicators placeholders
│   ├── strategies/          Opening-range-breakout placeholder
│   ├── risk-engine/         Placeholder for R5 risk enforcement
│   ├── execution-engine/    Placeholder for R5 order/position state
│   ├── market-data/         Placeholder for normalized market data
│   ├── backtesting/         Placeholder for R4 historical replay
│   ├── notifications/       Placeholder cross-cutting package
│   └── observability/       Placeholder cross-cutting package
├── tests/                   Integration, broker-contract and Playwright suites
├── infra/
│   ├── docker/              Compose files and Dockerfiles
│   └── azure/               Azure deployment notes
├── docs/
│   ├── architecture/        Architecture overview and ADR 0001
│   ├── operations/          Runbook and implementation notes
│   └── strategies/          ORB strategy summary
├── context/                 Authoritative specifications and plans
├── scripts/                 Boundary check, port inspection, dev cleanup
├── AGENTS.md                Project context and working rules
└── CLAUDE.md                Single pointer to AGENTS.md
```

There are **16 Nx projects**: 3 apps, 12 shared packages and `tests`.

## Applications

### `apps/web` — Next.js dashboard

- The only browser-facing surface. It calls the API over HTTP and never touches the database directly.
- App Router with a `(dashboard)` route group and a separate `/login` route.
- Nine R1 routes: `/`, `/accounts`, `/instruments`, `/universes`, `/strategies`, `/configuration`,
  `/data`, `/audit`, `/settings`.
- Server components read through `src/lib/api.ts`; server actions perform writes.
- The web app stores the API session token in its own HttpOnly cookie (`ai_trading_session`) and
  forwards it to the API as a Bearer token.
- `src/proxy.ts` protects every route except login and auth callbacks. Next.js 16 replaced the
  `middleware` convention with `proxy`.
- `src/features/*` contains placeholders for backtesting, performance, risk management, strategies,
  system settings and trading.
- UI primitives live in `src/components/ui` (shadcn); dashboard-specific components in
  `src/components/dashboard`; the shell/navigation in `src/components/shell`.
- `next.config.ts` transpiles `@ai-trading/domain` and `@ai-trading/configuration`.
- Next.js 16 has breaking changes. Read `apps/web/AGENTS.md` and the bundled docs under
  `apps/web/node_modules/next/dist/docs/` before changing framework-level code.
- The web build forces `NODE_ENV=production` because Next.js 16 fails to prerender its internal
  `_global-error` route under `NODE_ENV=development`.

### `apps/api` — NestJS HTTP API

- Listens on `API_PORT` (default `8000`).
- Global prefix `api`; URI versioning with default version `1`; Swagger at `/api/docs`.
- `ValidationPipe` uses `whitelist`, `transform` and `forbidNonWhitelisted`.
- Helmet, cookie-parser and CORS to `WEB_URL` with credentials.
- A global `SessionAuthGuard` protects every route. `@Public()` is used only by `GET /health` and
  `POST /auth/login`.
- `bootstrap-env.ts` loads the workspace `.env` before the database client is imported.
- R1 modules registered: auth, accounts, instruments, universes, strategies, configuration, data,
  audit, settings, system-control.
- Placeholder controllers exist for orders, positions, risk, trading, backtests, reports,
  notifications and market-data, but they are **not imported** into `AppModule`. Do not describe them
  as active API surface.
- Write endpoints record audit rows with actor, request id, IP and user agent.

### `apps/worker` — NestJS background worker

- Runs as a Nest application context, not an HTTP server.
- Registers all BullMQ queues but only has processors for `historical-data` and `maintenance` in R1.
- `HistoricalDataModule` handles `historical-backfill`, `instrument-sync`, `calendar-sync` and
  `coverage-recompute`.
- `MaintenanceModule` handles `refresh-materialized-view` and `ensure-partitions`.
- Placeholder services exist for live market data, strategy evaluation, backtest execution,
  order reconciliation, post-trade analytics and end-of-day square-off. They are not wired yet.
- Provider jobs with an empty `UPSTOX_API_KEY` or `UPSTOX_ACCESS_TOKEN` complete as `succeeded` with
  `result.skipped=true` and a reason. This is expected in R1.
- Scheduled jobs (IST):
  - 08:00 weekdays: instrument sync and calendar sync
  - 16:00 weekdays: materialized-view refresh
  - 08:00 on the first of each month: partition maintenance
  - `WORKER_SCHEDULES_ENABLED=false` disables them.
- Calendar sync uses the checked-in NSE fixture because Upstox does not expose a market-calendar
  endpoint. Replace it with a reviewed source before R6.

## Shared packages

| Package                        | Purpose                                                     | R1 state                                     |
| ------------------------------ | ----------------------------------------------------------- | -------------------------------------------- |
| `@ai-trading/domain`           | Shared vocabulary, canonical hashing, tick rounding, queues | Implemented                                  |
| `@ai-trading/configuration`    | Env schema, offline assertion, JSON schemas, env loading    | Implemented                                  |
| `@ai-trading/database`         | Drizzle schema, migrations, repositories, seed, verify      | Implemented                                  |
| `@ai-trading/adapters`         | Upstox read-only client and status/timestamp mapping        | Read-only Upstox only; simulated broker stub |
| `@ai-trading/trading-engine`   | Strategy contract                                           | Contract only; registry/indicators empty     |
| `@ai-trading/strategies`       | Independently versioned strategy implementations            | ORB placeholder only                         |
| `@ai-trading/risk-engine`      | Position sizing, exposure, kill switch                      | Placeholder                                  |
| `@ai-trading/execution-engine` | Order/position state and broker ports                       | Placeholder                                  |
| `@ai-trading/market-data`      | Normalized market data, validation, universes               | Placeholder                                  |
| `@ai-trading/backtesting`      | Historical replay, simulated execution, costs, metrics      | Placeholder                                  |
| `@ai-trading/notifications`    | Alerts and notification delivery                            | Placeholder                                  |
| `@ai-trading/observability`    | Logging, metrics and monitoring                             | Placeholder                                  |

### `packages/domain`

- Exports `Bar`, `Instrument`, `InstrumentType`, `Timeframe`, `OrderSide`, `OrderStatus`, `OrderType`,
  `PositionSnapshot`, `Signal`, `SignalSide`, `StrategyConfig`.
- `canonicalJson()` sorts object keys recursively and preserves array order.
- `hashPayload()` is SHA-256 over canonical JSON; configuration hashes use it.
- `sha256Hex()` is used for session-token hashing.
- `roundToTick()` rounds to an instrument tick and rejects invalid input.
- `QUEUES` defines the eight BullMQ queue names.
- No internal dependencies.

### `packages/configuration`

- `envSchema` is a Zod schema for the whole environment.
- `validateEnv()` parses configuration; unknown trading modes are rejected.
- `assertOfflineMode()` is the startup guard used by the API and worker.
- `loadEnvFiles()` loads `.env` from the current working directory and `../../.env`, without
  overriding inline environment variables.
- Exports canonical hashing from `domain`.
- `riskConfigurationSchema` and `systemConfigurationSchema` are JSON schemas for configuration
  validation. Strategy parameter schemas come from `strategy_versions.parameter_schema`.
- `validateJsonSchema()` uses Ajv.
- Depends only on `domain`.

### `packages/database`

- Owns the Drizzle schema, migrations, repositories, seed, verification and database client.
- `client.ts` creates a `postgres.js` pool (`max: 10`) and Drizzle instance. It throws at import time
  if `DATABASE_URL` is missing.
- `schema/index.ts` exports every table for runtime use.
- `schema/drizzle.ts` is the drizzle-kit generation entry point. It excludes the partitioned market
  tables because those are created by explicit SQL.
- `repositories/` is split by domain:
  - `platform.ts` — users, sessions, accounts, access, credentials, audit, settings, equity
  - `reference.ts` — instruments, mappings, universes, calendar, corporate actions, provider sync
  - `strategy.ts` — strategies, versions, configuration versions/bindings, sessions, risk events
  - `market.ts` — coverage, ingestion runs, quality issues, candles, quotes, daily stats, partitions
  - `operations.ts` — job runs, health snapshots, notifications, reports, dashboard overview
- `migrate.ts` applies numbered SQL files in filename order, wraps each in a transaction, and records
  SHA-256 checksums in `schema_migrations`. It refuses to continue if an applied file changed.
- `seed.ts` is idempotent and creates the R1 reference fixture.
- `verify.ts` checks table count, materialized views, foreign keys, partitions, zero orders and
  strategy-version bindings.
- `load-env.ts` loads the workspace root `.env` for package-level scripts.
- `drizzle.config.ts` uses package-relative absolute paths and loads the root `.env`.

### `packages/adapters`

- `UpstoxClient` is read-only: instrument master, historical candles, intraday candles.
- It has no order, modify or cancel methods by design.
- `configurationReason()` explains why a provider job is skipped.
- Supports gzip instrument masters and 60-second request timeouts.
- `mapUpstoxOrderStatus()` maps Upstox status strings to internal statuses and returns `unknown`
  rather than guessing.
- `parseUpstoxTimestamp()` treats offset-less Upstox timestamps as IST (`+05:30`).
- The simulated-broker directory is a placeholder.

### `packages/trading-engine`

- Defines `StrategyContext` and `Strategy`:
  - `id`, `version`
  - `evaluate(context): readonly Signal[]`
- Registry, indicators and signal-processing directories are placeholders for R3.

### `packages/strategies`

- `openingRangeBreakout` is a placeholder implementation returning no signals.
- The authoritative rules are in `context/strategy1.md` and summarized in
  `docs/strategies/opening-range-breakout.md`.
- ORB summary: 09:15–09:30 IST opening range, five-minute signal bars, 09:30–14:15 entry window,
  breakout close above range high, VWAP confirmation, NIFTY EMA confirmation, 1.5× volume
  confirmation, stop one tick below breakout-candle low, 1.5R target, 15:15 EOD exit, one position,
  two entries per day, risk-budget sizing.

## Architecture and dependency rules

The system is a modular monolith with a separate worker process.

- `apps/web` is the only browser-facing surface and calls the API over HTTP.
- `apps/api` validates commands and coordinates workflows.
- `apps/worker` runs ingestion, strategy evaluation, backtests, reconciliation and scheduled work.
- `packages/domain` owns the shared vocabulary.
- `packages/trading-engine` defines the strategy contract.
- `packages/strategies` contains independently versioned strategies.
- `packages/risk-engine` enforces sizing, exposure and kill-switch rules.
- `packages/execution-engine` owns order/position state and broker ports.
- `packages/adapters` implements broker ports.
- `packages/backtesting` replays history through the same strategy and risk contracts.
- `packages/database` owns persistence.
- `packages/configuration` validates and snapshots versioned settings.

### Enforced dependency rules

1. Apps never import other apps.
2. Packages never import apps.
3. Tests never import apps.
4. `domain` has no internal dependencies.
5. `execution-engine` defines broker ports; only `adapters` implements them.
6. `strategies` depends only on `domain` and `trading-engine`.
7. No package imports NestJS, Next.js or React.
8. Trading mode comes from validated configuration, never from a strategy or adapter.

`scripts/check-boundaries.mjs` enforces these rules from the Nx project graph. It runs as part of
`pnpm lint` and directly as `pnpm boundaries`.

Explicit package contracts also live in that script:

```text
web               -> domain, configuration
domain            -> (none)
trading-engine    -> domain
strategies        -> domain, trading-engine
risk-engine       -> domain
execution-engine  -> domain
backtesting       -> domain, trading-engine, risk-engine, execution-engine
market-data       -> domain
adapters          -> domain, market-data, execution-engine
database          -> domain
configuration     -> domain
notifications     -> domain
observability     -> (none)
```

If you add a legitimate dependency, update `scripts/check-boundaries.mjs` and the architecture docs.

### Build model

- Shared packages build with `tsup` into ESM + CJS with declarations.
- Apps consume built package output, not package source.
- Nx `dependsOn: ["^build"]` enforces build order.
- There are no tsconfig path aliases for package names, to avoid source/runtime drift.
- `pnpm dev` first builds all packages except web/api/worker/tests, then runs the three apps in
  parallel.
- Nx project tags are `type:app`, `type:lib`, `type:test` plus `scope:*`.

## Database

### R1 shape

- **58 logical tables**
- **1 materialized view** (`mv_instrument_daily_stats`)
- **6 explicit M:N join tables**
- Monthly range partitions for `market_candles_1m` and `market_quote_snapshots`
- Full lifecycle schema for R1–R9; later releases add code, not a redesign

### Table groups

```text
Platform (8)
  users, user_sessions, accounts, user_account_access, broker_credentials,
  audit_log, domain_events, account_instrument_permissions

Reference (12)
  providers, exchanges, instruments, instrument_provider_mappings,
  trading_calendar, corporate_actions, instrument_universes,
  instrument_universe_versions, instrument_universe_members,
  raw_provider_payloads, data_quality_issues, market_data_ingestion_runs

Market (3)
  market_candles_1m, market_quote_snapshots, market_data_coverage

Strategy / configuration (6)
  strategies, strategy_versions, configuration_versions,
  strategy_config_bindings, strategy_universe_members, strategy_activations

Session / risk (2)
  trading_sessions, risk_events

Execution / reconciliation (14)
  signals, risk_decisions, orders, order_events, fills, trade_costs,
  positions, position_events, broker_position_snapshots, holdings_snapshots,
  account_equity_snapshots, round_trip_trades, reconciliations,
  reconciliation_issues

Backtest / governance (6)
  backtest_runs, backtest_windows, backtest_trades, backtest_equity_curve,
  backtest_metrics, strategy_promotion_reviews

Analytics / operations (7)
  daily_performance, strategy_performance_daily, job_runs,
  system_health_snapshots, notification_events, report_runs, system_settings
```

The six explicit M:N tables are `user_account_access`, `account_instrument_permissions`,
`instrument_universe_members`, `strategy_config_bindings`, `strategy_universe_members` and
`strategy_activations`. Do not replace them with ORM-managed implicit join tables.

### Data-model decisions

- Instrument identity is a broker-neutral UUID (`instruments.id`). Upstox keys and symbols live only
  in `instrument_provider_mappings`. Upstox keys never become canonical keys, and the canonical
  `instruments.id` does not change when provider mappings are refreshed.
- Only `market_candles_1m` stores OHLCV bars. Five-minute, fifteen-minute, hourly and daily bars are
  derived on read.
- `market_quote_snapshots` stores LTP, OHLC, top-of-book and circuit limits.
- `market_data_coverage` stores expected-versus-stored bars per instrument-day; it is the preflight
  gate for backtests.
- `mv_instrument_daily_stats` is a rebuildable cache for daily aggregation, universe selection and
  the dashboard. It is never a source of truth.
- `raw_provider_payloads` archives provider JSON so ingestion can be replayed without refetching.
- Configuration is immutable: a change creates a new `configuration_versions` row with a new hash and
  effective dates. History is never edited.
- `order_events`, `position_events`, `audit_log` and `domain_events` are append-only.
- `orders` exists for R5. R1 seeds and verifies zero rows.
- Backtest output is trades + daily equity curve + metrics; there is no per-bar row explosion.
- Corporate actions carry adjustment factors; candles stay raw and are adjusted on read.
- Cash equities and indices only. No expiry, strike, option type or Greek columns.

### Schema conventions

- Tables are plural `snake_case`.
- Primary key is `id`; foreign keys are `<entity>_id`.
- Timestamps end in `_at`; business dates end in `_date`.
- Money columns describe the amount (`net_pnl`, `available_cash`).
- Booleans read as facts (`is_active`, `kill_switch_engaged`).
- Constraint names: `pk_`, `fk_`, `uq_`, `chk_`; index names: `idx_`.
- Primary keys are UUIDv7 generated by the application. The database fallback is
  `gen_random_uuid()`.
- `system_settings.key` is the deliberate natural-key exception.
- Prices and quantities use `numeric(20,4)`. Money uses `numeric(20,2)`. Ratios use
  `numeric(20,10)`. Percentages use `numeric(10,6)` and are stored as fractions (`0.125` = 12.5%).
- Instants are `timestamptz` in UTC. `trading_date` is a separate IST business date.
- Enumerations are `varchar` + named `CHECK`, not PostgreSQL enums.
- `jsonb` is reserved for evidence, parameters and raw payloads.
- No hard deletes for reference, configuration, orders, trades or audit rows.
  `ON DELETE CASCADE` is limited to sessions, events and child configuration rows.
- Optimistic concurrency uses `updated_at` plus application-level version checks.
- `updated_at` is maintained by triggers; append-only tables are protected by triggers.

### Migrations

```text
0000_r1_schema.sql              generated base schema
0001_partitioned_market.sql     partitioned candle and quote tables + partitions
0002_foreign_keys.sql           every cross-table foreign key
0003_indexes_constraints.sql    partial unique, composite and BRIN indexes
0004_immutability.sql           updated-at and append-only triggers
0005_materialized_view.sql      mv_instrument_daily_stats + refresh function
0006_partition_maintenance.sql  ensure_monthly_partitions / ensure_market_partitions
0007_drop_legacy.sql            removes the pre-R1 bootstrap table and old journal
```

- `pnpm db:migrate` runs `packages/database/migrate.ts`.
- Applied migrations are checksum-protected. Never edit an applied migration; add a new numbered
  file.
- Drizzle schema files define tables, checks and simple indexes. Cross-table FKs, partial indexes,
  partitions, triggers and the materialized view live in explicit SQL because they are easier to
  audit there.
- `schema/drizzle.ts` deliberately excludes the partitioned market tables from drizzle-kit
  generation; `schema/index.ts` exports them for runtime use.
- Future `drizzle-kit generate` runs must not collide with the custom `0001`–`0007` range. Point it
  at a fresh output directory or rename the generated file to the next free number.
- Partition horizon is seeded through 2027-03. `ensure_market_partitions()` extends it; the monthly
  maintenance job and backfills call it.
- Never run `pnpm db:push` against a shared or production database.

### Seed

`pnpm db:seed` runs `packages/database/seed.ts` after building `@ai-trading/domain`.

- It is idempotent and refuses to run without `SEED_OPERATOR_EMAIL` and `SEED_OPERATOR_PASSWORD`.
- It seeds:
  - one operator with an Argon2id password hash
  - one offline Upstox account (`SEED_ACCOUNT_CODE`, default `upstox-primary`)
  - providers: Upstox, simulated broker, CSV import
  - exchanges: NSE and BSE
  - NIFTY 50 index + 50 NSE cash equities with ISINs
  - Upstox mappings (`NSE_EQ|<ISIN>` or `PENDING:<SYMBOL>` until the real master is synced)
  - the `orb-liquid-20` universe and its 20 members
  - a 2026–2027 NSE trading calendar with holidays
  - strategy `orb-15m`, version 1, with its parameter JSON schema
  - strategy, risk and system configuration versions
  - `parameters`, `risk` and `execution` bindings
  - strategy universe members and account instrument permissions
  - default `system_settings`
  - one `system.seeded` audit row
- It does **not** write `broker_credentials`. That table is empty after a fresh seed.
- `SEED_BROKER_USER_REF` maps to `accounts.broker_user_ref`. It is optional and is the Upstox
  client code / UCC, not an API key or token. The seed sets it only when creating the account; later
  seed runs do not overwrite it.
- `SEED_FORCE_PASSWORD_RESET=true` resets the existing operator password.

### Verification

`pnpm db:verify` expects:

```text
58 logical tables
1 materialized view
>= 63 candle partitions
>= 15 quote partitions
0 live orders
0 strategy versions missing a parameters binding
```

The integration suite repeats the schema, seed, foreign-key, immutability and binding checks against
a testcontainers PostgreSQL instance.

## API surface (R1)

Base URL: `http://localhost:8000/api/v1`. Swagger: `http://localhost:8000/api/docs`.

- **Health**: `GET /health` (public)
- **Auth**: `POST /auth/login` (public), `POST /auth/logout`, `GET /auth/session`
- **Accounts**: `GET /accounts`; `GET /accounts/:id/permissions`; `GET /accounts/:id/credentials`;
  `GET /accounts/:id/access`; `GET /accounts/:id/equity`; `GET /accounts/:id/sessions`;
  `POST /accounts/:id/credentials`
- **Instruments**: `GET /instruments`; `GET /instruments/:id`; `GET /instruments/:id/mappings`;
  `GET /instruments/:id/corporate-actions`; `GET /instruments/:id/candles`
- **Universes**: `GET /universes`; `GET /universes/:id`; `GET /universes/:id/versions`
- **Strategies**: `GET /strategies`; `GET /strategies/:id`; `GET /strategies/:id/versions`;
  `GET /strategies/:id/versions/:versionId/effective-config`; `POST /strategies/:id/versions`
- **Configuration**: `GET /configuration`; `GET /configuration/:id`; `GET /configuration/:id/diff`;
  `POST /configuration`; `POST /configuration/:id/bind`
- **Data**: `GET /data/coverage`; `GET /data/coverage/summary`; `GET /data/ingestion-runs`;
  `GET /data/quality-issues`; `GET /data/daily-stats`;
  `POST /data/quality-issues/:id/acknowledge`; `POST /data/backfill`;
  `POST /data/refresh-materialized-view`
- **Audit**: `GET /audit`
- **Settings**: `GET /settings`; `PATCH /settings/:key`
- **System**: `GET /system/status`; `GET /system/overview`; `GET /system/jobs`;
  `GET /system/health-snapshots`; `GET /system/notifications`; `GET /system/reports`;
  `GET /system/calendar`; `GET /system/risk-events`; `GET /system/sessions`

Notes:

- Health checks database and Redis and reports `ok`, `degraded` or `unhealthy`.
- `GET /system/status` includes queue counts.
- Backfill is bounded: start no earlier than `2022-01-01`, end no later than today, at most
  `DATA_BACKFILL_MAX_DAYS` (31 by default), and requires the seeded Upstox provider.
- Configuration creation is idempotent by canonical payload hash; an existing version returns
  `created: false`.
- `POST /configuration/:id/bind` binds a configuration snapshot to a strategy version with a role
  such as `parameters`, `risk` or `execution`.
- `POST /accounts/:id/credentials` encrypts the value and returns metadata only.
- All non-public routes require a valid session cookie or Bearer token.

## Worker, queues and schedules

Queue names from `@ai-trading/domain`:

```text
historical-data
live-market-data
strategy-evaluation
backtest-execution
order-reconciliation
post-trade-analytics
end-of-day-square-off
maintenance
```

R1 processors:

- `historical-data`: `historical-backfill`, `instrument-sync`, `calendar-sync`,
  `coverage-recompute`
- `maintenance`: `refresh-materialized-view`, `ensure-partitions`

Every job creates or receives a `job_runs` row and transitions it through `queued`, `running`,
`succeeded` or `failed`, recording result or error.

Provider jobs are read-only. When Upstox credentials are missing, they record `succeeded` with
`result.skipped=true` rather than failing the worker.

## Dashboard and auth flow

1. The browser opens `http://localhost:3000`.
2. `apps/web/src/proxy.ts` redirects unauthenticated requests to `/login`.
3. The login form posts to the Next.js route `/api/auth/login`.
4. That route calls the Nest API `POST /api/v1/auth/login`.
5. The API verifies the Argon2id hash, creates an opaque 32-byte session token, stores only its
   SHA-256 hash in `user_sessions`, and returns the token.
6. The web route stores the token in its own HttpOnly cookie and forwards it as a Bearer token on
   server-side API calls.
7. Logout revokes the session in the API and clears the web cookie.

The API also sets its own HttpOnly cookie on direct login. Both paths are supported.

## Security and data protection

- Password hashes: Argon2id.
- Sessions: opaque tokens, SHA-256 hashed at rest, expiry (`SESSION_TTL_HOURS`, default 12) and
  revocation.
- Cookies: HttpOnly, SameSite=Lax. The API cookie uses `COOKIE_SECURE` for its Secure flag; the web
  login route sets Secure when `NODE_ENV=production`.
- Broker credentials: AES-256-GCM envelope format with a version byte, 12-byte nonce and 16-byte
  auth tag. `CONFIG_ENCRYPTION_KEY` may be 64 hex characters, 32 base64 bytes, or a passphrase
  (development convenience only).
- Credential types accepted by the API: `api_key`, `api_secret`, `access_token`, `refresh_token`,
  `totp_secret`.
- The API never returns ciphertext. Credential reads return metadata.
- Audit rows capture actor, account, action, entity, before/after state, request id, IP and user
  agent. Callers pass non-secret metadata only; credential values are never written to audit rows.
- The Upstox adapter cannot write orders. There is no live order route in R1.
- `JWT_SECRET` and `JWT_EXPIRES_IN` exist in the env schema but are not used by R1 authentication.

## Environment

The workspace root `.env` is the single source of truth. It is loaded by:

- `apps/api/src/bootstrap-env.ts` and `apps/worker/src/bootstrap-env.ts`
- `packages/configuration/load-env.ts`
- `packages/database/load-env.ts`
- `packages/database/drizzle.config.ts`

Inline environment variables win over `.env` values.

### Required for a usable fresh R1 setup

| Variable                 | Source                                | Why required                                 |
| ------------------------ | ------------------------------------- | -------------------------------------------- |
| `DATABASE_URL`           | PostgreSQL provider or local instance | Database client, migrations, seed and verify |
| `SEED_OPERATOR_EMAIL`    | You choose                            | Creates the operator login                   |
| `SEED_OPERATOR_PASSWORD` | You choose (at least 8 characters)    | Creates the Argon2id password hash           |
| `CONFIG_ENCRYPTION_KEY`  | `openssl rand -hex 32`                | Encrypt/decrypt broker credentials           |

`CONFIG_ENCRYPTION_KEY` is not needed to start the API or sign in, but credential storage and
rotation fail without it.

Minimal `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/ai_trading
SEED_OPERATOR_EMAIL=you@example.com
SEED_OPERATOR_PASSWORD=choose-a-strong-password
CONFIG_ENCRYPTION_KEY=<output of openssl rand -hex 32>
```

### Required only for real provider jobs

| Variable              | Source                       | Notes                                |
| --------------------- | ---------------------------- | ------------------------------------ |
| `UPSTOX_API_KEY`      | Upstox Developer Apps portal | Worker reads it directly; not seeded |
| `UPSTOX_ACCESS_TOKEN` | Upstox OAuth flow            | Daily token; not seeded              |

`UPSTOX_API_SECRET`, `UPSTOX_REDIRECT_URI` and `UPSTOX_SANDBOX` are declared for later OAuth work
and are not consumed by the R1 worker. `UPSTOX_NETWORK_ENABLED=false` forces provider jobs to skip.

### Useful defaults

| Variable                   | Default                        |
| -------------------------- | ------------------------------ |
| `API_PORT`                 | `8000`                         |
| `API_PREFIX`               | `api`                          |
| `WEB_URL`                  | `http://localhost:3000`        |
| `API_URL` (web)            | `http://localhost:8000/api/v1` |
| `REDIS_URL`                | `redis://localhost:6379`       |
| `TRADING_MODE`             | `offline`                      |
| `SESSION_TTL_HOURS`        | `12`                           |
| `COOKIE_SECURE`            | `false`                        |
| `MARKET_TIMEZONE`          | `Asia/Kolkata`                 |
| `DATA_BACKFILL_MAX_DAYS`   | `31`                           |
| `INSTRUMENT_SYNC_LIMIT`    | `5000`                         |
| `WORKER_SCHEDULES_ENABLED` | `true`                         |

### Removed variables

`POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` are no longer used. PostgreSQL is external;
only `DATABASE_URL` matters.

`RISK_EQUITY`, `RISK_PER_TRADE_PCT` and `DAILY_LOSS_LIMIT_PCT` are declared with defaults, but R1
risk settings are stored in `configuration_versions`. Do not treat the env values as authoritative.

### Docker and external PostgreSQL

- For Dockerized API/worker connecting to PostgreSQL on the host, use
  `host.docker.internal` on Docker Desktop. The apps Compose file maps it via `extra_hosts`.
- For managed PostgreSQL, use the provider hostname and `?sslmode=require` when TLS is required.
- URL-encode special characters in the password.

## Commands

### First-time setup

```bash
pnpm install
cp .env.example .env
# Set DATABASE_URL, SEED_OPERATOR_EMAIL, SEED_OPERATOR_PASSWORD, CONFIG_ENCRYPTION_KEY.
pnpm docker:up        # starts Redis Stack only
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm dev
```

### Daily development

```bash
pnpm dev              # builds packages, then web :3000 + API :8000 + worker
pnpm graph            # Nx project graph
pnpm ports            # inspect listeners on 3000/8000
pnpm dev:stop         # stop stale listeners on 3000/8000
```

### Quality gates

```bash
pnpm format
pnpm format:check
pnpm lint             # Oxlint across all projects + architecture boundaries
pnpm boundaries       # boundaries only
pnpm typecheck
pnpm test
pnpm build
```

### Database

```bash
pnpm db:generate      # drizzle-kit generate, package-level config
pnpm db:migrate       # apply numbered SQL migrations
pnpm db:seed          # idempotent R1 seed
pnpm db:verify        # schema and seed assertions
pnpm db:studio        # Drizzle Studio
pnpm db:push          # disposable local databases only; never shared/production
```

Root `db:*` scripts delegate to `@ai-trading/database`. The package scripts live in
`packages/database/package.json`.

### Tests

```bash
pnpm test
pnpm --filter @ai-trading/tests test:integration
pnpm --filter @ai-trading/tests test:broker-contracts
pnpm --filter @ai-trading/tests test:e2e
```

### Docker

```bash
pnpm docker:up        # Redis Stack + RedisInsight
pnpm docker:down
pnpm docker:logs
pnpm docker:apps:up   # web + api + worker + Redis
pnpm docker:apps:down
```

### Single package watcher

`pnpm dev` runs the three apps, not every package watcher. Start a package watcher separately:

```bash
pnpm --filter @ai-trading/<package> dev
```

## Testing

- Unit tests:
  - `packages/domain` — canonical hashing, tick rounding
  - `packages/configuration` — env defaults, offline assertion, unknown modes
  - `packages/adapters` — Upstox client behavior
  - `apps/api` — app controller and credential encryption
  - `apps/worker` — app controller
- Integration tests:
  - `tests/integration/r1-database.test.ts` starts `postgres:17-alpine` with testcontainers,
    runs migrations, seeds, and asserts schema shape, partitions, FKs, zero orders and bindings.
  - `tests/integration/configuration.test.ts` covers configuration/env behavior.
- Broker contracts:
  - `tests/broker-contracts/strategy-contract.test.ts`
- End-to-end:
  - `tests/end-to-end/dashboard.spec.ts` uses Playwright and starts the web dev server. A meaningful
    run needs the API and a seeded database.

The runtime database is external, but integration tests use an isolated testcontainers PostgreSQL.

## Infrastructure

```text
infra/docker/
├── docker-compose.yml          Redis Stack only
├── docker-compose.apps.yml     web + api + worker, includes the base Compose file
├── api.Dockerfile
├── web.Dockerfile
└── worker.Dockerfile
```

- `docker-compose.yml` starts `redis/redis-stack:latest` with append-only persistence and
  `noeviction`. Ports: Redis `6379`, RedisInsight `8001`.
- PostgreSQL is external. Compose does not start it and has no `postgres_data` volume.
- `docker-compose.apps.yml` builds from the repository root, reads `../../.env`, overrides
  `REDIS_URL` to `redis://redis:6379`, and maps `host.docker.internal:host-gateway` for host
  PostgreSQL.
- Dockerfiles use `node:24-alpine`, enable Corepack, run `pnpm install --frozen-lockfile`, build the
  filtered app, and run its `dist/main.js` (or `next start` for web).
- `.dockerignore` stays at the repository root because Docker only reads it from the build-context
  root. The Dockerfiles use the root as their build context.
- RedisInsight: `http://localhost:8001`.

## Agent workflow

### Before changing code

1. Apply the mandatory "Clarify before implementing" rule. If behavior is ambiguous, ask before
   exploring implementation options.
2. Read the relevant package and its `project.json`.
3. Use the Nx graph or `pnpm nx show project <name> --json` for targets and dependencies.
4. Prefer Nx commands over invoking underlying tools directly.
5. Check `context/r1-implementation-plan.html` for schema intent and
   `docs/operations/implementation-notes.md` for known deviations.

### Adding a database change

1. Update `packages/database/schema/*.ts` for tables, checks and simple indexes.
2. Add a new numbered SQL migration for FKs, partial indexes, partitions, triggers or views.
3. Never edit an applied migration.
4. Update `verify.ts` and the integration assertions if the shape changes.
5. Run `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:verify`, and the integration tests.
6. Remember the custom `0001`–`0007` migration range when running `drizzle-kit generate` later.

### Adding an API route

1. Put it in the owning Nest module and add DTO validation.
2. Keep the global `SessionAuthGuard`; use `@Public()` only for genuinely public endpoints.
3. Use `ParseUUIDPipe` for UUID parameters.
4. Record an audit row for every write.
5. Update Swagger-facing DTOs and the web client/types if needed.
6. Do not add an order-placing route in R1.

### Adding a worker job

1. Add the queue name to `QUEUES` if it is new.
2. Register the queue in `QueuesModule`.
3. Create a `job_runs` row and update it through `running`, `succeeded` or `failed`.
4. Handle missing provider credentials as a skipped success, not a crash.
5. Add the processor and schedule only when the release actually needs it.

### Adding a web route

1. Follow the `(dashboard)` route group and `PageHeader`/`EmptyState` patterns.
2. Read through `apiFetch`; write through server actions.
3. Never access the database directly.
4. Keep the offline badge and responsive layout; verify 390px width.
5. Remember Next.js 16 uses `proxy.ts`, not `middleware`.

### Adding or changing an environment variable

1. Update `packages/configuration/env.ts`.
2. Update `.env.example` and the README/runbook.
3. Update tests if behavior changes.
4. If the variable is needed at import time, ensure it is loaded before the importing module.

### Before finishing

Run the relevant subset, then the full gates when the change is broad:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not commit. Report what changed, what was verified, and any remaining manual step.

## Known gotchas

- `packages/database/client.ts` reads `DATABASE_URL` at import time. Anything that imports the
  database package must load the workspace `.env` first (`bootstrap-env.ts` or `load-env.ts`).
- `pnpm db:seed` builds `@ai-trading/domain` first. Running `tsx seed.ts` directly may fail if the
  package output is stale.
- `pnpm dev` builds packages before starting apps. A package change may need a package watcher or a
  rebuild.
- The web build must run with `NODE_ENV=production`; the web package script already does this.
- Next.js 16 is not the Next.js most training data assumes. Read the bundled docs.
- TypeScript is split: Nest apps use 6.0.x, web/packages/tests use 5.9.x.
- Vitest is split: Nest apps use 4.x, web/packages/tests use 3.2.x.
- If an editor reports `process` or `Buffer` missing, the package needs a direct `@types/node`
  dependency and `"types": ["node"]` in its tsconfig. This was fixed for `domain`, `configuration`,
  `adapters`, `database` and `tests`.
- Do not add tsconfig path aliases for workspace package names. Add a workspace dependency and build
  the package.
- The API and worker refuse to start outside `offline`. If they exit immediately, check
  `TRADING_MODE`.
- The API also refuses to start if an active account has a non-offline mode.
- `GET /health` returns `degraded` when only one of PostgreSQL or Redis is healthy.
- The worker needs Redis; `pnpm docker:up` starts it. A queue-unavailable error usually means Redis
  is down or `REDIS_URL` is wrong.
- R1 provider jobs skip when Upstox credentials are absent. That is not a failure.
- The R1 calendar is a fixture. Do not treat it as an authoritative exchange calendar.
- Upstox order-status mapping and the net-equity formula still need live verification before R5/R6.
- `orders`, `signals`, `risk_decisions`, `fills` and `positions` are schema-ready but not written by
  R1 runtime code.
- `db:push` is for disposable local databases only.
- Wiping a database is destructive:
  `psql "$DATABASE_URL" -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'` then migrate/seed.
- `.env` is ignored by Git. Never commit it.
- The repository has one Git repository and one root `.gitignore`; do not add nested `.gitignore`
  files under apps/packages/tests/infra.
- Line endings are LF via `.gitattributes`.

## Source of truth

Use these before guessing:

- `context/r1-implementation-plan.html` — authoritative R1 schema, table fields, enums and rationale
- `context/monorepo-setup-plan.html` — workspace setup plan
- `context/high-level-architecture.md` — layer responsibilities and execution flow
- `context/tech-stack.md` — technology choices
- `context/design-patterns.md` — strategy, ports/adapters, registry and versioning patterns
- `context/strategy1.md` — authoritative ORB rules
- `context/risk-management.md` — risk controls and limits
- `context/trade-execution.md` — execution lifecycle
- `context/backtesting.md` — backtest sequence, windows and promotion gates
- `context/deployment-order.md` — R1–R9 roadmap
- `docs/architecture/README.md` — architecture summary and dependency rules
- `docs/architecture/adr-0001-pnpm-nx-monorepo.md` — monorepo decision record
- `docs/operations/runbook.md` — local start, health checks, recovery
- `docs/operations/implementation-notes.md` — verified versions, deviations and R1 notes
- `docs/strategies/opening-range-breakout.md` — ORB implementation summary
- `README.md` — quick start and URLs

## Glossary

| Term             | Meaning                                                              |
| ---------------- | -------------------------------------------------------------------- |
| R1–R9            | Release plan, not schema versions                                    |
| ORB              | Opening Range Breakout strategy                                      |
| UCC              | Upstox client code / user id; stored in `accounts.broker_user_ref`   |
| M:N              | Many-to-many; always an explicit join table here                     |
| MV               | Materialized view (`mv_instrument_daily_stats`)                      |
| DTO              | NestJS request/response data-transfer object                         |
| Offline          | R1 trading mode; no broker orders are possible                       |
| Provider mapping | Versioned broker key for an instrument; never the canonical identity |
| Snapshot         | Immutable configuration version with hash and effective dates        |

---

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
