# R2 backfill acceptance report

Fill this in after the full nifty-50 backfill. The release question is not "did the backfill finish?"
It is "can every bar, every gap and every exclusion be explained from stored evidence?"

## Run metadata

| Field               | Value        |
| ------------------- | ------------ |
| Operator            |              |
| Date (IST)          |              |
| `TRADING_MODE`      |              |
| Provider token age  |              |
| Plan id             |              |
| Window              | 2022-01-01 → |
| Instruments         | 51           |
| Requests            |              |
| Wall-clock duration |              |

## Per-instrument summary

| Rank | Symbol   | Expected days | Complete | Partial reconciled | Partial mismatch | Missing | Open critical |
| ---- | -------- | ------------- | -------- | ------------------ | ---------------- | ------- | ------------- |
| 1    | NIFTY 50 |               |          |                    |                  |         |               |
| 2    |          |               |          |                    |                  |         |               |
| …    |          |               |          |                    |                  |         |               |

## Exception register

| Rule | Instrument | Date | Severity | Decision | Note |
| ---- | ---------- | ---- | -------- | -------- | ---- |
|      |            |      |          |          |      |

## Fault drills

| Drill                      | Result | Evidence                                           |
| -------------------------- | ------ | -------------------------------------------------- |
| Worker killed mid-backfill |        | No duplicate rows; resume skipped completed chunks |
| 429 storm                  |        | Global pause; no data loss; budget respected       |
| Token expiry               |        | Fail fast; no retry storm                          |
| Duplicate replay           |        | `rows_skipped` increments; row count unchanged     |
| Provider revision          |        | Old/new values recorded                            |
| Partial current-day bar    |        | Non-final, then T+1 replacement                    |

## Gates

| Gate                        | Threshold                              | Result |
| --------------------------- | -------------------------------------- | ------ |
| Instrument resolution       | 51 / 51                                |        |
| Catalog order               | 51 / 51 rank match                     |        |
| Status coverage             | 100% of catalog rows                   |        |
| Duplicate fetch             | 1 active backfill per instrument       |        |
| Refresh efficiency          | 0 requests for complete months         |        |
| Mapping completeness        | 100% primary mappings                  |        |
| Tick-size validity          | 100%                                   |        |
| Calendar coverage           | 100% of 2022–2027 dates                |        |
| Strict completeness         | ≥ 99% complete or partial + reconciled |        |
| Unexplained critical issues | 0                                      |        |
| Volume reconciliation       | ≥ 99% of complete/partial days         |        |
| Duplicate candles           | 0                                      |        |
| Re-run idempotency          | 0 new rows                             |        |
| Order safety                | 0 orders, 0 order routes               |        |

## Waivers

| Issue | Reason | Approved by | Date |
| ----- | ------ | ----------- | ---- |
|       |        |             |      |
