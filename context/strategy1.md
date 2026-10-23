#### 15-minute Opening Range Breakout

| Rule                | Initial specification                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Stock universe      | 20 liquid NSE cash equities selected using trailing 20-session median daily traded value                                   |
| Universe refresh    | Weekly, using only information available before that trading session                                                       |
| Opening range       | High and low formed between 9:15 AM and 9:30 AM IST                                                                        |
| Signal timeframe    | Five-minute candles                                                                                                        |
| Entry window        | 9:30 AM to 2:15 PM IST                                                                                                     |
| Breakout condition  | A completed five-minute candle closes above the opening-range high                                                         |
| Stock confirmation  | Breakout candle closes above the stock's intraday VWAP                                                                     |
| Market confirmation | NIFTY 50 is above its 20-period EMA on five-minute bars, and its 20-period EMA is above its 50-period EMA                  |
| Volume confirmation | Breakout candle volume is at least 1.5 times the median volume for the same time slot across the preceding 20 sessions     |
| Entry execution     | Submit a price-protected, marketable limit order after the signal is confirmed; cancel rather than chase an unfilled order |
| Initial stop-loss   | One tick below the low of the breakout candle                                                                              |
| Profit target       | 1.5 times the initial entry-to-stop risk                                                                                   |
| Re-entry            | Maximum one entry per stock per session                                                                                    |
| Position management | Maximum one open position at a time                                                                                        |
| Daily trade limit   | Maximum two new entries                                                                                                    |
| End-of-day exit     | Close remaining positions by 3:15 PM IST                                                                                   |
| Position sizing     | Risk-budget sizing, subject to available cash and whole-share quantity                                                     |
| No-trade condition  | Skip trades when the position cannot be sized within the capital and risk constraints                                      |
