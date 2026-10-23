| Order | Implementation                 | Acceptance condition                                                                                                                   |
| ----- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Historical data collection     | Valid, timestamp-consistent data with missing bars and instrument changes handled explicitly                                           |
| 2     | Historical strategy evaluation | All signals use only information available at the decision timestamp                                                                   |
| 3     | Simulated execution            | Include brokerage, applicable taxes and statutory charges, bid/ask spread, slippage, order rejection and conservative fill assumptions |
| 4     | Development testing            | Use 2022–2024 data for strategy development and parameter selection                                                                    |
| 5     | Validation testing             | Use 2025 data for parameter validation and stability checks                                                                            |
| 6     | Untouched holdout              | Use January–September 2026 data without tuning against those results                                                                   |
| 7     | Walk-forward evaluation        | Repeat testing across chronological windows; retain a complete audit trail of all tested configurations                                |
| 8     | Stress testing                 | Repeat final testing using 1.5 times the baseline estimated slippage                                                                   |
| 9     | Paper trading                  | Run for at least 30 trading sessions and 50 simulated completed trades; extend if the trade count is insufficient                      |
| 10    | Live pilot                     | Start with the smallest practical position sizes and compare actual execution against simulated execution                              |

### Strategy promotion gates

| Metric                      | Initial acceptance threshold                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| Out-of-sample sample size   | At least 200 closed trades; otherwise extend validation                 |
| Net expectancy              | Positive after all modeled trading costs                                |
| Profit factor               | At least 1.2 on untouched out-of-sample results                         |
| Maximum historical drawdown | No more than 8% of equity                                               |
| Walk-forward consistency    | Positive net expectancy in at least 70% of tested windows               |
| Slippage stress test        | Net expectancy remains positive                                         |
| Paper-trading behaviour     | No critical risk-control or order-state defects                         |
| Actual execution            | Reconciled fills, costs and positions with no unexplained discrepancies |
