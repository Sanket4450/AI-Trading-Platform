# Operations runbook

## Local start

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm dev
```

## Health checks

```bash
curl -s http://localhost:4000/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
docker compose ps
docker compose exec redis redis-cli ping
```

## Stop

```bash
# Ctrl-C the pnpm dev process, then:
docker compose down
```

## Common failures

| Symptom                          | Check                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| API cannot connect to PostgreSQL | `docker compose ps`, `DATABASE_URL`                           |
| Worker cannot connect to Redis   | `docker compose ps redis`, `REDIS_URL`                        |
| Nx project missing               | `pnpm nx show projects`, then `pnpm nx reset`                 |
| Package not found                | `pnpm install`, then build the package through Nx             |
| Dashboard cannot reach API       | `WEB_URL`, API CORS, port 4000                                |
| Migration fails                  | `pnpm db:generate`, review SQL, never edit applied migrations |

## Incidents

1. Disable new entries with the kill switch / `TRADING_MODE=offline`.
2. Reconcile broker orders and positions before resuming.
3. Preserve logs and the session configuration snapshot.
4. Do not re-enable trading until the risk-limit and order-state checks pass.

Production deployment, static IP registration and Upstox sandbox validation are R6 work and are not performed
by this setup task.
