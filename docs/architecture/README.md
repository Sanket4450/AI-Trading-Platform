# Architecture

The system is a modular monolith with a separate worker process.

- `apps/web` is the only browser-facing surface and calls the API over HTTP.
- `apps/api` validates commands and coordinates workflows.
- `apps/worker` runs ingestion, strategy evaluation, backtests, reconciliation and scheduled processing.
- `packages/domain` owns the shared vocabulary: entities, value objects, events and types.
- `packages/trading-engine` defines the strategy contract and registry.
- `packages/strategies` contains independently versioned strategy implementations.
- `packages/risk-engine` enforces position sizing, exposure and kill-switch rules.
- `packages/execution-engine` owns order and position state plus broker ports.
- `packages/adapters` implements those ports for Upstox and the simulated broker.
- `packages/backtesting` replays history through the same strategy and risk contracts.
- `packages/database` owns the Drizzle schema, migrations and repositories.
- `packages/configuration` validates and snapshots versioned settings.
- `packages/notifications` and `packages/observability` are cross-cutting platform packages.

## Dependency rules

1. Apps never import other apps.
2. Packages never import apps.
3. `domain` has no internal dependencies.
4. `execution-engine` defines broker ports; only `adapters` implements them.
5. `strategies` depends only on `domain` and `trading-engine`.
6. No package imports NestJS, Next.js or React.
7. Trading mode comes from validated configuration, never from a strategy or adapter.

These rules are enforced by `scripts/check-boundaries.mjs`, which runs as part of `pnpm lint` (or directly with
`pnpm boundaries`) using the Nx project graph.

## Source material

The authoritative specifications live in the repository's `context/` folder:

- `high-level-architecture.md`
- `tech-stack.md`
- `design-patterns.md`
- `strategy1.md`
- `risk-management.md`
- `trade-execution.md`
- `backtesting.md`
- `deployment-order.md`
