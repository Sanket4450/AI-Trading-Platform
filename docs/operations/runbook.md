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
curl -s http://localhost:8000/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
docker compose ps
docker compose exec redis redis-cli ping
```

## Stop

```bash
# Ctrl-C the pnpm dev process, then free any orphaned listeners:
pnpm dev:stop

# Stop the stateful services:
docker compose down
```

## Port already in use

`pnpm dev` already starts web on 3000, the API on 8000 and the worker. Do not start a second API while the full
stack is running.

```bash
pnpm ports      # show what owns 3000/8000
pnpm dev:stop   # stop listeners on 3000/8000
```

## Common failures

| Symptom                          | Check                                                         |
| -------------------------------- | ------------------------------------------------------------- |
| API cannot connect to PostgreSQL | `docker compose ps`, `DATABASE_URL`                           |
| Worker cannot connect to Redis   | `docker compose ps redis`, `REDIS_URL`                        |
| Nx project missing               | `pnpm nx show projects`, then `pnpm nx reset`                 |
| Package not found                | `pnpm install`, then build the package through Nx             |
| Dashboard cannot reach API       | `WEB_URL`, API CORS, port 8000                                |
| `EADDRINUSE` on 3000/8000        | `pnpm ports`, `pnpm dev:stop`, stop duplicate dev processes   |
| Migration fails                  | `pnpm db:generate`, review SQL, never edit applied migrations |

## Incidents

1. Disable new entries with the kill switch / `TRADING_MODE=offline`.
2. Reconcile broker orders and positions before resuming.
3. Preserve logs and the session configuration snapshot.
4. Do not re-enable trading until the risk-limit and order-state checks pass.

Production deployment, static IP registration and Upstox sandbox validation are R6 work and are not performed
by this setup task.

## R1 first-time setup

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

Open `http://localhost:3000`, sign in with the seeded operator, and confirm the overview shows
`OFFLINE`, healthy PostgreSQL and healthy Redis.

## R1 operating checks

```bash
curl http://127.0.0.1:8000/api/v1/health
pnpm db:verify
pnpm --filter @ai-trading/tests test:integration
```

- The API and worker refuse to start unless `TRADING_MODE=offline`.
- No API route writes to `orders`, `fills`, `positions` or `round_trip_trades`.
- Provider jobs with empty `UPSTOX_API_KEY` or `UPSTOX_ACCESS_TOKEN` complete as
  `succeeded` with `result.skipped=true`; this is expected in R1.
- A bounded backfill is limited to `DATA_BACKFILL_MAX_DAYS` (31 by default) and cannot start before
  2022-01-01.
- Rotating a broker credential writes ciphertext only. If `CONFIG_ENCRYPTION_KEY` is missing, the request fails
  rather than storing plaintext.

## R1 recovery

| Symptom                          | Action                                                            |
| -------------------------------- | ----------------------------------------------------------------- |
| API exits with offline assertion | Set `TRADING_MODE=offline` and restart.                           |
| Seed refuses to run              | Set `SEED_OPERATOR_EMAIL` and `SEED_OPERATOR_PASSWORD` in `.env`. |
| Migration checksum mismatch      | Do not edit applied migrations. Add a new numbered SQL migration. |
| Backfill job says skipped        | Populate Upstox credentials, or leave it skipped for offline R1.  |
| Worker queue is unavailable      | Check `docker compose ps redis` and `REDIS_URL`.                  |
| Dashboard redirects to login     | The session expired or the API is down. Check `/api/v1/health`.   |
