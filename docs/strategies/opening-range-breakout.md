# Opening Range Breakout (15-minute)

Implementation package: `packages/strategies/opening-range-breakout`.

The authoritative rule set is `context/strategy1.md`. Summary:

- Universe: 20 liquid NSE cash equities, refreshed weekly using trailing 20-session median traded value.
- Opening range: 09:15–09:30 IST.
- Signal timeframe: five-minute candles.
- Entry window: 09:30–14:15 IST.
- Breakout: a completed five-minute candle closes above the opening-range high.
- Confirmations: close above intraday VWAP; NIFTY 50 above its 20-period EMA and 20 EMA above 50 EMA;
  breakout volume at least 1.5× the same-slot median over the preceding 20 sessions.
- Execution: price-protected marketable limit order; cancel rather than chase.
- Stop: one tick below the breakout candle low.
- Target: 1.5× the entry-to-stop risk.
- Limits: one entry per stock per session; one open position; two new entries per day.
- Exit: close remaining positions by 15:15 IST.
- Sizing: risk-budget sizing subject to available cash and whole shares; skip if it cannot be sized.

## Status

The package currently contains the shared `Strategy` contract placeholder only. Entry rules, indicators and
sizing are implemented in R3 and validated through the R4 backtesting engine.
