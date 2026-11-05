# AGENTS.md — AI Trading System

Modular monolith for NSE cash-equity research, backtesting and (later) controlled live execution.
Current release is **R2**: research data platform. It cannot place orders.

## Working agreement (non-negotiable)

### Clarify before implementing

- Treat any missing requirement, conflicting spec, undefined edge case, or second reasonable
  interpretation as ambiguity that changes behavior. Ask before writing code.
- Batch all questions into one round; state each ambiguity, the plausible interpretations and your
  recommendation. Do not pick a "reasonable default" for feature-level behavior.
- Only proceed silently when the decision is internal, mechanically reversible, and cannot change
  behavior, contracts, schema, security or operator-visible output.
- Emit `Ambiguities: <list|none>` / `Action: proceeding|asking user` before implementation.

### The user owns Git

- Never run `git add`, `git commit`, `git commit --amend`, `git rebase`, `git reset` or `git push`
  unless the user explicitly asks for that exact operation. Leave changes in the working tree.

### On task completion

- **Always run `pnpm lint` before reporting done** (it also runs the architecture boundary check).
  For a narrow change, the owning project's lint target is enough.
- **Do not run `pnpm build` on completion.** Run it only when the user explicitly asks, or when you
  are diagnosing a build-specific failure.

### No browser-based verification

- Do not start web/API to click through a feature, and do not add browser tests to prove a feature.
  Verify with `pnpm lint` plus the relevant `pnpm typecheck` and `pnpm test` targets. Report
  "no browser verification performed by policy" and leave visual review to the user.
- Run the Playwright e2e suite only when the user explicitly requests it in that turn.

### Code comments

- Prefer clear names and small functions. Comment only the module/function objective or a
  non-obvious invariant, usually one or two lines. Do not narrate code or restate types.

## Repo shape

- **16 Nx projects**: 3 apps (`web`, `api`, `worker`), 12 `packages/*`, and `tests`.
- `apps/web` is the only browser surface and talks to the API over HTTP; it never touches the DB.
- `apps/api` validates commands and coordinates workflows; `apps/worker` runs ingestion, backfills,
  maintenance and scheduled jobs.
- `packages/database` owns the Drizzle schema, migrations, repositories, seed and verify.
  `packages/configuration` owns env validation and the `TRADING_MODE` startup guard.
- One Git repo at the root. Do not add nested `.gitignore` files or run `git init` in subfolders;
  line endings are LF via the root `.gitattributes`.

## Build and dependency model

- Shared packages build with `tsup` to `dist/` (ESM + CJS + d.ts). **Apps and tests consume built
  output, not package source.** Nx `dependsOn: ["^build"]` enforces build order.
- There are deliberately **no tsconfig path aliases** for `@ai-trading/*`. Add a workspace
  dependency and build the package instead.
- `scripts/check-boundaries.mjs` enforces the architecture from the Nx graph and runs as part of
  `pnpm lint`. Its `allowedDependencies` map is the authoritative package contract; update it when
  adding a legitimate dependency.
- Rules: apps never depend on apps; packages/tests never depend on apps; `domain` has no internal
  deps; `strategies` -> `domain`, `trading-engine`; only `adapters` implements `execution-engine`
  broker ports; no package imports NestJS/Next.js/React.

## Commands

```bash
pnpm install
cp .env.example .env          # set DATABASE_URL, SEED_OPERATOR_*, CONFIG_ENCRYPTION_KEY
pnpm docker:up                # Redis Stack only; PostgreSQL is external
pnpm db:migrate && pnpm db:seed && pnpm db:verify
pnpm dev                      # builds all packages, then web:3000, api:8000, worker
```

- On completion run `pnpm lint` (it also runs the boundary check); add `pnpm typecheck`/`pnpm test`
  for the changed area. `pnpm format` is optional. **Do not run `pnpm build` unless requested or
  debugging a build failure.**
- `pnpm dev` runs the three apps, not package watchers. Stop it before starting a single app;
  `pnpm ports` inspects 3000/8000 and `pnpm dev:stop` clears stale listeners.
- Single project: `pnpm nx run-many -t typecheck -p <project>` (or `pnpm nx <target> <project>`).
  Single test file: `pnpm --filter @ai-trading/<package> test -- path/to/file.test.ts`.
- Package watcher: `pnpm --filter @ai-trading/<package> dev`.
- Integration tests: `pnpm --filter @ai-trading/tests test:integration` (starts `postgres:17-alpine`
  via testcontainers, so Docker must be running; independent of the runtime DB).
- Broker contracts: `pnpm --filter @ai-trading/tests test:broker-contracts`.
- E2E (only on explicit request): `pnpm --filter @ai-trading/tests test:e2e`.
- DB: `pnpm db:generate`, `db:migrate`, `db:seed`, `db:verify`, `db:studio`. `db:push` is for
  disposable local databases only — never shared or production.

## Environment and runtime

- The root `.env` is the single source of truth. `apps/*/src/bootstrap-env.ts` and the database
  package's `load-env.ts` load it; inline env vars win.
- `packages/database/client.ts` reads `DATABASE_URL` at **import time**. Anything importing the DB
  package must load `.env` first, or the import throws.
- PostgreSQL is external (`DATABASE_URL` only). Redis comes from `pnpm docker:up`.
- `TRADING_MODE` defaults to `offline`. The API and worker call `assertResearchMode()` at startup
  and refuse anything except `offline` or `research`. The API also refuses to start if an active
  account is not in one of those modes.
- API base is `http://localhost:8000/api/v1`; Swagger is `/api/docs`. Global `SessionAuthGuard`
  protects every route; `@Public()` is only for `GET /health` and `POST /auth/login`.
- `JWT_SECRET`/`JWT_EXPIRES_IN` exist but are unused; auth uses Argon2id + opaque sessions.
- Provider jobs with missing Upstox credentials complete as `succeeded` with
  `result.skipped=true` — that is expected, not a failure.

## Database and migrations

- Migrations are numbered SQL files in `packages/database/migrations/` (`0000`–`0008`). The runner
  records SHA-256 checksums and refuses to run if an applied file changed.
- **Never edit an applied migration**; add a new numbered file. `0001`–`0007` are hand-written
  custom SQL, so point future `drizzle-kit generate` runs at a fresh directory or rename the output
  to the next free number.
- FKs, partial/BRIN indexes, partitions, triggers and the materialized view live in explicit SQL;
  Drizzle schema files cover tables, checks and simple indexes.
- `pnpm db:seed` builds `@ai-trading/domain` first. Running `tsx seed.ts` directly can fail on stale
  package output.
- `pnpm db:verify` expects 61 logical tables, 1 materialized view, >=63 candle partitions, >=15
  quote partitions, 0 live orders, and a parameters binding for every strategy version.

## Framework quirks

- **Next.js 16 is not the Next.js most training data assumes.** Read `apps/web/AGENTS.md` and the
  bundled docs in `apps/web/node_modules/next/dist/docs/` before framework-level changes. Next 16
  uses `src/proxy.ts`, not `middleware`.
- `apps/web/AGENTS.md` is regenerated by `next dev`; keep it committed rather than deleting it from
  a diff.
- The web build must run with `NODE_ENV=production` (already set in the package script); Next 16
  fails to prerender `_global-error` in development mode.
- Toolchain is split: TypeScript 5.9 for web/packages/tests, 6.0 for Nest apps; Vitest 3 for
  web/packages/tests, Vitest 4 for Nest apps. Check the local package before copying config.
- API/worker contain placeholder modules for orders, positions, risk, trading, backtests, reports,
  notifications and market-data. They are **not imported** into `AppModule`; do not describe them as
  active API surface or add order routes in R2.

## Verification gotchas

- Nx caches `build`/`typecheck`/`lint`/`test`. If a change seems ignored, rerun with
  `--skip-nx-cache` before debugging.
- A successful HTTP fetch is not "complete" data: only coverage plus the daily oracle can declare
  completeness (see `docs/operations/data-quality-rules.md`).
- The R2 calendar is a fixture with provisional rows; do not treat it as an authoritative exchange
  calendar until the open checks in `docs/operations/implementation-notes.md` close.

## Source of truth

- `context/` — authoritative specs (R1/R2 plans, architecture, ORB strategy, risk, execution,
  backtesting, roadmap).
- `docs/architecture/` — architecture summary and ADR 0001.
- `docs/operations/` — runbooks, implementation notes, R2 data-quality rules, catalog status.
- `README.md` — quick start, URLs and repository policy.
