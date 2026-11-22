# Job ledger

Operational timeline for every worker job. It answers three questions:

1. What is running now, and at which stage?
2. What happened, in order, with timestamps and figures?
3. What was the final outcome?

`job_runs` is the run envelope; `job_run_events` is append-only. There is **one
`job_runs` row per BullMQ job**: `job_runs.id` is the BullMQ `jobId`. No synthetic
parent rows exist.

## `job_runs`

| Column | Meaning |
| --- | --- |
| `id` | uuidv7, also the BullMQ `jobId` |
| `job_name` | BullMQ name; the queue is derived from it |
| `status` | `queued`, `running`, `succeeded`, `failed`, `partially_failed`, `cancelled` |
| `instrument_id` | Typed scope for instrument-bounded jobs; nullable |
| `attempt`, `max_attempts` | Mirrors `attemptsMade` and `opts.attempts` |
| `payload`, `result`, `error` | Input, terminal totals, structured failure |
| `latest_event_id` | Pointer to the newest event (fast list reads) |
| `created_at`, `started_at`, `finished_at` | Run timing; duration is derived |

`error` is `{ code, message, retryable?, details? }`. There is no `error_message`,
`summary`, `current_stage`, `stage_keys`, `stage_total`, `duration_ms`,
`scheduled_for`, `correlation_id` or `job_type`; each was either derivable or
duplicated an event. `job_type` and the stage list come from the job catalog in
`packages/domain/jobs.ts`.

### Status mapping

| Ledger status | BullMQ source |
| --- | --- |
| `queued` | `waiting`, `delayed`, `prioritized`, `waiting-children` |
| `running` | `active` |
| `succeeded` | `completed` |
| `failed` | `failed` |
| `cancelled` | domain: cooperative cancellation between units |
| `partially_failed` | domain: some units failed without the handler throwing |

A `queued` row can also be closed by `ingestion-reconcile` when BullMQ no longer holds a live job
for it: the row is marked `failed` with `error.code = 'stale_job'`, or mirrors the queue's terminal
state when the run actually finished and only the ledger fell behind. Rows still waiting or delayed
in the queue are left alone.

## `job_run_events`

Six columns only:

| Column | Meaning |
| --- | --- |
| `id` | Ordering key; survives retries |
| `job_run_id` | Owning run |
| `stage` | Fixed stage key from the catalog |
| `type` | `entered`, `progress`, `completed`, `failed`, `skipped`, `warning` |
| `occurred_at` | Application timestamp |
| `data` | Figures and machine codes; never prose |

`stage` says where; `type` says what happened there. One `progress` event is
recorded per month chunk, instrument, repair or scan unit, with `index`/`total`
and the figures that belong to that unit. The UI composes messages from
`type` + `data`; the database stores no `message`, `kind`, `level` or metric
columns.

Secrets are redacted before insert. Raw provider bodies are never stored here.

## Job catalog

`packages/domain/jobs.ts` declares the queue, type and ordered stages for all 11
jobs:

| Job | Stages |
| --- | --- |
| `instrument-sync` | `fetch → normalize → persist → finalize` |
| `calendar-sync` | `fixture → reconcile → finalize` |
| `historical-backfill` | `prepare → chunks → finalize` |
| `historical-finalize` | `prepare → repair → refresh` |
| `intraday-sync` | `prepare → instruments → finalize` |
| `coverage-recompute` | `prepare → instruments → finalize` |
| `coverage-rebuild` | `clear → instruments → finalize` |
| `quality-scan` | `scan → stale → finalize` |
| `ingestion-reconcile` | `sweep → issues → finalize` |
| `refresh-materialized-view` | `refresh` |
| `ensure-partitions` | `ensure` |

Adding a job or a stage means editing the catalog and the database check
constraint in the same change.

## Worker wiring

`apps/worker/src/observability` wraps every BullMQ processor:

- `JobTrackingService.run` begins the run (first stage entered), closes the open
  stage on success or failure, and writes the structured error.
- Services call `enterStage`, `progress`, `completeStage` and `warning`.
- `JobStoreService` writes to Postgres and publishes each change to the
  `ai-trading:job-events` Redis channel.
- `packages/observability` owns buffering, redaction and best-effort writes. A
  tracking failure logs once and never fails the job.

## Realtime

The API `JobsGateway` subscribes to the Redis channel and emits `job` messages on
the `/jobs` socket namespace. Messages are `{ type: 'run' | 'event', ... }`.
The dashboard keeps the server render as truth and patches visible rows and the
detail timeline from the stream.

## API and dashboard

- `GET /api/v1/jobs` returns the summary plus runs with their latest event and
  derived progress. Supports `status`, `search`, `instrumentId` and `limit`.
- `GET /api/v1/jobs/:id` returns the run, derived stage rail, events and progress.
- `POST /api/v1/jobs/:id/cancel` marks one run cancelled and removes it from
  BullMQ when it is still waiting.
- `/jobs` lists runs with live progress; `/jobs/[id]` shows the stage rail and
  timeline live. The instrument detail page shows the latest fetch run.

## Retention

Not enabled yet. When event volume requires it, prune from the maintenance
worker:

```sql
DELETE FROM job_run_events WHERE occurred_at < now() - interval '30 days';
```

The `latest_event_id` pointer is never pruned because it always references the
newest row.
