# Catalog status reference

The instrument catalog is a read model over persisted evidence. It is not a second source of truth.

## Two axes

### Fetch status

| Value           | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `not_requested` | No ingestion job has ever been created.                              |
| `queued`        | The child job exists and has not started.                            |
| `fetching`      | The instrument job is running.                                       |
| `fetched`       | The last job closed successfully; verification may still be pending. |
| `partial`       | The job failed partially, or some tuples were rejected.              |
| `failed`        | Terminal failure: auth, contract or exhausted retries.               |
| `cancelled`     | Stopped by an operator.                                              |
| `stale`         | Was complete, but the latest completed session is not covered.       |

Fetch status is derived from the latest `historical-backfill` run for the instrument, never from
`coverage-recompute` or other instrument-scoped jobs. The projection is marked `queued` when the
request is enqueued and `fetching` when the worker starts, so a long fetch is visible while it runs.
The catalog row also carries `activeJobId`, the queued or running backfill job id, so row actions
follow live queue state instead of the projection. `activeRecomputeJobId` does the same for a
`coverage-recompute` run, so the detail page disables Recompute while its status refresh is in
flight.

### Data status

| Value                | Meaning                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `complete`           | Every expected minute present and no critical issue.                 |
| `partial_mismatch`   | Minutes missing.                                                     |
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
10. Not applicable
11. Complete
12. Not fetched

`succeeded` is not `Complete`. A successful fetch can return HTTP 200 with an empty or short body.
Only strict coverage can produce `complete`.

## Target window

`max(2022-01-01, listed_on)` → the last completed session, capped at `delisted_on`. The badge always
names its window. A stock listed in 2024 cannot claim complete history from 2022.

## Recompute triggers

- Instrument job close: the run reaches its terminal status first, then coverage and the projection
  are recomputed from that status. A run skipped because the provider is not configured is not
  fetch evidence, so it leaves the previous verdict in place.
- T+1 finalization.
- The scheduled quality scan.
- The 08:30 ingestion reconciliation.
- An explicit `POST /instruments/:id/coverage/recompute`.

The catalog never computes status on read.

## Refresh semantics

- Default mode is `missing_only`: complete months are skipped.
- `force` requires a reason, refetches every month in range and records provider revisions.
- Repair is month-granular because the provider returns a whole month per request.
- A second request for an active instrument returns the existing job; the partial unique index
  on `job_runs` enforces one active manual backfill per instrument.
