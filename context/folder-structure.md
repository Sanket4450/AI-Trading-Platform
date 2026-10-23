ai-trading-system/
│
├── apps/
│ │
│ ├── web/ # Next.js dashboard
│ │ └── src/
│ │ ├── app/
│ │ ├── components/
│ │ ├── features/
│ │ │ ├── strategies/
│ │ │ ├── backtesting/
│ │ │ ├── trading/
│ │ │ ├── risk-management/
│ │ │ ├── performance/
│ │ │ └── system-settings/
│ │ ├── hooks/
│ │ └── lib/
│ │
│ ├── api/ # NestJS HTTP API
│ │ └── src/
│ │ ├── modules/
│ │ │ ├── strategies/
│ │ │ ├── backtests/
│ │ │ ├── market-data/
│ │ │ ├── trading/
│ │ │ ├── orders/
│ │ │ ├── risk/
│ │ │ ├── positions/
│ │ │ ├── reports/
│ │ │ ├── notifications/
│ │ │ └── system-control/
│ │ ├── common/
│ │ └── main.ts
│ │
│ └── worker/ # NestJS background workers
│ └── src/
│ ├── workers/
│ │ ├── historical-data/
│ │ ├── live-market-data/
│ │ ├── strategy-evaluation/
│ │ ├── backtest-execution/
│ │ ├── order-reconciliation/
│ │ ├── post-trade-analytics/
│ │ └── end-of-day-square-off/
│ ├── queues/
│ ├── schedulers/
│ └── main.ts
│
├── packages/
│ │
│ ├── domain/ # Shared domain contracts
│ │ ├── entities/
│ │ ├── value-objects/
│ │ ├── events/
│ │ └── types/
│ │
│ ├── trading-engine/ # Strategy execution framework
│ │ ├── contracts/
│ │ ├── registry/
│ │ ├── signal-processing/
│ │ └── indicators/
│ │
│ ├── strategies/ # Independently extensible strategies
│ │ ├── opening-range-breakout/
│ │ └── [future-strategies]/
│ │
│ ├── risk-engine/ # Independent risk enforcement
│ │ ├── position-sizing/
│ │ ├── risk-policies/
│ │ ├── exposure-controls/
│ │ └── kill-switch/
│ │
│ ├── execution-engine/ # Broker-independent execution
│ │ ├── order-management/
│ │ ├── order-state/
│ │ ├── position-management/
│ │ └── execution-modes/
│ │
│ ├── backtesting/ # Historical simulation
│ │ ├── historical-replay/
│ │ ├── simulated-execution/
│ │ ├── cost-models/
│ │ ├── slippage-models/
│ │ └── performance-metrics/
│ │
│ ├── market-data/ # Normalized market data
│ │ ├── models/
│ │ ├── normalization/
│ │ ├── validation/
│ │ └── instrument-universe/
│ │
│ ├── adapters/
│ │ ├── upstox/
│ │ │ ├── market-data/
│ │ │ ├── order-execution/
│ │ │ ├── order-updates/
│ │ │ └── sandbox/
│ │ └── simulated-broker/
│ │
│ ├── database/ # PostgreSQL + Drizzle
│ │ ├── schema/
│ │ ├── migrations/
│ │ └── repositories/
│ │
│ ├── configuration/ # Validated, versioned settings
│ │ ├── strategies/
│ │ ├── risk/
│ │ └── trading-modes/
│ │
│ ├── notifications/ # Alerts and notifications
│ └── observability/ # Logging, metrics and monitoring
│
├── tests/
│ ├── integration/
│ ├── end-to-end/
│ ├── broker-contracts/
│ └── fixtures/
│
├── infra/
│ ├── docker/
│ ├── compose/
│ └── azure/
│
├── docs/
│ ├── architecture/
│ ├── strategies/
│ └── operations/
│
├── drizzle.config.ts
├── package.json
├── tsconfig.base.json
├── docker-compose.yml
├── .env.example
└── README.md
