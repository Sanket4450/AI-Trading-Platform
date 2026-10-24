export const QUEUES = {
  historicalData: 'historical-data',
  liveMarketData: 'live-market-data',
  strategyEvaluation: 'strategy-evaluation',
  backtestExecution: 'backtest-execution',
  orderReconciliation: 'order-reconciliation',
  postTradeAnalytics: 'post-trade-analytics',
  endOfDaySquareOff: 'end-of-day-square-off',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
