> **Implementation status:** specification for R5+. Not implemented in R1/R2. The order, fill,
> position and reconciliation tables exist and are empty, the placeholder order modules expose no
> routes, and the Upstox adapter has no order, modify or cancel method.

| Phase                | Required behaviour                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| Signal creation      | Persist the strategy version, configuration, instrument, signal timestamp and intended stop/target            |
| Pre-trade validation | Validate capital, quantity, daily loss, entry count, concurrent exposure and market-data freshness            |
| Order submission     | Assign unique identifiers and submit the order through the Upstox adapter                                     |
| Order tracking       | Process broker acknowledgements, rejections, partial fills, fills, modifications and cancellations            |
| Position management  | Synchronize actual filled quantity, protective exits, target and end-of-day exit                              |
| Reconciliation       | Compare internally recorded orders and positions with the broker's authoritative state                        |
| Post-trade analytics | Calculate net P&L, realized risk, slippage, trading costs, win/loss distribution and rule compliance          |
| Daily reporting      | Display account performance, drawdown, risk-limit incidents and performance against the 8% monthly aspiration |
