# Folder structure (as built)

```text
ai-trading-system/
├── apps/
│   ├── web/                         # Next.js 16 dashboard
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (dashboard)/
│   │       │   │   ├── (overview)/            # /
│   │       │   │   ├── accounts/              # list + [id]
│   │       │   │   ├── api-calls/             # provider-call ledger
│   │       │   │   ├── audit/
│   │       │   │   ├── instruments/           # list + [id] + coverage/[date]
│   │       │   │   ├── issues/                # list; detail is a dialog
│   │       │   │   ├── jobs/                  # list + [id]
│   │       │   │   ├── settings/
│   │       │   │   └── strategies/            # list + [id]
│   │       │   ├── api/
│   │       │   │   ├── auth/                  # login, logout, session-expired
│   │       │   │   └── proxy/[...path]/       # browser -> API proxy
│   │       │   ├── login/
│   │       │   └── service-unavailable/
│   │       ├── components/                    # shell, dashboard and ui primitives
│   │       ├── features/
│   │       │   ├── audit/                     # implemented
│   │       │   ├── issues/                    # implemented
│   │       │   ├── jobs/                      # implemented
│   │       │   ├── backtesting/               # placeholder (.gitkeep)
│   │       │   ├── performance/               # placeholder
│   │       │   ├── risk-management/           # placeholder
│   │       │   ├── strategies/                # placeholder
│   │       │   ├── system-settings/           # placeholder
│   │       │   └── trading/                   # placeholder
│   │       ├── hooks/
│   │       ├── lib/                           # API clients, formatting, routes, realtime
│   │       ├── styles/
│   │       ├── test/
│   │       └── proxy.ts                       # Next 16 route protection
│   │
│   ├── api/                         # NestJS 12 HTTP API
│   │   └── src/
│   │       ├── common/                        # auth, DTOs, pagination, security, swagger
│   │       ├── modules/
│   │       │   ├── accounts/                  # active
│   │       │   ├── api-calls/                 # active
│   │       │   ├── audit/                     # active
│   │       │   ├── auth/                      # active
│   │       │   ├── configuration/             # active
│   │       │   ├── instruments/               # active: master, coverage, catalog, ingestion
│   │       │   ├── issues/                    # active
│   │       │   ├── jobs/                      # active: ledger, events, socket gateway
│   │       │   ├── settings/                  # active: runtime settings + provider commands
│   │       │   ├── strategies/                # active: versions and effective config
│   │       │   ├── system-control/            # active: health, overview, system feeds
│   │       │   ├── backtests/                 # placeholder, no routes, not imported
│   │       │   ├── market-data/               # placeholder, no routes, not imported
│   │       │   ├── notifications/             # placeholder, no routes, not imported
│   │       │   ├── orders/                    # placeholder, no routes, not imported
│   │       │   ├── positions/                 # placeholder, no routes, not imported
│   │       │   ├── reports/                   # placeholder, no routes, not imported
│   │       │   ├── risk/                      # placeholder, no routes, not imported
│   │       │   └── trading/                   # placeholder, no routes, not imported
│   │       ├── app.module.ts
│   │       └── main.ts
│   │
│   └── worker/                      # NestJS 12 background worker
│       └── src/
│           ├── observability/                 # job tracking, event publisher, call recorder
│           ├── queues/
│           ├── schedulers/                    # market.scheduler.ts
│           ├── workers/
│           │   ├── historical-data/           # active: ingestion, coverage, quality, sync
│           │   ├── maintenance/               # active: view refresh, partitions, retention
│           │   ├── backtest-execution/        # placeholder, not registered
│           │   ├── end-of-day-square-off/     # placeholder, not registered
│           │   ├── live-market-data/          # placeholder, not registered
│           │   ├── order-reconciliation/      # placeholder, not registered
│           │   ├── post-trade-analytics/      # placeholder, not registered
│           │   └── strategy-evaluation/       # placeholder, not registered
│           ├── app.module.ts
│           └── main.ts
│
├── packages/
│   ├── adapters/                    # read-only Upstox V3, error classification, rate limiter
│   ├── backtesting/                 # R4 placeholder
│   ├── configuration/               # env validation, JSON schema, config hashing
│   ├── database/                    # Drizzle schema, migrations, repositories, seed, verify
│   │   ├── migrations/              # 0000–0019
│   │   ├── repositories/
│   │   ├── schema/
│   │   ├── fixtures/nse.ts
│   │   ├── client.ts
│   │   ├── migrate.ts
│   │   ├── seed.ts
│   │   └── verify.ts
│   ├── domain/                      # shared types, queues, job catalog, hashing, pricing
│   ├── execution-engine/            # R5 placeholder
│   ├── market-data/                 # normalization, sessions, coverage, quality, catalog
│   ├── notifications/               # placeholder
│   ├── observability/               # framework-agnostic job tracker
│   ├── risk-engine/                 # R5 placeholder
│   ├── strategies/                  # ORB contract placeholder
│   └── trading-engine/              # strategy contract
│
├── tests/
│   ├── broker-contracts/            # no-order guarantee, strategy contract
│   ├── end-to-end/                  # Playwright dashboard smoke test
│   ├── fixtures/
│   ├── integration/                 # testcontainers PostgreSQL, configuration
│   └── playwright.config.ts
│
├── infra/
│   ├── azure/                       # R6+ placeholder notes
│   └── docker/                      # Redis Compose file and app Dockerfiles
│
├── docs/
│   ├── architecture/                # architecture summary and ADR 0001
│   ├── operations/                  # runbooks, ledger, catalog, issues, schema audit
│   └── strategies/                  # opening-range-breakout notes
│
├── context/                         # specs, plans and the as-built snapshot
├── scripts/                         # boundary check, port and dev-stop helpers
├── collections/                     # HTTP request collection
├── .env.example
├── nx.json
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Notes

- `packages/*` build to `dist/`; apps consume built output. There are no tsconfig path aliases for
  `@ai-trading/*`.
- The active API modules are the eleven listed above. The placeholder modules keep their controllers
  and tables for later releases but are not imported into `AppModule`.
- The worker registers only `HistoricalDataModule` and `MaintenanceModule`. The other worker folders
  are placeholders for R4/R5.
- The dashboard's feature folders for backtesting, performance, risk, strategies, system settings
  and trading contain only `.gitkeep` files; the strategy and account screens are built directly
  under `app/`.
- There is one Git repository at the root. Do not add nested `.gitignore` files.
