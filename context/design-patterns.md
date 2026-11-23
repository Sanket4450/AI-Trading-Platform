# Design patterns

| Pattern                  | Application                            | Required design outcome                                                                              | Current realization |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------- |
| Strategy pattern         | Trading strategies                     | New strategies can be added without modifying existing strategy logic                                | Contract exists in `packages/trading-engine`; `opening-range-breakout` is a placeholder returning `[]` until R3 |
| Plug-in registry         | Strategy engine                        | Strategies can be independently enabled, disabled, configured and versioned                          | Strategy versions and configuration bindings are stored in R1; the runtime registry is R3 |
| Ports and adapters       | Market data and broker integrations    | Upstox can be replaced or supplemented without changing strategy logic                               | `packages/adapters` owns the read-only Upstox client and rate-limiter interface; broker ports are R5 |
| Modular monolith         | NestJS application                     | Clear module boundaries without premature microservice complexity                                    | 16 Nx projects with `scripts/check-boundaries.mjs` enforcing the dependency contracts |
| Event-driven processing  | Signals, orders, fills and risk events | Components communicate through standardized events and persist important state transitions           | `domain_events`, `job_run_events` and Redis job broadcasts are delivered; order/fill/risk events are reserved |
| Shared strategy contract | Backtesting and live execution         | One strategy implementation serves both environments, preventing separate signal logic from drifting | The contract is shared, but backtesting and live execution are not implemented |
| Independent risk policy  | Risk engine                            | No strategy can bypass portfolio limits or send orders directly to the broker                        | Risk config is seeded and `risk-engine` is a placeholder; enforcement is R5 |
| Versioned configuration  | Strategies and risk rules              | Every backtest and live trade records the exact configuration and strategy version used              | Delivered in R1: configuration versions, bindings and activation records |

## Current boundary rules

- Apps never depend on apps.
- Packages and tests never depend on apps.
- `domain` has no internal dependencies.
- `trading-engine` depends only on `domain`; `strategies` depends on `domain` and `trading-engine`.
- `execution-engine` defines broker ports; only `adapters` implements them.
- `market-data` depends only on `domain`; `adapters` may depend on `domain`, `market-data` and
  `execution-engine`.
- `database` and `configuration` depend only on `domain`.
- No package imports NestJS, Next.js or React.

The allowed map in `scripts/check-boundaries.mjs` is the authoritative contract; update it when a
legitimate dependency changes.

## As-built notes

- The event-driven surface that actually runs in R2 is the job ledger plus Redis pub/sub. It is not
  a general trading event bus.
- Versioned configuration is the strongest delivered design pattern: every strategy version has a
  `parameters` binding, and the API exposes an effective-config lookup.
- The strategy, risk, execution and backtesting patterns are deliberately scaffolded, not claimed
  as working features.
