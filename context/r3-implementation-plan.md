# R3 implementation plan — strategy registry and opening-range breakout

**Status:** planned, not started
**Date:** 2026-11-23
**Release:** R3 — strategy registry and the first opening-range-breakout (ORB) implementation
**Trading mode:** `research` only. R3 produces research signals; it never sends an order.
**Plan of record for:** `context/latest-task.md`

> This plan is written against the as-built R1/R2 repository, not against the original R1/R2
> proposals. Where the two disagree, the code and `context/current-implementation.md` win. The
> HTML files in `context/` remain the design record.

## 0. Decisions taken for this plan

| # | Question | Decision |
| - | -------- | -------- |
| D1 | Should R3 persist signals and show them? | **Yes.** R3 persists research signals and exposes them in the dashboard. Signals are scoped to a first-class research evaluation run, not to a live trading session. |
| D2 | How broad is the column cleanup? | **Every table is audited.** Only columns with no producer/consumer and no planned owner in R1-R9 are removed. Columns that are write-only security, audit or replay evidence stay. Seven columns are removed; no table is removed. |
| D3 | Does R3 include R4 groundwork? | **No.** R3 stops at signal generation and research persistence. Costs, slippage, fills, equity curves, metrics and promotion gates remain R4. |

The task asks for three things in one release: a column review, a strategy registry, and an ORB
implementation with a consistent operator surface. This plan sequences them so the schema is
settled before the engine is written and the engine is settled before the UI is wired.

---

## 1. Overview and scope

### 1.1 What R3 delivers

1. **Strategy registry runtime.** A typed registry that maps a database strategy `code` plus an
   implementation `code_ref` to a compiled strategy, validates parameters against the version's
   JSON Schema, and fails safely when a database version points at an unknown implementation.
2. **The 15-minute ORB rules.** The rules in `context/strategy1.md` implemented as a pure,
   deterministic session evaluator: opening range, five-minute rollup, VWAP, NIFTY 50 EMA
   confirmation, same-slot volume confirmation, risk-budget sizing, stop/target/EOD exits, and
   the one-entry/one-position/two-entries limits.
3. **A research evaluation pipeline.** An operator selects a strategy version, a parameter
   snapshot, a date range, a capital base and (optionally) instruments. The API creates a run and
   queues a worker job. The worker evaluates every eligible instrument-day, persists the
   evidence, and records why an instrument-day produced no signal.
4. **Persisted research signals.** Entry and exit signals are written to the reserved `signals`
   table, scoped by `evaluation_run_id`. The schema is extended only where the current table cannot
   represent a research run.
5. **Operator surface.** The existing `/strategies` and `/strategies/[id]` pages gain runtime
   status, a "Run evaluation" action, evaluation history and a signal review surface. The design
   reuses the R1/R2 components, badges, dialogs, filters and pagination.
6. **A schema cleanup pass.** Every table is re-audited against its producers and consumers. Seven
   remaining dead or duplicated columns are removed. Every other column is kept with a stated
   owner.

### 1.2 What R3 explicitly does not deliver

- No order, modify or cancel route; no broker write method; no fills, positions or trade costs.
- No backtest engine, cost model, slippage model, equity curve, metrics or promotion gate.
- No live market-data feed, no paper session and no kill switch.
- No `paper` or `live` trading mode. `assertResearchMode()` still refuses anything but `offline`
  and `research`.
- No scheduled evaluation. Runs are operator-initiated.
- No browser-based verification. Verification is `pnpm lint`, typecheck, tests and `db:verify`.

### 1.3 Release gate

R3 starts only when R2 has signed off a backfill report that shows complete or explained coverage
for the instruments in scope, including the **NIFTY 50 index**. The ORB market confirmation
cannot be evaluated without index candles. If the index is not covered, R3 can be implemented and
unit-tested, but a real evaluation run must stop with `index_insufficient_coverage`
rather than silently produce stock signals.

---

## 2. Architecture fit

### 2.1 Package responsibilities

| Package | R3 responsibility | Allowed internal dependencies today |
| ------- | ----------------- | ----------------------------------- |
| `packages/domain` | Shared strategy parameter schema, signal/evidence types, evaluation status and reason-code vocabularies | none |
| `packages/trading-engine` | Strategy contract v2, pure indicator math, session-book types, JSON-Schema validation types | `domain` |
| `packages/strategies` | ORB implementation, registry, parameter validation, deterministic session evaluator | `domain`, `trading-engine` |
| `packages/database` | Schema, migration `0020`/`0021`, repositories for runs/results/signals, seed for strategy version 2 | `domain` |
| `apps/api` | Validation, run creation, job enqueue, read APIs, Swagger, audit | packages |
| `apps/worker` | `strategy-evaluation` processor, data loading, preflight, persistence, cancellation | packages |
| `apps/web` | Runtime status, run creation, evaluation history, signal review | API over HTTP |

No boundary in `scripts/check-boundaries.mjs` changes. `strategies` still depends only on `domain`
and `trading-engine`; it never imports the database or NestJS. The worker and API own all I/O.

### 2.2 Data flow

```
operator → POST /strategies/:id/evaluation-runs
         → API validates version, config, universe, account, dates
         → API creates job_runs + strategy_evaluation_runs (one transaction)
         → API enqueues `strategy-evaluation` on the `strategy-evaluation` queue
         → worker loads candles/calendar/coverage per day
         → pure ORB evaluator returns signals + per-instrument results
         → worker persists strategy_evaluation_results + signals
         → API reads runs/results/signals
         → dashboard renders runs and signals
```

The pure evaluator is deliberately isolated from Postgres and BullMQ. It receives plain data and
returns plain data. That is what makes the ORB rules testable with synthetic sessions and what
keeps R4 free to reuse the engine with a different data source.

### 2.3 Why a first-class run table instead of only `job_runs`

`job_runs` is the operational ledger: status, attempts, stages and errors. It does not carry the
pinned strategy version, configuration versions, capital, date range or universe snapshot, and it
must not become a strategy artifact table. A run also needs a stable parent for results and
signals and a partial unique index that permits only one active run per strategy version.
`strategy_evaluation_runs` owns those facts and links to `job_runs` for progress and cancellation.

`backtest_runs` is **not** reused. Its `cost_model_version`, `slippage_model_version` and
`initial_capital` are mandatory and it must keep meaning "simulated execution run" for R4.

---

## 3. Strategy contract and registry

### 3.1 Contract v2

The current contract is per-instrument and returns `Signal[]`. ORB needs a session view because its
limits are portfolio-wide, so replace it with a session-scoped contract:

| Type | Purpose |
| ---- | ------- |
| `StrategyInstrument` | Tradable id, symbol and tick size. |
| `StrategySessionContext` | Run timestamp (provenance only, no rule may read it), IST trading date and session window, eligible instruments in symbol order, final 1-minute bars per instrument, index bars, same-slot volume history, capital, pinned parameters and risk. |
| `StrategySignal` | Instrument, signal time and candle start, type `entry`/`stop`/`target`/`eod`, side `long`, reference price, optional entry/stop/target/quantity, bounded evidence. |
| `StrategyInstrumentResult` | `signal` or `no_signal`, primary reason code and diagnostics. |
| `StrategyEvaluation` | The signals plus the per-instrument results. |
| `Strategy` | Database `code`, implementation name, semver, parameter schema and `evaluate(context)`. |

Everything crossing the boundary is plain data: no strategy package imports Postgres, BullMQ,
NestJS or the web app. Shared supporting types (`Bar`, `VolumeSlotSample`, `JsonSchema`,
`RiskParameters`) live in `packages/domain`.

### 3.2 Registry

`packages/strategies` exposes an explicit, static registry: lookup by database `strategies.code`,
listing, `code_ref` resolution and the parameter validator. The registry key is the database
`strategies.code` (`orb-15m`). The database `strategy_versions.code_ref` must equal
`implementation@version` (`opening-range-breakout@1.0.0`). Resolution rules:

1. Unknown `strategies.code` → runtime status `unregistered`.
2. `code_ref` missing or not `implementation@version` → `invalid_code_ref`.
3. Registry has no matching implementation/version → `implementation_missing`.
4. Registry schema and the version's `parameter_schema` are not deeply equal → `schema_mismatch`.
5. Otherwise → `registered`.

There is no dynamic file discovery and no arbitrary code loading. Adding a strategy is a code
change plus a database version row, never a runtime upload.

### 3.3 Parameter validation

- Validate against the **version row's** `parameter_schema`, which is authoritative for the
  operator's payload. The registry's schema must match it or the runtime refuses the version.
- Validate at four points: creating a strategy version, creating/binding a configuration payload,
  resolving the effective configuration for a run, and startup/seed verification.
- Reject unknown keys, wrong types, out-of-range numbers and malformed time strings; the error
  names the JSON path and the expected constraint.
- The ORB parameter schema and defaults are a shared domain constant, imported by both the seed and
  the strategy so they cannot drift.

### 3.4 Versioning and provenance

- The seeded `orb-15m` version 1 has `code_ref='r1-seed'` and is immutable.
- R3 adds **version 2** with `code_ref='opening-range-breakout@1.0.0'`, status `active`, the shared
  parameter schema, and a changelog. Version 1 remains `validated`.
- Version 2 binds the existing `strategy/orb-15m` parameter config v1, the `risk/global` config v1
  and the `system/global` config v1 for roles `parameters`, `risk` and `execution`. Immutable
  configuration rows are reused, not rewritten.
- An evaluation run pins `strategy_version_id`, `configuration_version_id` and
  `risk_configuration_version_id`. It never re-resolves configuration per historical day.
- The implementation semver is independent of the database version number. `code_ref` is the
  join between them.

### 3.5 Runtime status in the API

`GET /strategies/:id` gains a `runtime` object: status, resolved implementation and version, schema
match and the supported parameter names. Each version in the response gains `runtimeStatus` and
`runtimeError`, so the versions table can show "v1 · r1-seed · unregistered" beside
"v2 · opening-range-breakout@1.0.0 · registered". `GET /strategies` gains `runtimeStatus` per row
for the list badge. The API resolves this through `@ai-trading/strategies`; that is an
app-to-library dependency and does not change the boundary map.

---

## 4. ORB evaluation model

### 4.1 Time model

- All calendar, session and slot logic uses `Asia/Kolkata`.
- Database timestamps are UTC instants. The evaluator converts once at the boundary.
- R3 supports only **normal NSE sessions**: open 09:15 IST, close 15:30 IST. Special sessions
  (Muhurat, Budget Day, shortened sessions) are skipped with `special_session` because the
  parameter schema is a 09:15/09:30/14:15/15:15 clock. Supporting special sessions is a later
  decision, not an implicit fallback.
- The opening range is the window `openingRangeStart`-`openingRangeEnd`. The seeded values are
  09:15-09:30, which is the first three five-minute bars. ORB v1 requires both endpoints to align
  to five-minute boundaries and the window to contain at least one bar.
- Decision bars are five-minute bars rolled up from 1-minute bars. The first decision bar starts
  at `entryWindowStart` (09:30 by default), so it is 09:30-09:35. A bar that closes exactly at
  `entryWindowEnd` (14:15) is the last one accepted; the next bar is outside.
- The end-of-day exit is evaluated at `eodExitTime` (15:15 by default).

### 4.2 Inputs and universe

| Input | Source | Rule |
| ----- | ------ | ---- |
| Instruments | `instruments` | `is_sync_target = true`, `instrument_type = 'EQ'`, `segment = 'NSE_EQ'`. The index is not tradable. |
| Instrument bars | `market_candles_1m` | `is_final = true`, `trading_date = day`, 1-minute bars inside the session. |
| Market bars | `market_candles_1m` | The NIFTY 50 index instrument (`instrument_type='INDEX'`, `segment='NSE_INDEX'`, `trading_symbol='NIFTY 50'`). |
| Session | `trading_calendar` | NSE row for the day; session open/close; trading day flag. |
| Coverage | `instrument_day_coverage` | `expected_bars = stored_bars` for the instrument and the index. |
| Volume history | Previous 20 sessions | Same 5-minute slot (`HH:MM`) per instrument. |
| Corporate actions | `corporate_actions` | Any action with `ex_date` inside the instrument's warm-up window skips the instrument-day. |
| Parameters | Pinned `configuration_versions.payload` | Validated against the version schema. |
| Risk | Pinned risk config | `riskPerTradePct`, duplicate limits. |
| Capital | Run row | `initial_capital`, fixed for the run. No compounding in R3. |

The universe resolution is snapshotted on the run row at creation. Re-running later must not
silently change because `is_sync_target` changed.

### 4.3 Data-quality preflight

An instrument-day is **skipped** when any of these is true:

| Reason code | Condition |
| ----------- | --------- |
| `special_session` | Session open/close is not 09:15/15:30 IST. |
| `session_missing` | Calendar row exists but has no session window. |
| `index_missing` | The NIFTY 50 index instrument is absent or ambiguous. |
| `index_insufficient_coverage` | The index day is not strictly complete. |
| `coverage_missing` | No coverage row for the instrument-day. |
| `coverage_partial` | `stored_bars <> expected_bars`. |
| `corporate_action` | A corporate action has an `ex_date` in the instrument's warm-up window or on the day. |
| `warmup` | Fewer than 20 prior complete sessions for volume history or fewer than 200 NIFTY 5-minute bars. |
| `opening_range_incomplete` | The first three 5-minute bars are not complete. |
| `index_data_gap` | The index bars needed for the decision are missing. |

Skipped instrument-days are persisted in `strategy_evaluation_results` with
`status='skipped'` and the reason. A skipped day is visible, not silently absent. This is the R2
principle: a successful fetch is not complete data, and a missing bar is never filled with a flat
bar.

### 4.4 Bar construction and indicators

**Five-minute rollup.** Group 1-minute bars by IST five-minute boundary. A five-minute bar is
usable only when all five 1-minute bars are present and final. OHLC is the first open, max high,
min low, last close; volume is the sum. A partially covered 5-minute bar is excluded and the
instrument-day is skipped if it affects the opening range or a decision bar.

**Opening range.** Take the five-minute bars whose start is at or after `openingRangeStart` and
strictly before `openingRangeEnd`. With the seeded 09:15/09:30 values these are the 09:15, 09:20
and 09:25 bars. All of them must be complete.

```
openingRangeHigh = max(high) of the opening-range bars
openingRangeLow  = min(low)  of the opening-range bars
```

**Intraday VWAP.** Cumulative from session open through the decision bar inclusive:

```
typicalPrice = (high + low + close) / 3          // per 1-minute bar
VWAP = sum(typicalPrice * volume) / sum(volume)
```

If cumulative volume is zero, the decision is `vwap_unavailable`.

**Market filter (NIFTY 50).** Compute EMA20 and EMA50 over the trailing
`emaLookbackBars = 200` five-minute closes, including the decision bar. Seed each EMA with the
simple average of its first `period` closes, then apply the standard recursive formula. Requiring
200 bars makes the value independent of the run's start date once the window is full. The filter
passes when:

```
niftyClose > EMA20 && EMA20 > EMA50
```

If fewer than `emaLookbackBars` (200) bars exist, the instrument-day is `warmup`.

**Volume filter.** For the decision bar's slot (`HH:MM`), take the volume of the same slot from
the preceding `volumeLookbackSessions = 20` **complete** sessions for the same instrument. Use the
median, not the mean. The filter passes when:

```
bar.volume >= volumeRatioMin * medianSlotVolume
```

Require exactly `volumeLookbackSessions` samples; otherwise `volume_history_insufficient`. If the
median is zero, `volume_history_zero`.

**Tick size.** Read `instruments.tick_size`. It must be finite and positive; otherwise the
instrument-day is `invalid_tick`. Rounding is direction-aware: the entry limit rounds **up**, the
stop rounds **down**, and the target uses the nearest tick.

### 4.5 Entry rules

For each completed five-minute decision bar inside 09:30-14:15:

1. `close > openingRangeHigh` — otherwise no breakout.
2. `close > VWAP` — otherwise `below_vwap`.
3. NIFTY close > EMA20 and EMA20 > EMA50 — otherwise `market_filter`.
4. `volume >= volumeRatioMin × median slot volume` — otherwise `volume_filter`.
5. The instrument has not already had an entry today — otherwise `already_traded`.
6. The instrument is not currently in a position — otherwise `position_open`.
7. The session has fewer than `maxEntriesPerDay` entries — otherwise `daily_limit`.
8. The position can be sized to at least one whole share — otherwise `unsizeable`.
9. The opening range, index data and bar are complete — otherwise the preflight reasons above.

The entry decision is:

```
entryPrice = ceilToTick(breakoutClose + entryProtectionTicks * tickSize)   // default 1 tick
stopPrice  = floorToTick(breakoutCandle.low - tickSize)
riskPerShare = entryPrice - stopPrice
targetPrice  = roundToTick(entryPrice + targetRMultiple * riskPerShare)
```

If `riskPerShare <= 0`, no signal (`invalid_stop`). `referencePrice` is the breakout close;
`entryPrice` is the price-protected marketable limit. R3 assumes this limit fills at the limit.
R4 replaces that assumption with a fill model; the UI must label R3 signals "research signal,
not a fill".

### 4.6 Sizing

```
riskBudget   = initialCapital * riskPerTradePct
byRisk       = floor(riskBudget / riskPerShare)
byCash       = floor(initialCapital / entryPrice)
quantity     = min(byRisk, byCash)
```

- Whole shares only. `quantity < 1` produces no signal and `unsizeable`.
- `riskPerTradePct` comes from the pinned risk config (seeded 0.005).
- Duplicate limits (`maxEntriesPerDay`, `maxOpenPositions`) use the **stricter** of the strategy
  parameters and the risk config.
- R3 does not enforce the daily loss limit or the kill switch; those require realized P&L and are
  R5. The plan records the omission instead of pretending the limit is active.

### 4.7 Exit model

Once an entry is selected, the session book monitors 1-minute bars from the next bar:

| Condition | Exit |
| --------- | ---- |
| `bar.low <= stopPrice` | Stop. If `bar.open <= stopPrice`, exit at `bar.open` (gap); else at `stopPrice`. |
| `bar.high >= targetPrice` | Target. If `bar.open >= targetPrice`, exit at `bar.open` (gap); else at `targetPrice`. |
| Both in one bar | Stop first. Conservative and deterministic. |
| 15:15 IST reached | EOD exit at the 15:15 1-minute open; if absent, the last close at or before 15:15. |

Each exit produces a `stop`, `target` or `eod` signal with `direction='long'`, the original
entry/stop/target in the row, and the exit price in `reference_price`. The position slot is freed
after the exit, so a second entry later in the day is possible when the limits allow it.

### 4.8 Portfolio rules and candidate precedence

The session book is evaluated bar by bar across the whole universe:

1. At each decision bar, collect every instrument whose entry conditions pass.
2. If a position is open, no entry is taken. Record `position_open` for the candidates.
3. If the daily entry count is 2, no entry is taken. Record `daily_limit`.
4. Otherwise select exactly one candidate within the current decision bar by:
   - highest volume ratio,
   - then symbol ascending.
   Bars are processed chronologically, so an earlier qualifying bar always wins over a later one.
5. Record the selected entry, then evaluate exits until the slot is free.

This makes the "one open position" rule explicit and prevents the current schema gap where two
open instruments could both exist. The session-book state is in-memory for the run; R5 will move
the same rules into the risk engine.

### 4.9 Determinism and evidence

- No rule reads `Date.now()`, environment variables, random values or the database.
- Inputs are sorted: days ascending, instruments by symbol, bars by start.
- Prices are computed from numeric strings once, then rounded to the instrument tick.
- Quantities are integers; prices are stored at 4 decimal places; ratios at 6.
- Evidence is bounded: at most 10 breakout candidates per instrument-day and at most 8 KB of
  JSON per signal.
- The same run inputs must produce the same signals. The integration test asserts this by
  re-running one day and comparing the persisted signal rows (excluding ids and created_at).

### 4.10 Reason codes

| Code | Meaning |
| ---- | ------- |
| `no_breakout` | No decision bar closed above the opening-range high. |
| `below_vwap` | A breakout closed at or below VWAP. |
| `market_filter` | NIFTY close/EMA condition failed. |
| `volume_filter` | Volume ratio below the minimum. |
| `already_traded` | One entry already taken for this instrument today. |
| `position_open` | Another instrument's position occupied the only slot. |
| `daily_limit` | Two entries already taken today. |
| `unsizeable` | Fewer than one whole share fits the risk budget and cash. |
| `invalid_stop` | Entry price was not above the stop. |
| `invalid_tick` | Missing or invalid instrument tick size. |
| `vwap_unavailable` | Zero cumulative volume. |
| `volume_history_insufficient` | Fewer than 20 complete prior sessions for the slot. |
| `volume_history_zero` | Median slot volume was zero. |
| `opening_range_incomplete` | Opening-range bars incomplete. |
| `warmup` | Not enough prior history for EMA or volume. |
| `decision_bar_incomplete` | A decision bar is not fully covered. |
| `coverage_missing` | No coverage row. |
| `coverage_partial` | Strict coverage failed. |
| `index_missing` | NIFTY 50 index instrument absent. |
| `index_insufficient_coverage` | Index strict coverage failed. |
| `index_data_gap` | Index bars missing for a decision. |
| `special_session` | Not a normal 09:15-15:30 session. |
| `corporate_action` | Corporate action in the warm-up window. |
| `session_missing` | Calendar row has no session window. |

`strategy_evaluation_results.reason_code` is the primary reason. `diagnostics` carries the full
condition matrix so the operator can see every failed filter, not just the first one.

---

## 5. Data model changes

### 5.1 New tables

#### `strategy_evaluation_runs`

One row per operator-initiated research run. It pins everything that could change later.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | UUIDv7 from the application. |
| `strategy_version_id` | uuid NOT NULL | FK `strategy_versions`, RESTRICT. |
| `configuration_version_id` | uuid NOT NULL | FK `configuration_versions`, RESTRICT. Strategy parameters used. |
| `risk_configuration_version_id` | uuid NULL | FK `configuration_versions`, RESTRICT. Risk parameters used for sizing. |
| `account_id` | uuid NOT NULL | FK `accounts`. The research account supplied by the API. |
| `from_date`, `to_date` | date NOT NULL | Inclusive IST trading dates. |
| `initial_capital` | numeric(20,2) NOT NULL | Fixed for the run. |
| `universe` | jsonb NOT NULL | `{ market: {id,symbol,exchange}, requestedIds, resolved: [{id,symbol}], excluded: [{id,symbol,reason}] }`. |
| `status` | varchar(20) NOT NULL | `queued`, `running`, `completed`, `failed`, `cancelled`. |
| `note` | text NULL | Optional operator note, shown in the run header and the audit row. |
| `job_run_id` | uuid NULL | FK `job_runs`, SET NULL. Operational progress and cancellation. |
| `error` | jsonb NULL | `{ code, message, day? }`. |
| `created_by` | uuid NULL | FK `users`. |
| `created_at` | timestamptz NOT NULL | Default `now()`. |
| `started_at`, `finished_at` | timestamptz NULL | Lifecycle. |

Checks:

- `from_date <= to_date`
- `initial_capital > 0`
- `finished_at IS NULL OR started_at IS NULL OR finished_at >= started_at`
- `status IN ('queued','running','completed','failed','cancelled')`
- `jsonb_typeof(universe) = 'object'`
- `error IS NULL OR jsonb_typeof(error) = 'object'`

Indexes:

- `idx_evaluation_runs_version_created (strategy_version_id, created_at DESC)`
- `idx_evaluation_runs_status (status)`
- `idx_evaluation_runs_job (job_run_id)`
- `uq_evaluation_runs_active (strategy_version_id) WHERE status IN ('queued','running')` — one
  active run per strategy version.

There is no `mode` column. R3 only creates research runs; adding a constant `mode='research'`
would be exactly the kind of dead column this release removes. R4 adds a mode when it reuses the
table.

#### `strategy_evaluation_results`

One row per run, trading date and instrument. This is the explainability ledger: it records both
signals and the reason an instrument-day had none.

| Column | Type | Notes |
| ------ | ---- | ----- |
| `id` | uuid PK | |
| `evaluation_run_id` | uuid NOT NULL | FK `strategy_evaluation_runs`, CASCADE. |
| `trading_date` | date NOT NULL | IST date. |
| `instrument_id` | uuid NOT NULL | FK `instruments`, RESTRICT. |
| `status` | varchar(20) NOT NULL | `signal`, `no_signal`, `skipped`. |
| `reason_code` | varchar(40) NULL | Required when status is not `signal`. |
| `diagnostics` | jsonb NOT NULL | Bounded condition matrix and candidate summary. |
| `created_at` | timestamptz NOT NULL | Default `now()`. |

Checks:

- `status IN ('signal','no_signal','skipped')`
- `(status = 'signal' AND reason_code IS NULL) OR (status <> 'signal' AND reason_code IS NOT NULL)`
- `jsonb_typeof(diagnostics) = 'object'`

Indexes:

- `uq_evaluation_result_day (evaluation_run_id, trading_date, instrument_id)`
- `idx_evaluation_results_day (evaluation_run_id, trading_date)`
- `idx_evaluation_results_status (evaluation_run_id, status)`
- `idx_evaluation_results_reason (evaluation_run_id, reason_code)`
- `idx_evaluation_results_instrument (instrument_id)`

No `signal_count` column. Counts are aggregated from `signals` on read; a stored count would be a
derived column and would drift.

### 5.2 Changes to `signals`

`signals` was designed for live signals. It needs a small set of changes for research, not a new
signal table:

| Change | Definition | Why |
| ------ | ---------- | --- |
| `trading_session_id` becomes nullable | `ALTER TABLE signals ALTER COLUMN trading_session_id DROP NOT NULL` | A historical research run has no live session. |
| `evaluation_run_id` added | `uuid NULL`, FK `strategy_evaluation_runs`, CASCADE | Parent for research signals. |
| Scope check | Exactly one of `trading_session_id`, `evaluation_run_id` is set | Prevents a signal with no parent or two parents. |
| Whole-share check | `quantity IS NULL OR quantity = trunc(quantity)` | The strategy sizes whole shares. |
| Evidence object check | `jsonb_typeof(evidence) = 'object'` | The evidence contract is an object. |
| Research idempotency index | `(evaluation_run_id, strategy_version_id, instrument_id, candle_start, signal_type) WHERE evaluation_run_id IS NOT NULL` | A retried run cannot duplicate a decision. |
| Live idempotency index | `(trading_session_id, strategy_version_id, instrument_id, candle_start, signal_type) WHERE trading_session_id IS NOT NULL` | R5 and R9 multi-strategy get the same protection. |
| Run timeline index | `(evaluation_run_id, signal_at)` | The run signal view. |
| Instrument timeline index | `(instrument_id, candle_start DESC)` | Per-instrument history. |

`account_id`, `strategy_version_id`, `configuration_version_id`, `direction`, `signal_type`,
`reference_price`, `entry_price`, `stop_price`, `target_price`, `quantity`, `evidence`, `status`
and `created_at` are kept as they are. R3 writes research rows with `status='created'`; that is
terminal for a research signal. `signal_type` uses `entry`, `stop`, `target` and `eod`.
`direction='long'` for ORB; the `long|short` check remains for later strategies.

The check is a single constraint:

```sql
ALTER TABLE signals
  ADD CONSTRAINT chk_signals_scope
  CHECK (num_nonnulls(trading_session_id, evaluation_run_id) = 1);
```

`num_nonnulls` is a built-in Postgres function; no helper is needed.

### 5.3 Migration `0020_r3_strategy_evaluation.sql`

Forward-only. Create the two tables, alter `signals`, add the constraints and indexes, and widen
the two job-ledger checks:

```sql
-- job catalog: new job and stage
ALTER TABLE job_runs DROP CONSTRAINT chk_job_runs_name;
ALTER TABLE job_runs ADD CONSTRAINT chk_job_runs_name
  CHECK (job_name IN (
    'instrument-sync','calendar-sync','historical-backfill','historical-finalize',
    'intraday-sync','coverage-recompute','coverage-rebuild','quality-scan',
    'ingestion-reconcile','refresh-materialized-view','ensure-partitions',
    'strategy-evaluation'));

ALTER TABLE job_run_events DROP CONSTRAINT chk_job_run_events_stage;
ALTER TABLE job_run_events ADD CONSTRAINT chk_job_run_events_stage
  CHECK (stage IN (
    'prepare','fetch','normalize','persist','fixture','reconcile','chunks',
    'repair','instruments','clear','scan','stale','sweep','issues',
    'refresh','ensure','evaluate','finalize'));
```

Mirror both tables and the `signals` changes in the Drizzle schema in the same change.

### 5.4 Migration `0021_r3_drop_dead_columns.sql`

Seven columns. Each has a named owner being removed, not a vague "looks unused":

| Table.column | Reason |
| ------------ | ------ |
| `providers.capabilities` | Written only by the seed with `{historical,quotes,orders}`; no reader. Adapters hard-code capability. The value also falsely advertises order support. |
| `raw_provider_payloads.http_method` | Always `'GET'` at every call site. |
| `raw_provider_payloads.http_status` | Always `200`; only successful payloads are stored, and failures live in `external_api_calls`. |
| `market_candles_1m.created_at` | Insert stamp equal to `updated_at` at insert; `updated_at` is the freshness field on the largest table. |
| `risk_decisions.created_at` | Duplicate of `decided_at`; the decision time is the only meaningful time. |
| `orders.order_ref_id` | The R1 plan puts `order_ref_id`/`guid` in `order_events.payload`; no writer is planned for a first-class column. |
| `reconciliations.raw_payload_id` | A reconciliation reads five payload families; each snapshot row already carries its own `raw_payload_id`. One FK cannot represent the run. |

`DROP COLUMN` removes dependent checks and indexes. Remove each column from the Drizzle schema and
from every seed, repository select/insert and projection type in the same change.

No table is dropped in R3. `domain_events` stays because it is the planned R5 transactional
outbox. `system_health_snapshots`, `notification_events`, `report_runs` and
`market_quote_snapshots` stay because they have named later owners and read endpoints; dropping
them would remove operator surface without replacing it.

### 5.5 Table-by-table audit

Legend: **—** = no change. Every remaining column has a producer and a consumer, is intentional
evidence, or is reserved with a named owner. The full evidence trail is recorded in
`docs/operations/schema-column-audit.md` when the migration lands.

#### Platform

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `users` | — | — | `last_login_at` is the only login timestamp; it stays as evidence. |
| `user_sessions` | — | — | `ip_address`/`user_agent` are security evidence for a session; keep. |
| `accounts` | — | — | All fields are used by the account pages or the startup guard. |
| `user_account_access` | — | — | `granted_by` is grant lineage; the seed writes it and the audit trail records the action. |
| `broker_credentials` | — | — | Ciphertext is never read by design; metadata is. |
| `audit_log` | — | Display `user_agent` in the audit detail | Append-only security history. The field is written but not shown today; consume it instead of deleting evidence. |
| `domain_events` | — | — | R5 transactional outbox; append-only trigger. |
| `account_instrument_permissions` | — | — | `created_by`/`created_at` are permission lineage; the table is the R5 tradability gate. |

#### Reference

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `providers` | `capabilities` | — | `kind` is read by the account provider gate. |
| `exchanges` | — | — | `code` is the only non-audit field after 0016; the table is the exchange master. |
| `instruments` | — | — | `freeze_quantity` is kept for R5 order slicing; `listed_on`/`delisted_on` bound the coverage window; `is_sync_target` is the ORB universe. |
| `instrument_provider_mappings` | — | — | Versioned provider keys and symbols; all fields are read by sync and the UI. |
| `trading_calendar` | — | — | Session windows are the R3 time model; `description` is the holiday label. |
| `corporate_actions` | — | — | `price_adjustment_factor`/`volume_adjustment_factor` are R4 inputs; the rest is import provenance. |
| `raw_provider_payloads` | `http_method`, `http_status` | — | `endpoint`, `request_params` and retention fields stay as replay/retention evidence. |

#### Market

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `market_candles_1m` | `created_at` | — | `trading_date` is the partition/coverage key; `updated_at` is freshness; `is_final` is the finalize gate. |
| `market_quote_snapshots` | — | — | R5 live quotes; the writer exists but is uncalled. |
| `instrument_day_coverage` | — | — | Rebuildable coverage cache; the R3 preflight reads it. |
| `instrument_data_status` | — | — | Persisted catalog projection by design. |

#### Operations

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `daily_performance` | — | — | R5/R6 analytics. |
| `strategy_performance_daily` | — | — | R5/R6 analytics; `profit_factor` needs gross win/loss. |
| `job_runs` | — | Add `strategy-evaluation` to `chk_job_runs_name` | The operational ledger for the new job. |
| `job_run_events` | — | Add `evaluate` to the stage check | Stage rail for the new job. |
| `external_api_calls` | — | — | The call ledger now owns HTTP status/method evidence. |
| `system_health_snapshots` | — | — | Read-only readiness surface, reserved for R7; no producer yet. |
| `notification_events` | — | — | Read-only notification surface, reserved for R5/R7. |
| `report_runs` | — | — | Read-only report surface, reserved for R7/R8. |
| `system_settings` | — | — | Runtime settings. Retention keys stay with the retention columns. |
| `system_issues` | — | — | Current-state data-quality ledger. |

#### Strategy

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `strategies` | — | — | Registry identity and lifecycle. |
| `strategy_versions` | — | Seed version 2 with `code_ref='opening-range-breakout@1.0.0'` | Immutable implementation provenance. |
| `configuration_versions` | — | — | Immutable parameter/risk/system snapshots; `created_by` is displayed. |
| `strategy_config_bindings` | — | Bind version 2 to the existing parameter/risk/execution configs | The only path from a snapshot to a strategy. |
| `strategy_activations` | — | — | R5 activation; `activated_by` is audit attribution. |
| `trading_sessions` | — | — | R5 live session state; research signals no longer require a synthetic row. |
| `risk_events` | — | — | R5 risk events. |
| `strategy_evaluation_runs` | — | **New** | R3 run ledger. |
| `strategy_evaluation_results` | — | **New** | R3 per-instrument-day explainability. |

#### Execution

| Table | Remove | Add / alter | Keep and why |
| ----- | ------ | ----------- | ------------ |
| `signals` | — | Add `evaluation_run_id`, relax `trading_session_id`, scope/whole-share/evidence checks, idempotency and timeline indexes | R3 research signals; R5 live signals. |
| `risk_decisions` | `created_at` | — | R5 risk verdict; `decided_at` is the time. |
| `orders` | `order_ref_id` | — | R5 broker order state; the ref belongs in `order_events.payload`. |
| `order_events` | — | — | Append-only order history. |
| `fills` | — | — | `exchange_trade_id` is deferred until the Upstox trade contract is verified. |
| `trade_costs` | — | — | R5 cost breakdown. |
| `positions` | — | — | R5 lifecycle; open is `closed_at IS NULL`. |
| `position_events` | — | — | Append-only position history. |
| `broker_position_snapshots` | — | — | R5/R8 broker mirror. |
| `holdings_snapshots` | — | — | R8 demat mirror; ORB never holds overnight. |
| `account_equity_snapshots` | — | — | R5 cash buckets. |
| `round_trip_trades` | — | — | R5 trade result. |
| `reconciliations` | `raw_payload_id` | — | R5/R8 run state; payload lineage lives on the snapshot rows. |
| `reconciliation_issues` | — | — | R5/R8 issue detail. |

#### Backtesting

All `backtest_*` and `strategy_promotion_reviews` columns are kept. They are R4's contract and
none is dead today; removing them would force an R4 re-add before the engine exists.

### 5.6 Seed and configuration changes

- Add the ORB parameter schema and defaults to `packages/domain` as the shared constant (§3.3).
- The seed creates `orb-15m` version 2 if missing: `code_ref='opening-range-breakout@1.0.0'`, the
  shared schema, `status='active'`, a release timestamp and a changelog pointing at this plan.
- Bind version 2 to the existing `strategy/orb-15m` parameter config and the `risk/global` and
  `system/global` configs. Do not create a new configuration version: the four optional R3
  parameters (Appendix A) have code defaults, so config v1 stays valid. The 13 required parameters
  are unchanged.
- Assert exactly one NIFTY 50 index instrument in `db:verify`.

### 5.7 `verify.ts` and the table count

- 58 logical tables (56 + 2 new; no table is dropped).
- One materialized view, at least 63 candle partitions and 15 quote partitions.
- `strategy_evaluation_runs` and `strategy_evaluation_results` exist with their unique indexes.
- `signals` has `evaluation_run_id`, nullable `trading_session_id`, the scope check, the
  whole-share check and the two partial unique indexes.
- The seven dropped columns are absent (`information_schema.columns`).
- `strategy_versions` has an active version 2 with `code_ref='opening-range-breakout@1.0.0'`, a
  parameters binding, and a schema equal to the domain constant.
- Exactly one NIFTY 50 index instrument exists.
- `job_runs` accepts `strategy-evaluation`.
- Zero orders, zero fills, zero positions remain the guarantee.

### 5.8 Deferred schema defects (recorded, not fixed in R3)

These are real, but they belong to the release that owns the table:

| Table | Defect | Owner |
| ----- | ------ | ----- |
| `account_equity_snapshots` | Unique `(account_id, captured_at)` omits `snapshot_type`, so two types at one instant collide. | R5 |
| `round_trip_trades` | `exit_price` is NOT NULL while `exit_at` is nullable; an open trade cannot be stored without a placeholder price. | R5 |
| `reconciliation_issues` | `entity_type` has no `fill`; no unique key on `(reconciliation_id, entity_type, entity_id, field_name)`. | R5/R8 |
| `backtest_trades` | Checks require `quantity > 0` and `exit_price > 0`, so unfilled/rejected simulated intents cannot be stored. | R4 |
| `backtest_metrics` | No `window_id`; the unique key cannot express per-window walk-forward metrics. | R4 |
| `signals.status` | No `simulated`/`research` value. R3 uses the run scope plus `created`; a status value can be added when R4 needs it. | R4/R5 |

Recording them here prevents R3 from quietly "fixing" a table whose engine does not exist yet.

---

## 6. Research evaluation pipeline

### 6.1 API creation flow

`POST /strategies/:id/evaluation-runs`

1. Load the strategy and the requested `strategyVersionId`; it must belong to the strategy.
2. Resolve the registry entry and the schema comparison (`registered`, `invalid_code_ref`,
   `implementation_missing`, `schema_mismatch`). Refuse anything but `registered`.
3. Resolve the parameter config: explicit `configurationVersionId` or the effective `parameters`
   binding at `now`. Resolve the effective `risk` binding too. Validate both payloads. A missing
   risk binding is a `422`: R3 does not invent a risk budget.
4. Resolve the account: the single active account whose mode is `offline` or `research`. If none
   or more than one, `422`.
5. Resolve the universe: all sync-target `EQ` instruments, or the requested subset. Drop the
   index from the tradable set; require exactly one NIFTY 50 index for confirmation and snapshot
   both the tradable set and the market instrument in `universe`.
6. Validate dates: `fromDate <= toDate`, both inside the calendar's loaded range, `toDate` not in
   the future, and at most 750 calendar days. The first in-range days may lack 20 prior complete
   sessions; those days become `warmup` results rather than errors.
7. Reject if an active run exists for the version (`409`).
8. In one transaction: create `job_runs` (`job_name='strategy-evaluation'`, status `queued`,
   payload `{ evaluationRunId }`), create `strategy_evaluation_runs` with `job_run_id`, and build
   the universe snapshot.
9. Enqueue `strategy-evaluation` with `{ jobRunId, evaluationRunId }`, `jobId=jobRunId`,
   `attempts: 1`.
10. On enqueue failure: delete the run and job row, return `503` with the existing
    "background queue is unavailable" shape.
11. Audit `strategy.evaluation_run.created` with the run id and the pinned versions.

### 6.2 Job definition

Add a `strategy-evaluation` job definition bound to the existing `strategy-evaluation` queue, with
job type `research` and stages `prepare`, `evaluate` (the current stage) and `finalize`. The queue
is already registered; only the definition, the processor and the check constraints are missing.
Widen the API `jobType` vocabulary and add the matching web label. There is no schedule.

### 6.3 Worker stages

| Stage | Work |
| ----- | ---- |
| `prepare` | Load the run, pinned versions, configs and universe. Verify registry and parameters. Build the ordered trading-day list between `from_date` and `to_date`; compute the warm-up start (20 sessions before `from_date`). Delete any partial artifacts for this run (retry safety). Mark the run `running`. |
| `evaluate` | For each warm-up day, update the rolling volume/EMA state without persisting. For each in-range day, run preflight, load candles, call the pure evaluator, persist results and signals in one transaction, and emit one quantified progress event. Check cancellation between days. |
| `finalize` | Mark `completed` (or `cancelled`/`failed`), set `finished_at`, store the result summary on `job_runs.result`, and emit the finalize event. |

### 6.4 Day loop

Per trading day:

1. Read the calendar session. If not a normal 09:15-15:30 session, persist one `skipped` result
   per instrument with `special_session` and continue.
2. Read `instrument_day_coverage` for the universe and the index. Mark incomplete instruments
   as `coverage_missing`/`coverage_partial`; if the index is incomplete, skip every instrument
   with `index_insufficient_coverage`.
3. Read `corporate_actions` for the universe with `ex_date` in the warm-up window. Mark those
   instruments `corporate_action`.
4. Load final 1-minute bars for the eligible instruments and the index for the day.
5. Roll up 5-minute bars. Drop an instrument with an incomplete opening range or an incomplete
   decision bar (`opening_range_incomplete`, `decision_bar_incomplete`); drop the day when the
   index bars are missing (`index_data_gap`).
6. Call `evaluateOrbSession` with eligible instruments, bars, market bars, volume history, capital,
   parameters and risk.
7. In one transaction: delete existing results/signals for `(run_id, day)` (retry safety) and
   insert the result rows and the signal rows. After the commit, update the in-memory rolling
   volume history.
8. Emit progress `{ index, total, tradingDate, evaluated, entries, exits }`.

The day loop is batched by day, so a 250-day run never holds a year in memory. Warm-up state is
bounded: per instrument the last 20 sessions of slot volumes; for the index the last 200 five-minute
closes.

### 6.5 Idempotency, retries, cancellation, failure

- **Retries.** `attempts: 1`. A failed run is re-run as a new run, not retried in place. If a job
  is somehow retried, `prepare` deletes the run's results/signals first, so the output is
  deterministic.
- **Per-day idempotency.** The transaction deletes `(run_id, day)` rows before inserting, so a
  crash between days cannot duplicate a day.
- **Cancellation.** The operator cancels through the existing job cancel route or
  `POST /strategies/:id/evaluation-runs/:runId/cancel`. The worker checks the job-run status
  between days, marks the run `cancelled` and leaves completed days in place. The UI labels the
  run partial.
- **Overlap.** The partial unique index plus a `409` prevents two active runs for the same
  strategy version. Different versions may be queued; this processor runs one job at a time to
  keep candle reads predictable.
- **Failure.** Any uncaught error marks the run `failed` with `{ code, message, day }`, keeps
  completed days, and fails the job. The operator can start a new run.

### 6.6 Performance envelope

- 750-day and 200-instrument caps.
- One day-batched query per table, not one per instrument; numeric text is converted once per day.
- A 250-day, 51-instrument run is expected to finish in minutes; progress per day keeps a long run
  visibly alive.

---

## 7. API surface

Standard API conventions apply (see `AGENTS.md`): routes under `/api/v1`, session auth and
Swagger-decorated request/response DTOs. Reads are available to every authenticated role; create
and cancel require `admin`, and the dashboard hides them otherwise.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/strategies/:id/evaluation-runs` | Create and enqueue a run. `202`. |
| `GET` | `/strategies/:id/evaluation-runs` | Paginated run list (`status`, `from`, `to`, `limit`, `offset`). |
| `GET` | `/strategies/:id/evaluation-runs/:runId` | Run detail, pinned versions, summary counts. |
| `GET` | `/strategies/:id/evaluation-runs/:runId/results` | Paginated instrument-day results (`date`, `status`, `reasonCode`, `instrumentId`). |
| `GET` | `/strategies/:id/evaluation-runs/:runId/signals` | Paginated signals for a run. |
| `GET` | `/strategies/:id/signals` | Paginated signals across runs (`runId`, `from`, `to`, `instrumentId`, `signalType`). |
| `GET` | `/strategies/:id/signals/:signalId` | Signal detail including the full evidence object. |
| `POST` | `/strategies/:id/evaluation-runs/:runId/cancel` | Cooperatively cancel. |

`GET /strategies/:id` gains the `runtime` object. `GET /strategies` gains `runtimeStatus`.

Create-run request: required `strategyVersionId`, `fromDate`, `toDate`, positive `initialCapital`;
optional `configurationVersionId`, `instrumentIds` (subset of sync-target equities) and `note`.

Validation and error rules:

| Status | Condition |
| ------ | --------- |
| `400` | Bad dates, range too long, malformed UUID/list, unknown filter. |
| `403` | Non-admin mutation. |
| `404` | Strategy, version, run or signal not found under the strategy. |
| `409` | Active run for the strategy version. |
| `422` | Version not registered, schema mismatch, config invalid, account missing/ambiguous, instrument not a sync target, index missing. |
| `503` | Queue unavailable; the run and job rows are rolled back. |

Swagger documents the non-200 outcomes (`202`/`409`/`422`) and every path/query parameter, per the
AGENTS.md Swagger rule. The `strategies` tag already exists.

Audit actions: `strategy.evaluation_run.created`,
`strategy.evaluation_run.cancelled`.

---

## 8. Dashboard

### 8.1 Routes

| Route | Content |
| ----- | ------- |
| `/strategies` (existing) | Add a "Runtime" column: Registered / Unregistered / Invalid. Add "Last run" status. |
| `/strategies/[id]` (existing) | Add a Runtime section (registry status, implementation version, schema match, pinned config) and actions: Run evaluation, View evaluations. |
| `/strategies/[id]/evaluations` (new) | Run list with status, date range, capital, entries/exits, created time; status/date filters; Run evaluation dialog. |
| `/strategies/[id]/evaluations/[runId]` (new) | Run header, summary tiles, signal table, instrument-day results table, evidence dialog. |

Reuse the existing origin-aware back-link helpers. Add route titles to the page metadata registry;
no new sidebar item is needed because the pages are nested under Strategies.

### 8.2 Page composition

Reuse the existing R1/R2 primitives rather than introducing a new design language: page meta and
detail header, stat cards and section cards; table card with summary, filters, pagination and page
size; status badges, empty state, detail dialog, key-value grid and JSON block; table actions and
refresh; the shared form-mutation + toast pattern; and the existing dialog pattern for the create
form.

New labels: evaluation statuses, signal types, reason codes and runtime statuses. The shared
`label()` helper already humanises snake case; add deliberate overrides ("Below VWAP", "Volume
filter", "Warm-up", "No breakout").

### 8.3 Run detail layout

1. **Header:** strategy code + version, status badge, date range, capital, pinned parameter and
   risk config versions, link to the job ledger.
2. **Summary tiles:** instrument-days evaluated, instruments with signals, entries, exits,
   skipped days, no-signal days. Counts come from the API's aggregate query.
3. **Signals section:** time, instrument, type, reference, entry, stop, target, quantity, status.
   Filters: signal type, instrument, date. Row opens an evidence dialog with the key metrics
   (opening range, VWAP, EMA20/50, volume ratio, R multiple) and the raw `JsonBlock`.
4. **Instrument-day results section:** date, instrument, status, reason, signal count. Filters:
   status, reason, instrument, date. This is the "why no trade" surface.
5. **Research banner:** "Research evaluation on stored candles. No order was sent."
6. **Liveness:** the run detail is server-rendered with a refresh action and a link to
   `/jobs/[jobRunId]` for the live stage rail. R3 does not add a second socket client.

### 8.4 Run creation dialog

- Version select: `validated`/`active` versions only, with the registry badge.
- Parameter config: the effective parameter version, read-only, with its hash.
- Date range: defaults to the last 60 trading days; validates the 750-day cap client-side and
  server-side.
- Capital: defaults to 1,000,000 INR; must be positive.
- Instruments: optional multi-select of sync-target equities; default all.
- Submit posts to the create route; on success go to the run detail or list; on `409`/`422` show
  the API message in the dialog.
- The action is hidden or disabled for non-admin users with an explanatory tooltip.

### 8.5 UX consistency checklist

- Same dark-first theme, spacing, typography and badge tones as R1/R2.
- Money formatted with the existing INR helper; prices at tick precision; quantities as whole
  numbers; dates in IST.
- Every empty state offers the next action ("Run an evaluation", "No signals for this filter").
- Every async state has a loading skeleton analogous to the existing list/detail skeletons.
- Tables scroll horizontally inside their card at 390 px; dialogs scroll, not the page.
- Destructive actions (cancel) use `ConfirmDialog` and explain that completed days remain.
- No new chart library. Tiles and tables are enough for R3; R4 adds the equity curve.
- No order controls, no "Execute" wording, no green/red buy/sell affordances.

---

## 9. Testing and verification

### 9.1 Unit tests

`trading-engine`:

- 5-minute rollup (complete, incomplete, session boundary).
- VWAP (typical price, zero volume).
- EMA20/EMA50 (seed, recursion, 200-bar window, warm-up).
- Median slot volume (odd/even, missing sessions, zero median).
- Direction-aware tick rounding.
- Session-book and scope helpers.

`strategies`:

- Registry lookup, `code_ref` parsing and schema mismatch.
- Parameter validation: unknown key, wrong type, out-of-range, valid v1 payload.
- ORB golden sessions:
  1. breakout with all confirmations → entry, then target.
  2. no breakout.
  3. below VWAP.
  4. market filter fail.
  5. volume filter fail.
  6. entry-window boundary (14:10 accepted, 14:15 rejected).
  7. one entry per instrument.
  8. max two entries per day.
  9. max one open position: second candidate blocked while open, allowed after exit.
  10. unsizeable.
  11. invalid stop/tick.
  12. stop and target in the same bar → stop.
  13. EOD exit at 15:15.
  14. special session.
  15. partial coverage.
  16. missing index.
  17. corporate-action skip window.
  18. determinism: two evaluations produce identical signals.
- Evidence contains every metric named in the contract and no unbounded arrays.

### 9.2 Integration tests

`tests/integration` (testcontainers, as in R1/R2):

- Migrate from empty and seed.
- Assert 58 tables, the new tables/indexes, the seven dropped columns, version 2 and its binding.
- Insert a synthetic 1-minute dataset for two equities and the NIFTY index across 25 sessions
  (one breakout day). Reuse the seeded instruments and tick sizes.
- Create a run through the repository, execute the worker service with a stub tracker, and assert:
  one entry and one exit signal, the expected results rows, and skip reasons for the non-breakout
  day.
- Re-run the same day and assert no duplicate signals (idempotent delete/insert).
- Cancel between days and assert the run is `cancelled` and partial results are readable.

### 9.3 API tests

- Strategy service tests: create validation, registry rejects, active-run conflict, enqueue
  failure rollback, audit call and cancel delegation.
- DTO validation for dates, capital, list size and UUIDs.
- Swagger metadata compiles (the Nest build does this).

### 9.4 Contract tests

Update the strategy contract test:

- The registry exposes `orb-15m` with implementation `opening-range-breakout` version `1.0.0`.
- A synthetic session returns the expected signal, not `[]`.
- The database-facing packages are not imported by `strategies`.
- The existing no-order tests still pass: no order module in `AppModule`, no order method in the
  Upstox adapter, no route in the placeholder order controller.

### 9.5 Verification gates

- `pnpm db:migrate`, `pnpm db:seed` and `pnpm db:verify` from empty and from seeded R2.
- `pnpm lint` (includes the boundary check) and typecheck for the touched projects.
- Unit tests for `trading-engine` and `strategies`, API and worker tests, broker contracts and the
  integration suite.
- No browser verification by policy; visual review is the operator's.

### 9.6 Documentation updates

- `docs/strategies/opening-range-breakout.md`: status implemented; rule-to-parameter mapping;
  R3 assumptions (limit fills at the limit, no costs/slippage).
- `docs/operations/schema-column-audit.md`: append the R3 audit, the seven removals and the two
  new tables.
- `docs/operations/job-ledger.md`: `strategy-evaluation`, stages `prepare`/`evaluate`/`finalize`,
  one row per run, cancellation semantics.
- `docs/operations/implementation-notes.md`: R3 decisions, deviations and open checks.
- `context/current-implementation.md`: R3 delivered, 58 tables, new tables/job/routes.
- `context/deployment-order.md`: R3 status.
- `AGENTS.md`: release status and the new job if the "current release" sentence changes.

---

## 10. Work plan

Seven phases. Each phase ends with a green targeted check; the full gates run at the end.

### Phase 0 — Freeze the contract and fixtures

- Write the session-scoped contract and the shared parameter schema in the domain and
  trading-engine packages.
- Add the workspace dependencies (`strategies` to the API and worker, `ajv` to `strategies`).
- Add synthetic session fixtures: 25 normal sessions, one breakout day, one no-breakout day, one
  partial-coverage day, one special session.
- Decide and document the evidence shape, reason codes, EMA seeding, VWAP definition and entry
  fill assumption.
- Acceptance: the contract types compile; the fixtures are checked in; the evidence and reason
  tables are reviewed.

### Phase 1 — Schema and cleanup

- Write `0020_r3_strategy_evaluation.sql` and `0021_r3_drop_dead_columns.sql`.
- Update the Drizzle schema, `verify.ts`, the database integration test and the seed.
- Update repositories for runs/results/signals and remove the dropped columns from every select
  and insert.
- Acceptance: migrate from empty and from seeded R2; `db:verify` reports 58 tables and the new
  objects; typecheck and tests pass.

### Phase 2 — Engine

- Implement the 5-minute rollup, VWAP, EMA, median volume, tick rounding and the session book.
- Implement the ORB evaluator with the reason matrix.
- Add the golden tests and the determinism test.
- Acceptance: all rule fixtures pass; no database or network import in the strategy packages.

### Phase 3 — Registry and validation

- Implement the registry, schema comparison, `ajv` validation and the runtime status helper.
- Seed `orb-15m` version 2 and bind the existing configs.
- Wire `GET /strategies` and `GET /strategies/:id` runtime status.
- Acceptance: unknown code/version and schema mismatch fail with actionable errors; seeded v2
  resolves; the placeholder contract test is replaced.

### Phase 4 — Pipeline

- Add the job definition, the worker processor and the module registration.
- Implement run creation, transaction, enqueue, rollback, cancellation and audit in the API.
- Implement the day loop, preflight, persistence and progress events.
- Acceptance: a synthetic run completes; a retried day is idempotent; cancel leaves a labelled
  partial run; one active run per version is enforced.

### Phase 5 — Surface

- Add the run, result and signal read APIs and DTOs.
- Add the evaluations list/detail routes, the run dialog, the signal evidence dialog and the
  runtime section.
- Add labels, types, route metadata and action-toast flags.
- Acceptance: server-rendered pages match the existing layout; filters/pagination/empty states
  are consistent; no order affordance exists; `pnpm lint` passes.

### Phase 6 — Proof and handover

- Run a real evaluation on the seeded dataset if the backfill covers the NIFTY index and the
  instruments; otherwise run the synthetic integration proof and record the data gate as open.
- Update the strategy, schema, job, implementation and release docs.
- Run the full gates.
- Acceptance: a run with at least one entry and one exit is visible end to end; every closed
  reason is explainable from stored evidence; the hand-off to R4 lists costs, slippage, fills,
  equity curve, metrics and promotion.

---

## 11. Risks and guardrails

| Risk | Guardrail |
| ---- | --------- |
| NIFTY index candles are missing or partial. | Preflight skips with `index_*` reasons; the UI explains it; R3 does not fabricate a market filter. |
| Corporate actions distort the opening range or EMAs. | Skip the instrument-day when an action is in the warm-up window; R4 adds adjustment. |
| Float drift makes signals non-deterministic. | Convert once, round with the tick, store 4/6 decimals, replay test. |
| A long run blocks the worker. | 750-day cap, day batching, concurrency 1 for this queue, cancellation between days, progress per day. |
| Two runs overlap or a retry duplicates signals. | Partial unique active-run index, `409`, per-day delete/insert, decision unique indexes. |
| A database version points at missing code. | Registry resolution refuses the run before enqueue. |
| Strategy/config drift between runs. | Immutable version/config rows, pinned on the run, schema deep-equality. |
| The UI implies execution. | Research banner, "Signal" wording, no buy/sell colors or controls, status `created`. |
| Dropping a column breaks a hidden select. | `rg` per column, typecheck, integration migration, `db:verify` absence checks. |
| Special sessions break the clock rules. | Explicit `special_session` skip, no silent window shift. |
| `pnpm lint` boundary check fails from a new import. | `strategies` imports only `domain`/`trading-engine`; API/worker own all I/O. |

---

## 12. Acceptance / definition of done

R3 is done when all of these are true:

1. The registry resolves `orb-15m` version 2 to `opening-range-breakout@1.0.0`; unknown versions
   and schema mismatches fail with a specific error.
2. The ORB evaluator implements every rule in `context/strategy1.md` that can be evaluated from
   stored candles, and every unimplemented rule (daily loss limit, kill switch, live fills) is
   named as out of scope.
3. A research run persists one entry and its exit for a breakout fixture, one `no_signal` result
   for a no-breakout fixture, and one `skipped` result for a partial-coverage fixture; each has a
   reason code and evidence.
4. Re-running the same inputs produces the same signals; re-running the same day produces no
   duplicates.
5. The dashboard shows the run, its signals and its instrument-day results with the existing
   components, with empty/loading/error states and the responsive rules used by R1/R2. Visual
   review is the operator's; no browser verification is performed.
6. No order, fill, position or trade-cost row is written; no order route or broker write method
   exists; the broker-contract tests still pass.
7. The seven dead columns are gone, the two new tables exist, `db:verify` reports 58 tables and
   the strategy version 2 binding.
8. `pnpm lint`, the targeted typecheck/tests and the integration suite pass.
9. The docs listed in §9.6 are updated.
10. The R4 hand-off lists the pinned run inputs, the signal/evidence contract and the deferred
    schema defects.

---

## Appendix A — ORB parameter schema and seeded values

Required by the seeded schema (13):

| Parameter | Seed value | Use |
| --------- | ---------- | --- |
| `openingRangeStart` | `09:15` | Opening-range start. |
| `openingRangeEnd` | `09:30` | Opening-range end. |
| `signalTimeframe` | `5m` | Decision bars. |
| `entryWindowStart` | `09:30` | First decision bar start. |
| `entryWindowEnd` | `14:15` | Last decision bar close. |
| `emaFastPeriod` | `20` | NIFTY EMA20. |
| `emaSlowPeriod` | `50` | NIFTY EMA50. |
| `volumeLookbackSessions` | `20` | Same-slot median window. |
| `volumeRatioMin` | `1.5` | Volume multiple. |
| `targetRMultiple` | `1.5` | Target. |
| `maxEntriesPerDay` | `2` | Daily entries. |
| `maxOpenPositions` | `1` | Open positions. |
| `eodExitTime` | `15:15` | End-of-day exit. |

Present in the seeded config but optional in the schema (the implementation defaults them):

| Parameter | Seed value | Use |
| --------- | ---------- | --- |
| `vwapConfirmation` | `true` | Require close > VWAP. Default `true`. |
| `stopMode` | `breakout_candle_low_minus_tick` | Stop rule. Default is the only supported mode in R3. |
| `maxEntriesPerStockPerSession` | `1` | One entry per stock. Default `1`. |
| `priceProtection` | `true` | Marketable limit. Default `true`. |
| `entryProtectionTicks` | not present | Entry limit = breakout close + N ticks. Default `1`. |
| `emaLookbackBars` | not present | Deterministic EMA window. Default `200`. |
| `marketInstrumentSymbol` | not present | Market confirmation instrument. Default `NIFTY 50`. |
| `marketInstrumentExchange` | not present | Market confirmation exchange. Default `NSE`. |

Risk config used for sizing: `riskPerTradePct=0.005`, `maxOpenPositions=1`,
`maxEntriesPerDay=2`. Duplicate limits use the stricter value. `dailyLossLimitPct`,
`killSwitchEnabled` and `staleDataSeconds` are recorded but not enforced in R3.

## Appendix B — Evaluation evidence

Signal evidence is a bounded, versioned object with these groups:

| Group | Contents |
| ----- | -------- |
| `evidenceVersion` | `1`. |
| `strategy` | Code, `codeRef`, parameter/config hash. |
| `session` | Trading date, open and close times. |
| `openingRange` | High and low. |
| `decisionBar` | Start, OHLC and volume. |
| `vwap` | Decision-bar VWAP. |
| `market` | Index symbol, close, EMA20, EMA50. |
| `volume` | Slot, median and ratio. |
| `pricing` | Tick size, entry, stop, target and risk per share. |
| `sizing` | Capital, risk percent, by-risk, by-cash and quantity. |
| `exitPlan` | Stop mode and target R multiple. |

Result diagnostics carry a `diagnosticsVersion`, coverage counts, the session window, the opening
range, at most 10 breakout candidates (start, close, breakout, VWAP, market pass, volume ratio,
qualified) and the primary reason plus the portfolio state.

Evidence is explanatory, not a replay format. R4 stores its own `signal_snapshot`.

## Appendix C — Hand-off to R4 and R5

**R4 (backtesting):**
- Reuse the pure ORB evaluator; replace the R3 fill assumption with a fill model, add costs and
  slippage, equity curve, metrics and promotion.
- Pin the universe snapshot, the parameter and risk configuration versions and the corporate-action
  treatment.
- Add `backtest_metrics.window_id` and a place for unfilled/rejected intents.
- Do not re-derive signals from R3 rows; R3 rows are research output, not a backtest replay log.

**R5 (live signals, risk, orders):**
- Set `signals.trading_session_id` and leave `evaluation_run_id` null.
- Move the session-book limits into the independent risk engine; add `risk_decisions`.
- Add the live index quote and stale-data checks.
- Fix the deferred defects in §5.8 in the release that owns each table.

## Appendix D — Open checks

1. NIFTY 50 index coverage for the full evaluation range; without it, market confirmation cannot
   be evaluated.
2. Corporate-action import completeness for the universe; the skip window is only as good as the
   data.
3. Tick-size history: the current tick is applied to historical bars; if a tick changed inside the
   range, evidence records the current tick, not the historical one. R4/TBD.
4. Volume-slot alignment on days with missing bars; incomplete sessions are excluded from the
   median, which can delay signals after a data gap.
5. EMA seeding choice (SMA seed) is documented; a different seed changes the first bars after
   warm-up, not later bars.
6. Entry fill assumption (limit fills at the limit) is a research assumption; R4 replaces it.
7. The 750-day and 200-instrument caps are operational defaults, not business rules.
