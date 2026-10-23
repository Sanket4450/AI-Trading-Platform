# Azure deployment notes (R6+)

This folder is a placeholder. Do not provision production infrastructure during the setup milestone.

## Host

- Ubuntu 24.04 LTS on an Azure Linux VPS.
- Docker Engine plus the Compose plugin.
- A registered static public IP attached before Upstox API validation. The broker requires a stable source IP.

## Network

- Reverse proxy (Caddy or Nginx) owns ports 80/443.
- Only the proxy is publicly reachable; API, worker, PostgreSQL and Redis stay on the private network.
- Restrict SSH to the operator's addresses.
- Keep the host and containers on UTC; convert to `Asia/Kolkata` at the market boundary.

## Secrets

- Inject environment variables from the host or a secret store.
- Never bake `.env` into an image or copy it into the repository.
- Rotate broker tokens and `JWT_SECRET` on a defined schedule.

## Data

- PostgreSQL: Neon in production, with a pooled connection string and `sslmode=require`.
- Redis: managed instance or a dedicated container with append-only persistence and `noeviction`.
- Back up the database before every schema migration and retain the session configuration snapshots.

## Release gates

Follow `context/deployment-order.md`: R6 covers sandbox integration, production authentication, static IP and
algo-compliance setup. R7 covers paper-trading validation. R8 is the first controlled live deployment.
