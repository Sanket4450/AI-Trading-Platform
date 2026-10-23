| Component             | Technology                                      | Responsibility                                                                                        |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Frontend              | Next.js + TypeScript                            | Dashboard, strategy configurations, backtesting results, risk settings, trade monitoring and reports  |
| Backend API           | NestJS + TypeScript                             | Application services, configuration management, authentication and system orchestration               |
| Background processing | NestJS worker processes                         | Market-data ingestion, strategy evaluation, backtesting and post-market processing                    |
| Database              | PostgreSQL on Neon                              | Persistent source of truth for configurations, market bars, trades, orders, backtests and performance |
| ORM and migrations    | Drizzle                                         | Typed database access and version-controlled schema migrations                                        |
| Cache and job queue   | Redis + BullMQ                                  | Background jobs, temporary market state, distributed locks and job retry management                   |
| Broker integration    | Upstox APIs                                     | Historical and live market data, order management, order updates and position reconciliation          |
| Containerization      | Docker + Docker Compose                         | Reproducible local development, integration testing and containerized deployment                      |
| Production hosting    | Azure Linux VPS                                 | API, frontend and worker deployment with a registered static public IP for trading API access         |
| Monitoring            | Structured application logs, metrics and alerts | System health, execution failures, risk-limit breaches and strategy performance                       |
| AI extension          | OpenRouter or other LLM provider, later         | Optional research and reporting only; not required in the initial release                             |
