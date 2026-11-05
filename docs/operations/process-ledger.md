# Process ledger

Operational timeline for every worker job. It answers three questions:

1. What is running now, and in which stage?
2. What happened, in order, with timestamps?
3. What were the important figures and the final outcome?

The ledger reuses `job_runs` as the run envelope. It does not create a second
run table, so scheduling, cancellation and business results keep their existing
owner.

## Tables

`job_runs` gains `current_stage`, `stage_keys`, `stage_total`, `duration_ms` and
`summary`.

`job_run_events` is append-only:

| Column | Meaning |
| --- | --- |
| `occurred_at` | Application timestamp, `timestamptz` |
| `kind` | `lifecycle`, `stage`, `step`, `metric`, `warning`, `error` |
| `level` | `debug`, `info`, `warn`, `error` |
| `stage_key` | Stage the event belongs to |
| `message` | Operator-facing line |
| `data` | Sanitized structured detail |
| `metric_key`, `metric_value`, `metric_unit` | Queryable figures |

`id` is the ordering key and survives BullMQ retries. Secrets are redacted
before insert; raw provider bodies are never stored here.

## Worker wiring

`apps/worker/src/observability` wraps every BullMQ processor:

- `ProcessTrackingService.run` starts the run, drives the generic
  `start → work → finish` rail, and closes it on success or failure.
- `historical-backfill` opts into `prepare → chunks → close` and reports one
  step per chunk plus row counts.
- `packages/observability` owns buffering, redaction and best-effort writes. A
  tracking failure logs once and never fails the job.

Adding a new domain stage means adding an entry to `process-stages.ts`, calling
`enterStage`/`completeStage` (or `stage`) from the service, and optionally
recording metrics with `metric`.

## API and dashboard

- `GET /api/v1/processes` returns the summary and recent runs.
- `GET /api/v1/processes/:id` returns the run, derived stages, latest metrics
  and the last 500 events.
- `/processes` lists runs and polls only while a visible run is active.
- `/processes/[id]` renders the stage rail, the metric strip, the timestamped
  timeline and the payload/result.

## Retention

Not enabled yet. When event volume requires it, prune from the maintenance
worker:

```sql
DELETE FROM job_run_events WHERE occurred_at < now() - interval '30 days';
```
