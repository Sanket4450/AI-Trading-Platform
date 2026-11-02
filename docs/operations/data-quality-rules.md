# R2 data-quality rules

One real problem becomes one issue. A finding carries a stable rule ID, a severity, evidence and a
dedupe key. The rule catalog is exposed at `GET /api/v1/data/quality-rules`.

## Dimensions

| Dimension    | Question                                                | Blocks a backtest?    |
| ------------ | ------------------------------------------------------- | --------------------- |
| Validity     | Is this row structurally legal?                         | Yes, when critical    |
| Completeness | Did every expected minute arrive?                       | Yes, when unexplained |
| Consistency  | Does the minute aggregate agree with the daily witness? | Yes, when critical    |
| Reference    | Do we know what this instrument is?                     | Yes, when critical    |
| Timeliness   | Is the data fresh and the run healthy?                  | Usually warning       |

## Rules

| Rule   | Issue type                  | Default severity   | Detection                                                                             |
| ------ | --------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| DQ-001 | `missing_bar`               | warning            | An expected session minute is absent.                                                 |
| DQ-002 | `gap`                       | warning / critical | Two or more consecutive missing minutes; critical in protected windows.               |
| DQ-003 | `coverage_shortfall`        | critical           | A scheduled trading day has zero bars or a volume shortfall.                          |
| DQ-004 | `partial_bar`               | info               | The current session's final bar is not final.                                         |
| DQ-005 | `calendar_mismatch`         | critical           | Candles contradict the reviewed calendar or session window.                           |
| DQ-006 | `missing_bar`               | warning            | The first or last expected minute is absent.                                          |
| DQ-007 | `invalid_ohlc`              | critical           | A tuple is structurally invalid and was rejected.                                     |
| DQ-008 | `schema_invalid`            | critical           | The response envelope or tuple shape is not the documented contract.                  |
| DQ-009 | `duplicate_bar`             | warning            | The same timestamp appears more than once with conflicting values.                    |
| DQ-010 | `outlier`                   | warning            | A minute extreme is outside the daily range or an unexplained jump occurred.          |
| DQ-011 | `tick_size_mismatch`        | warning            | A price is not aligned to the instrument tick size.                                   |
| DQ-012 | `volume_mismatch`           | critical / warning | Minute volume differs from the daily volume beyond tolerance.                         |
| DQ-013 | `volume_reconciled`         | info               | Missing minutes had no trades; the daily volume proves it.                            |
| DQ-014 | `outlier`                   | warning            | The minute aggregate differs from the daily candle by more than one tick.             |
| DQ-015 | `provider_revision`         | warning            | A refetch changed an existing final bar.                                              |
| DQ-016 | `coverage_shortfall`        | critical           | The daily oracle or the minute side is missing for a scheduled day.                   |
| DQ-017 | `mapping_missing`           | critical           | No primary provider mapping exists.                                                   |
| DQ-018 | `instrument_missing`        | critical           | The provider omits an expected instrument.                                            |
| DQ-019 | `unsupported_instrument`    | info               | The instrument type or segment is outside the R2 whitelist.                           |
| DQ-020 | `corporate_action_mismatch` | critical           | A discontinuity implies an unconfirmed corporate action.                              |
| DQ-021 | `stale_ingestion`           | warning            | The latest completed session has no successful ingestion within the freshness window. |
| DQ-022 | `rate_limit_exhausted`      | warning            | A run exhausted its retry budget on throttling.                                       |
| DQ-023 | `stale_ingestion`           | warning            | A running chunk exceeded the heartbeat window and was recovered.                      |
| DQ-024 | `coverage_shortfall`        | info               | A coverage verdict is older than the latest candle for the same instrument-day.       |
| DQ-025 | `duplicate_mapping`         | warning            | More than one primary mapping resolves to an instrument.                              |

## Lifecycle

1. **Detect** — compute the dedupe key from rule, provider, instrument, date and window.
2. **Open** — create the issue with evidence and severity.
3. **Acknowledge** — record ownership. Acknowledgement does not clear a critical preflight block.
4. **Resolve / ignore** — require a note and write an audit row. Ignoring a critical issue is a
   documented waiver.
5. **Auto-resolve** — a later full recheck that passes closes a non-critical open issue after 24
   hours without a repeat. It never auto-resolves an ignored or manually acknowledged critical issue.

## Coverage and the daily oracle

Strict coverage and validation are independent verdicts.

- Strict status: `complete`, `partial`, `missing`, `not_applicable`.
- Validation status: `not_checked`, `pending`, `matched`, `volume_reconciled`, `volume_mismatch`,
  `ohlc_mismatch`, `daily_missing`, `minute_missing`, `error`.

A missing minute is never filled with a flat bar. `volume_reconciled` means the daily volume proves
the missing minutes had no trades; the strict status remains `partial`.

The default daily-versus-minute volume tolerance is provisionally 2% (`0.02`). A live RELIANCE
January 2022 check found the minute sum 1.0583% below the daily volume, likely because the daily
candle includes non-minute or closing-auction volume. Open check #4 must resolve the exact treatment
before a full backfill.

## Preflight policy (R4)

R4 may accept `complete` unconditionally. It may accept `partial + volume_reconciled` only when the
longest gap is within the configured bound and no open critical issue exists. `volume_mismatch` and
`ohlc_mismatch` always block until explained.
