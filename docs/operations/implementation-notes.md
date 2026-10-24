# Implementation notes — monorepo setup

The plan of record is `context/monorepo-setup-plan.html`. This note records the versions and deviations that
were observed while executing it.

## Verified toolchain

| Tool              | Installed                                           |
| ----------------- | --------------------------------------------------- |
| Node.js           | 24.19.0 LTS                                         |
| pnpm              | 11.28.8                                             |
| Nx                | 22.7.12                                             |
| Next.js           | 16.4.2                                              |
| React / React DOM | 19.3.0                                              |
| NestJS            | 12.0.1                                              |
| TypeScript        | 5.9.3 (web, packages, tests) and 6.0.3 (Nest apps)  |
| Vitest            | 3.2.7 (web, packages, tests) and 4.1.12 (Nest apps) |
| PostgreSQL        | 17-alpine                                           |
| Redis             | 7.4-alpine                                          |

## Deviations from the plan

1. **pnpm 11 rather than pnpm 12.** The installed Corepack-managed pnpm is 11.28.8. pnpm 11 already uses
   `allowBuilds` and stores workspace settings in `pnpm-workspace.yaml`, so the plan's configuration model is
   preserved.
2. **NestJS 12 rather than NestJS 11.** The current official Nest CLI generates Nest 12 with ESM/NodeNext,
   Vitest 4 and oxlint. The generated layout was kept; ESLint remains the linter for web and packages.
3. **Web build forces `NODE_ENV=production`.** Nx loads the root `.env`, which contains
   `NODE_ENV=development`. Next.js 16 fails to prerender its internal `_global-error` route when the build runs
   with `NODE_ENV=development`. The web build script is therefore `NODE_ENV=production next build`.
4. **`pnpm dev` starts the three apps, not every package watcher.** It first builds the shared packages, then runs
   `web`, `api` and `worker` in parallel. Start a package watcher separately with
   `pnpm --filter @ai-trading/<package> dev` when changing that package.
5. **The root layout keeps the shadcn tooltip provider and toaster.** They build correctly once the web build runs
   in production mode.
6. **The generated app test runners differ.** Nest apps use Vitest 4 and oxlint from the official CLI; web,
   packages and the cross-cutting test project use Vitest 3 and ESLint. Both run through Nx targets.

## Verification performed

```bash
pnpm nx run-many -t typecheck lint test build
pnpm format:check
pnpm dev                 # web :3000, API :4000, worker
curl http://127.0.0.1:4000/api/v1/health
pnpm --filter @ai-trading/tests test:e2e
docker compose ps
pnpm db:generate && pnpm db:migrate
```

All 16 Nx projects pass typecheck, lint, test and build. The Playwright dashboard smoke test passes. PostgreSQL
and Redis report healthy, and the initial `system_heartbeats` migration is applied.
