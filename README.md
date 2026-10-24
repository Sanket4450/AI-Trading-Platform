# AI Trading System

Modular monolith for NSE strategy research, backtesting, risk control and controlled live execution.

## Workspace

- `apps/web` — Next.js dashboard
- `apps/api` — NestJS HTTP API
- `apps/worker` — NestJS background processing
- `packages/*` — framework-agnostic domain and platform packages
- `tests/*` — integration, end-to-end and broker-contract suites
- `infra/*` — Docker, Compose and Azure assets
- `context/*` — specifications and architecture source material

## Repository policy

- There is exactly **one Git repository**, at the workspace root.
- Do not run `git init` inside `apps/`, `packages/`, `tests/` or `infra/`.
- All ignore rules live in the root `.gitignore`; app and package folders must not add their own.
- Line-ending policy is centralised in the root `.gitattributes`.

## Quick start

```bash
pnpm install
cp .env.example .env
# Fill SEED_OPERATOR_EMAIL, SEED_OPERATOR_PASSWORD and CONFIG_ENCRYPTION_KEY.
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm db:verify
pnpm dev
```

| Service    | URL                            |
| ---------- | ------------------------------ |
| Dashboard  | http://localhost:3000          |
| API        | http://localhost:8000/api/v1   |
| Swagger    | http://localhost:8000/api/docs |
| PostgreSQL | localhost:5432                 |
| Redis      | localhost:6379                 |

## If a port is already in use

`pnpm dev` already starts web, API and worker. Stop it before starting a single app.

```bash
pnpm ports      # inspect listeners on 3000/8000
pnpm dev:stop   # stop stale listeners on 3000/8000
```

## R1 dashboard

The R1 cockpit has nine routes: `/`, `/accounts`, `/instruments`, `/universes`, `/strategies`,
`/configuration`, `/data`, `/audit` and `/settings`. Sign in with the operator created by
`pnpm db:seed`. The API and worker refuse to start outside `offline` mode.

## Guardrails

- `TRADING_MODE` defaults to `offline`.
- Live trading is gated by R6–R8 and is never enabled by a local default.
- Never commit `.env`.
- Strategies may not import broker adapters or send orders directly.
- Every backtest and live trade records its strategy version and configuration snapshot.

See `context/` for the architecture, strategy, risk, execution and backtesting specifications.
See `context/monorepo-setup-plan.html` for the full setup plan and
`context/development-commands.html` for the searchable command deck.
