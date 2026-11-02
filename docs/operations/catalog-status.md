# Catalog status reference

The instrument catalog is a read model over persisted evidence. It is not a second source of truth.

## Two axes

### Fetch status

| Value           | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `not_requested` | No run has ever been created.                                        |
| `queued`        | The child job exists and has not started.                            |
| `fetching`      | At least one chunk is in progress.                                   |
| `fetched`       | The last run closed successfully; verification may still be pending. |
| `partial`       | Some chunks failed, were rejected or have no run.                    |
| `failed`        | Terminal failure: auth, contract or exhausted retries.               |
| `cancelled`     | Stopped by an operator between chunks.                               |
| `stale`         | Was complete, but the latest completed session is not covered.       |

### Data status

| Value                | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `complete`           | Every expected minute present and no critical issue.                 |
| `partial_reconciled` | Minutes missing, but the daily oracle proves no trades were lost.    |
| `partial_mismatch`   | Minutes missing and the oracle disagrees or has not confirmed.       |
| `missing`            | Zero bars on at least one scheduled trading day.                     |
| `pending`            | The rollup was written before verification finished.                 |
| `not_applicable`     | Every day in the window is a holiday, suspension or pre-listing.     |
| `needs_review`       | An open critical issue or unresolved reference problem blocks trust. |

## Display precedence

The catalog shows one badge, in this order:

1. Failed
2. Stopped
3. Fetching
4. Queued
5. Verifying
6. Needs review
7. Missing
8. Gaps · mismatch
9. Stale
10. Gaps · reconciled
11. Not applicable
12. Complete
13. Not fetched

`succeeded` is not `Complete`. A chunk can return HTTP 200 with an empty or short body. Only coverage
plus the daily oracle can produce `complete`.

## Target window

`max(2022-01-01, listed_on)` → the last completed session, capped at `delisted_on`. The badge always
names its window. A stock listed in 2024 cannot claim complete history from 2022.

## Recompute triggers

- Chunk close.
- T+1 finalization.
- The scheduled quality scan.
- The 08:30 ingestion reconciliation.
- An explicit `POST /data/instrument-status/recompute`.

The catalog never computes status on read.

## Refresh semantics

- Default mode is `missing_only`: complete months are skipped.
- `force` requires a reason, refetches every month in range and records provider revisions.
- Repair is month-granular because the provider returns a whole month per request.
- A second request for an active instrument returns the existing run; the partial unique index
  enforces one active manual backfill per instrument.
