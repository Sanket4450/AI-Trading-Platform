# System issues

`system_issues` is a current-state ledger: **one active problem per row**. When the operation that
raised a problem runs again and succeeds, it deletes its row. There is no status, acknowledgement or
resolution lifecycle, and there is no history table.

## Row identity

| Column | Meaning |
| ------ | ------- |
| `source` | Mechanism that raised it: `ingestion`, `validation`, `reconciliation`, `manual`, and future `backtest`, `risk`, `execution`. |
| `kind` | Problem code: `candle_fetch_failed`, `missing_bar`, `gap`, `invalid_ohlc`, … |
| `severity` | `info`, `warning` or `critical`. |
| `provider_id` / `instrument_id` | Scope. Instrument rows have `instrument_id`; provider-wide rows have only `provider_id`; system rows have neither. |
| `dedupe_key` | `sha256(source, kind, provider_id, instrument_id, stableJson(scope))`. Unique. |
| `occurrence_count` | Repeat detections of the same problem while it stays active. |
| `first_seen_at` / `last_seen_at` | First and latest detection. |
| `payload` | Mechanism-specific structure. Holds the window, chunk, error, expected/observed/unknown state. |

The JSON payload is the extension point: a new detector writes its own keys and a `scope` object for
identity, without a schema change.

## Clear-on-success

A row is evidence of a **currently** failing condition. The detector must delete it when the
condition is verified fixed:

- A failed candle chunk that later succeeds deletes the matching `candle_fetch_failed` row by
  `dedupe_key`.
- A coverage recompute clears that instrument-day's validation findings, then raises only the ones
  that are still true.
- Reconciliation detectors clear their own `kind` for the instrument before re-evaluating.

A partially failed or failed run deletes nothing.

## Kinds

| Kind | Source | Severity | Detection |
| ---- | ------ | -------- | --------- |
| `candle_fetch_failed` | ingestion | warning / critical | A provider candle call exhausted its retries; fatal classifications are critical. |
| `schema_invalid` | ingestion | critical | The response envelope or tuple shape is not the documented contract. |
| `mapping_missing` | ingestion | critical | No primary provider mapping exists. |
| `calendar_mismatch` | ingestion, validation, reconciliation | critical | Candles contradict the reviewed calendar or session window. |
| `invalid_ohlc` | validation | critical | A tuple is structurally invalid and was rejected. |
| `duplicate_bar` | validation | warning | The same timestamp appears more than once with conflicting values. |
| `tick_size_mismatch` | validation | warning | A price is not aligned to the instrument tick size. |
| `provider_revision` | validation | warning | A refetch changed an existing final bar. |
| `partial_bar` | validation | info | The current session's final bar is not final. |
| `missing_bar` | validation | warning | An expected session minute is absent. |
| `gap` | validation | warning / critical | Consecutive missing minutes; critical inside protected windows. |
| `coverage_shortfall` | validation | critical | A scheduled trading day has zero bars. |
| `stale_coverage` | reconciliation | info | A coverage verdict is older than the latest candle for the same instrument-day. |
| `stale_ingestion` | reconciliation | warning | No successful ingestion within the freshness window. |
| `stale_job` | reconciliation | warning | A running chunk exceeded the heartbeat window and was recovered. |
| `corporate_action_mismatch` | reconciliation | critical | A discontinuity implies an unconfirmed corporate action. |
| `duplicate_mapping` | reconciliation | warning | More than one primary mapping resolves to an instrument. |
| `unsupported_instrument` | reconciliation | info | The instrument type or segment is outside the R2 whitelist. |

## Coverage

Strict coverage is the only completeness verdict: `complete`, `partial`, `missing`.

`instrument_day_coverage` holds one row per instrument per expected trading day: `expected_bars`,
`stored_bars` and `checked_at`. Missing minutes are `expected_bars - stored_bars`; they are never
stored. A missing minute is never filled with a flat bar.

## Preflight policy (R4)

R4 accepts `complete` unconditionally. A `critical` `system_issues` row for the instrument-day blocks
the preflight until the gap is repaired, the row is cleared and coverage is recomputed as `complete`.
