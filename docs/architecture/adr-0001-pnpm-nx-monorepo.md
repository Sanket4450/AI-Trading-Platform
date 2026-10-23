# ADR 0001 — pnpm workspaces with Nx orchestration

## Status

Accepted.

## Context

The system needs a dashboard, an HTTP API, a background worker and a set of shared domain packages.
The shared strategy contract must run unchanged in backtesting and live execution. The repository must stay
understandable as a modular monolith rather than splitting into microservices prematurely.

## Decision

- Use pnpm workspaces with one lockfile and `workspace:*` links.
- Use Nx for the project graph, affected commands and local task cache.
- Create apps with their official CLIs (`create-next-app`, `@nestjs/cli`) so each app stays close to its
  framework's documented structure.
- Register each app/package with a thin `project.json` that delegates to its package scripts.
- Keep shared packages framework-agnostic and build them with tsup into ESM and CJS with declarations.

## Alternatives considered

- **Nx generators for every app**: more coupled to Nx plugin versions; rejected because the team wants the
  official framework layouts.
- **npm workspaces**: viable, but pnpm's strict linking and workspace filtering are preferred.
- **Turborepo**: simpler pipelines, but Nx's graph and affected model fit the planned validation gates better.
- **Microservices**: rejected for the initial release; operational overhead is not justified by the workload.

## Consequences

- The lockfile is the single source of dependency truth.
- Apps consume built package output; `dependsOn: ["^build"]` enforces build order.
- No tsconfig path aliases for package names, to avoid source/runtime drift.
- Nx project tags prevent app-to-app and package-to-app imports.
- Upgrading Next.js, NestJS or Nx is a deliberate migration, not an automatic floating update.
