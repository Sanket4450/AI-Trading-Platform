| Layer                     | Main components                                      | Responsibility                                                                             |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Presentation              | Next.js dashboard                                    | Controls strategies, backtests, risk settings and operating modes                          |
| Application               | NestJS API                                           | Validates commands and coordinates application workflows                                   |
| Market data               | Upstox adapter + data ingestion worker               | Retrieves historical data and processes live market updates into normalized market bars    |
| Strategy engine           | Strategy registry + strategy interface               | Evaluates market data and emits standardized trading signals                               |
| Risk engine               | Independent risk manager                             | Validates signals, quantity, available capital, stop distance and account-wide risk limits |
| Execution engine          | Order manager + Upstox execution adapter             | Sends orders, processes fills, handles cancellations and tracks order state                |
| Backtesting engine        | Historical-data adapter + simulated execution engine | Replays market data using the same strategy rules as live trading                          |
| Persistence               | PostgreSQL + Drizzle                                 | Stores durable system, trading and analytical records                                      |
| Processing infrastructure | Redis + BullMQ                                       | Runs asynchronous backtests, data retrieval and scheduled processing                       |
| Operations                | Health checks + monitoring                           | Detects stale feeds, unexpected positions, failed orders and unavailable components        |

Execution flow: Market data → normalized market bars → strategy signals → risk validation → order execution → broker-confirmed fills → trade management → post-trade analytics.
