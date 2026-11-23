# High-level architecture

**As built:** R1 + R2. R3–R9 are planned. See `context/current-implementation.md` for the
authoritative as-built snapshot and `context/deployment-order.md` for release gates.

| Layer                     | Main components                                      | Responsibility                                                                             | Current status |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------- |
| Presentation              | Next.js dashboard                                    | Controls strategies, backtests, risk settings and operating modes                          | R1/R2 delivered as the research cockpit; trading screens are placeholders |
| Application               | NestJS API                                           | Validates commands and coordinates application workflows                                   | R1/R2 delivered: auth, accounts, catalog, coverage, jobs, issues, settings, audit |
| Market data               | Upstox adapter + data ingestion worker               | Retrieves historical data and processes live market updates into normalized market bars    | R2 historical/reference ingestion delivered; live quotes are not implemented |
| Strategy engine           | Strategy registry + strategy interface               | Evaluates market data and emits standardized trading signals                               | Contract exists; ORB implementation is an R3 placeholder returning no signals |
| Risk engine               | Independent risk manager                             | Validates signals, quantity, available capital, stop distance and account-wide risk limits | Not implemented; risk configuration is seeded |
| Execution engine          | Order manager + Upstox execution adapter             | Sends orders, processes fills, handles cancellations and tracks order state                | Not implemented; tables reserved for R5 |
| Backtesting engine        | Historical-data adapter + simulated execution engine | Replays market data using the same strategy rules as live trading                          | Not implemented; `backtest_*` tables reserved for R4 |
| Persistence               | PostgreSQL + Drizzle                                 | Stores durable system, trading and analytical records                                      | R1/R2 delivered: 56 tables, one materialized view, 20 migrations |
| Processing infrastructure | Redis + BullMQ                                       | Runs asynchronous backtests, data retrieval and scheduled processing                       | R2 delivered: BullMQ queues, provider budget, job-event pub/sub; backtest queue is reserved |
| Operations                | Health checks + monitoring                           | Detects stale feeds, unexpected positions, failed orders and unavailable components        | Health, job ledger, issue ledger and outbound-call ledger delivered; metrics/alerts are later |

## Current data flows

### R1/R2 research path

```text
Upstox V3 (read-only)
  -> packages/adapters (budget, retries, error classification, call ledger)
  -> packages/market-data (normalize, IST/UTC, session window, strict coverage, quality rules)
  -> packages/database (candles, raw payloads, coverage, instrument status, system issues)
  -> apps/api (catalog, coverage, issues, jobs, settings, audit)
  -> apps/web (server render + Socket.IO job patches)
```

Work is coordinated by BullMQ jobs. The worker records `job_runs`/`job_run_events` and publishes
facts to Redis; the API forwards them to authenticated dashboards. A successful HTTP fetch is never
displayed as complete; only strict coverage can declare completeness.

### Planned trading path (R5+)

```text
Market data -> normalized bars -> strategy signal -> independent risk validation
  -> order execution -> broker-confirmed fills -> position management -> post-trade analytics
```

The planned path uses the same strategy contract as backtesting, but no part of it is active in R2.
The API exposes no order route and the Upstox adapter exposes no order, modify or cancel method.

## Design consequences

- The system is a modular monolith with a separate worker process, not a microservice fleet.
- Apps consume built package output; packages never import apps and never import NestJS, Next.js or
  React.
- Broker access is confined to `packages/adapters`; strategy code cannot send orders.
- Every backtest and live trade must eventually record its strategy version and configuration
  snapshot; R1 already stores versioned configuration and bindings.
- Live trading remains gated by R6–R8 and is never enabled by a local default.
