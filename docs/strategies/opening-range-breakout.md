# Opening Range Breakout (15-minute)

Implementation package: `packages/strategies/opening-range-breakout`.
Registry code: `orb-15m`. Implementation: `opening-range-breakout@1.0.0`.

The authoritative rule set is `context/strategy1.md` and the R3 plan is
`context/r3-implementation-plan.md`. This document records how the implemented rules map to the
database and the assumptions R3 makes.

## Rule-to-parameter mapping

| Rule | Parameter | Seeded value |
| --- | --- | --- |
| Opening range | `openingRangeStart`, `openingRangeEnd` | `09:15`, `09:30` |
| Decision timeframe | `signalTimeframe` | `5m` |
| Entry window | `entryWindowStart`, `entryWindowEnd` | `09:30`, `14:15` |
| VWAP confirmation | `vwapConfirmation` | `true` |
| NIFTY EMA fast/slow | `emaFastPeriod`, `emaSlowPeriod` | `20`, `50` |
| Deterministic EMA window | `emaLookbackBars` | `200` |
| Same-slot volume window | `volumeLookbackSessions` | `20` |
| Volume multiple | `volumeRatioMin` | `1.5` |
| Stop mode | `stopMode` | `breakout_candle_low_minus_tick` |
| Entry protection | `priceProtection`, `entryProtectionTicks` | `true`, `1` |
| Target | `targetRMultiple` | `1.5` |
| One entry per stock | `maxEntriesPerStockPerSession` | `1` |
| Daily entries | `maxEntriesPerDay` | `2` |
| Open positions | `maxOpenPositions` | `1` |
| End-of-day exit | `eodExitTime` | `15:15` |
| Market instrument | `marketInstrumentSymbol`, `marketInstrumentExchange` | `NIFTY 50`, `NSE` |

The shared schema and defaults live in `packages/domain/strategy/parameters.ts`; the seed and the
strategy both import them so they cannot drift.

## Implemented behaviour

- The evaluator is a pure, session-scoped function. It receives plain bars, index bars, same-slot
  volume history, pinned parameters and risk, and returns plain signals plus one result per
  instrument-day.
- Five-minute bars are built only from five complete, contiguous 1-minute bars. A partial bar is
  never filled.
- The opening range is the five-minute bars from `openingRangeStart` up to, but excluding,
  `openingRangeEnd`. All must be complete.
- Entry: close above the opening-range high, close above cumulative-session VWAP, NIFTY close above
  EMA20 and EMA20 above EMA50, and breakout volume at least `volumeRatioMin ×` the same-slot median
  from the preceding complete sessions.
- Entry price is the breakout close plus `entryProtectionTicks`, rounded up to the tick. The stop is
  one tick below the breakout candle low, rounded down. The target is the entry plus
  `targetRMultiple ×` risk, rounded to the nearest tick.
- Sizing is `min(floor(riskBudget / riskPerShare), floor(capital / entryPrice))`, whole shares only.
  `riskBudget = initialCapital × riskPerTradePct` from the pinned risk configuration.
- One open position across the universe. If two instruments qualify in the same decision bar, the
  higher volume ratio wins and the symbol breaks ties. The daily entry cap is the stricter of the
  strategy and risk values.
- Exits are monitored on 1-minute bars from the next bar: stop when `low <= stop`, target when
  `high >= target`, stop first when both are touched in one bar, and EOD at `eodExitTime`.
- Every instrument-day produces a result row: `signal`, `no_signal` with a primary reason, or
  `skipped` with a data-quality reason. Diagnostics list up to 10 breakout candidates and the
  condition matrix.

## R3 assumptions and scope

- Research only. A signal is not a fill. `signals.status` is `created` and the run scope is
  `evaluation_run_id`; no order, fill, position or trade-cost row is written.
- The entry limit is assumed to fill at the limit. R4 replaces this with a fill model, costs and
  slippage.
- Only normal 09:15–15:30 IST sessions are supported. Special sessions are skipped with
  `special_session`; the clock rules never shift silently.
- Tick size is the current instrument tick. Historical tick changes are not reconstructed.
- Corporate actions in the warm-up window skip the instrument-day; R4 adds adjustment.
- `maxOpenPositions > 1` is not implemented in R3. The session book enforces the one-position rule
  from the plan and records the decision in the run evidence.
- The daily loss limit and kill switch are not enforced in R3; they need realized P&L and belong to
  R5.
- The `below_vwap` reason is reachable only when an earlier decision bar raises cumulative VWAP
  above a later bar that still closes above the opening-range high.

## Open checks

1. NIFTY 50 coverage for the full evaluation range. Without it the market confirmation cannot be
   evaluated and the run records `index_*` reasons.
2. Corporate-action import completeness for the selected universe.
3. Historical tick-size changes.
4. Missing bars inside the 20-session volume window: incomplete sessions are excluded from the
   median, which can delay a signal after a data gap.
5. EMA seeding uses the SMA of the first period; a different seed changes only the bars immediately
   after warm-up.
6. The 750-day and 200-instrument caps are operational defaults.
