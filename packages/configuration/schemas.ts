export const riskConfigurationSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'riskPerTradePct',
    'dailyLossLimitPct',
    'maxOpenPositions',
    'maxEntriesPerDay',
    'maxDrawdownPct',
    'killSwitchEnabled',
  ],
  properties: {
    riskPerTradePct: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
    dailyLossLimitPct: { type: 'number', exclusiveMinimum: 0, maximum: 1 },
    maxOpenPositions: { type: 'integer', minimum: 1 },
    maxEntriesPerDay: { type: 'integer', minimum: 1 },
    maxDrawdownPct: { type: 'number', minimum: 0, maximum: 1 },
    killSwitchEnabled: { type: 'boolean' },
    staleDataSeconds: { type: 'integer', minimum: 1 },
    requireProtectiveOrder: { type: 'boolean' },
  },
} as const;

export const systemConfigurationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['tradingMode', 'marketTimezone', 'dataStartDate', 'baseCurrency'],
  properties: {
    tradingMode: { type: 'string', enum: ['offline'] },
    marketTimezone: { type: 'string' },
    dataStartDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    baseCurrency: { type: 'string', enum: ['INR'] },
  },
} as const;
