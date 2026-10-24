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
| PostgreSQL        | 17-alpine                                           |
| Redis             | 7.4-alpine                                          |

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
docker compose ps
pnpm db:generate && pnpm db:migrate
```

All 16 Nx projects pass typecheck, lint, test and build. The Playwright dashboard smoke test passes. PostgreSQL
and Redis report healthy, and the initial `system_heartbeats` migration is applied.

## R1 implementation notes

The plan of record is `context/r1-implementation-plan.html`. R1 is implemented end to end: schema, migrations,
seed, repositories, configuration management, API, dashboard, worker jobs and authentication.

### Database

- **58 logical tables + 1 materialized view.** The six explicit M:N tables are
  `user_account_access`, `account_instrument_permissions`, `instrument_universe_members`,
  `strategy_config_bindings`, `strategy_universe_members` and `strategy_activations`.
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
- Reference fixture: NIFTY 50 index, 50 NSE cash equities with known ISINs, 20-symbol `orb-liquid-20` universe,
  NSE/BSE exchanges, Upstox/simulated/CSV providers, two years of weekday calendar rows, the `orb-15m` strategy,
  parameter/risk/system configuration versions and their bindings.
- Upstox keys for the fixture are `NSE_EQ|<ISIN>` or `PENDING:<SYMBOL>` until the real instrument master is
  synced. The canonical `instruments.id` never changes.
- The seed writes one audit row per run. Reference and configuration counts remain stable.

### API and security

- **Authentication.** Argon2id password hashes, opaque 32-byte session tokens hashed with SHA-256 in
  `user_sessions`, HttpOnly session cookies, revocation and expiry. The web app stores the token in its own
  HttpOnly cookie and forwards it as a Bearer token from server components and server actions.
- **Offline enforcement.** `assertOfflineMode()` refuses to start the API or worker when `TRADING_MODE` is not
  `offline`. `SystemControlService.onModuleInit()` also refuses to start when an active account is not offline.
- **No order routes.** `OrdersModule`, `TradingModule`, `PositionsModule`, `RiskModule`, `BacktestsModule`,
  `ReportsModule` and `NotificationsModule` are no longer imported into the API. The tables remain for later
  releases.
- **Credentials.** `CONFIG_ENCRYPTION_KEY` drives AES-256-GCM envelope encryption. The API returns credential
  metadata only; ciphertext is never exposed.
- **API surface.** Health, auth, accounts, instruments, universes, strategies, configuration, data health, audit,
  settings and system status. See Swagger at `/api/docs`.
- **Data health writes.** Bounded backfill and materialized-view refresh create `job_runs` and enqueue BullMQ
  jobs. Quality issues can be acknowledged, resolved or ignored with an audit row.

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

- Nine R1 routes: `/`, `/accounts`, `/instruments`, `/universes`, `/strategies`, `/configuration`, `/data`,
  `/audit` and `/settings`.
- Server components read the API through `apps/web/src/lib/api.ts`; server actions perform configuration,
  strategy, credential, data-health and settings writes.
- `apps/web/src/proxy.ts` protects every route except login and auth callbacks. Next.js 16 replaced the
  `middleware` convention with `proxy`.
- The dashboard is dark-first, responsive at 390px, and shows the offline mode on every screen.

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
7. **Instrument master size.** The first real sync can be large; `INSTRUMENT_SYNC_LIMIT` caps the fixture-sized
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

The database verification reports 58 logical tables, 1 materialized view, 63 candle partitions, 15 quote
partitions, zero live orders and a parameters binding for every strategy version. The API smoke test covers
login, every read route, configuration create/idempotency/diff/bind, settings update and a bounded backfill. The
worker processes the backfill and records a skipped result when Upstox credentials are empty. The Playwright
dashboard smoke test passes for all nine routes at 1440px and 390px with no page or server errors.
