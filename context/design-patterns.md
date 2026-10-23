| Pattern                  | Application                            | Required design outcome                                                                              |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Strategy pattern         | Trading strategies                     | New strategies can be added without modifying existing strategy logic                                |
| Plug-in registry         | Strategy engine                        | Strategies can be independently enabled, disabled, configured and versioned                          |
| Ports and adapters       | Market data and broker integrations    | Upstox can be replaced or supplemented without changing strategy logic                               |
| Modular monolith         | NestJS application                     | Clear module boundaries without premature microservice complexity                                    |
| Event-driven processing  | Signals, orders, fills and risk events | Components communicate through standardized events and persist important state transitions           |
| Shared strategy contract | Backtesting and live execution         | One strategy implementation serves both environments, preventing separate signal logic from drifting |
| Independent risk policy  | Risk engine                            | No strategy can bypass portfolio limits or send orders directly to the broker                        |
| Versioned configuration  | Strategies and risk rules              | Every backtest and live trade records the exact configuration and strategy version used              |
