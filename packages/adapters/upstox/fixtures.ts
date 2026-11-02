import type {
  UpstoxCandleResponse,
  UpstoxErrorEnvelope,
  UpstoxHoliday,
  UpstoxInstrument,
  UpstoxMarketTiming,
} from './client.js';

/**
 * Contract fixtures for the provider boundary. They are deliberately small and
 * checked in so tests never depend on a live Upstox token.
 */

export const instrumentMasterFixture: UpstoxInstrument[] = [
  {
    instrument_key: 'NSE_EQ|INE002A01018',
    exchange_token: '2885',
    trading_symbol: 'RELIANCE',
    name: 'Reliance Industries Limited',
    short_name: 'Reliance',
    isin: 'INE002A01018',
    exchange: 'NSE',
    segment: 'NSE_EQ',
    instrument_type: 'EQ',
    lot_size: 1,
    tick_size: 10,
    freeze_quantity: 5000,
    qty_multiplier: 1,
    security_type: 'NORMAL',
    cas_eligible: true,
  },
  {
    instrument_key: 'NSE_EQ|INE040A01034',
    exchange_token: '1333',
    trading_symbol: 'HDFCBANK',
    name: 'HDFC Bank Limited',
    isin: 'INE040A01034',
    exchange: 'NSE',
    segment: 'NSE_EQ',
    instrument_type: 'EQ',
    lot_size: 1,
    tick_size: 5,
  },
  {
    instrument_key: 'NSE_EQ|INE585B01010',
    exchange_token: '10999',
    trading_symbol: 'MARUTI',
    name: 'Maruti Suzuki India Limited',
    isin: 'INE585B01010',
    exchange: 'NSE',
    segment: 'NSE_EQ',
    instrument_type: 'EQ',
    lot_size: 1,
    tick_size: 100,
  },
  {
    instrument_key: 'NSE_EQ|INE0000000001',
    trading_symbol: 'BE-STOCK',
    name: 'Trade-for-trade series',
    isin: 'INE0000000001',
    exchange: 'NSE',
    segment: 'NSE_EQ',
    instrument_type: 'BE',
    lot_size: 1,
    tick_size: 5,
  },
  {
    instrument_key: 'NSE_EQ|INE0000000002',
    trading_symbol: 'SG-STOCK',
    name: 'Government security',
    exchange: 'NSE',
    segment: 'NSE_EQ',
    instrument_type: 'SG',
    lot_size: 1,
    tick_size: 1,
  },
  {
    instrument_key: 'NSE_INDEX|Nifty 50',
    exchange_token: '26000',
    trading_symbol: 'NIFTY',
    name: 'Nifty 50',
    exchange: 'NSE',
    segment: 'NSE_INDEX',
    instrument_type: 'INDEX',
  },
];

export const historicalNormalFixture: UpstoxCandleResponse = {
  status: 'success',
  data: {
    candles: [
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.7, 12345, 0],
      ['2026-09-01T09:16:00+05:30', 1420.7, 1422.1, 1420.4, 1421.9, 9876, 0],
      ['2026-09-01T09:17:00+05:30', 1421.9, 1422.4, 1421.1, 1421.6, 7654, 0],
    ],
  },
};

export const historicalEmptyFixture: UpstoxCandleResponse = {
  status: 'success',
  data: { candles: [] },
};

export const historicalUnsortedFixture: UpstoxCandleResponse = {
  status: 'success',
  data: {
    candles: [
      ['2026-09-01T09:17:00+05:30', 1421.9, 1422.4, 1421.1, 1421.6, 7654, 0],
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.7, 12345, 0],
      ['2026-09-01T09:16:00+05:30', 1420.7, 1422.1, 1420.4, 1421.9, 9876, 0],
    ],
  },
};

export const historicalDuplicateFixture: UpstoxCandleResponse = {
  status: 'success',
  data: {
    candles: [
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.7, 12345, 0],
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.9, 12345, 0],
    ],
  },
};

export const historicalInvalidTupleFixture = {
  status: 'success',
  data: {
    candles: [
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.7, 12345, 0],
      ['2026-09-01T09:16:00+05:30', 1420.7, 1422.1],
    ],
  },
};

export const intradayPartialFixture: UpstoxCandleResponse = {
  status: 'success',
  data: {
    candles: [
      ['2026-09-01T09:15:00+05:30', 1420.5, 1421, 1419.8, 1420.7, 12345, 0],
      ['2026-09-01T15:29:00+05:30', 1430, 1431, 1429, 1430.5, 321, 0],
    ],
  },
};

export const holidaysFixture: UpstoxHoliday[] = [
  {
    date: '2026-01-26',
    description: 'Republic Day',
    holiday_type: 'TRADING_HOLIDAY',
    closed_exchanges: ['NSE', 'BSE'],
    open_exchanges: [],
  },
  {
    date: '2026-11-08',
    description: 'Diwali Laxmi Pujan',
    holiday_type: 'SPECIAL_SESSION',
    closed_exchanges: [],
    open_exchanges: [
      {
        exchange: 'NSE',
        start_time: 1791549000000,
        end_time: 1791552600000,
      },
    ],
  },
];

export const timingsNormalFixture: UpstoxMarketTiming[] = [
  { exchange: 'NSE', start_time: 1790914500000, end_time: 1790937000000 },
];

export const timingsMuhuratFixture: UpstoxMarketTiming[] = [
  { exchange: 'NSE', start_time: 1791549000000, end_time: 1791552600000 },
];

export const error401Fixture: UpstoxErrorEnvelope = {
  status: 'error',
  errors: [
    {
      error_code: 'UDAPI100050',
      message: 'Invalid token used to access API',
      property_path: 'Authorization',
      invalid_value: 'Bearer redacted',
    },
  ],
};

export const error403Fixture: UpstoxErrorEnvelope = {
  status: 'error',
  errors: [
    {
      error_code: 'UDAPI100051',
      message: 'Permission denied',
      property_path: 'Authorization',
    },
  ],
};

export const error404Fixture: UpstoxErrorEnvelope = {
  status: 'error',
  errors: [
    {
      error_code: 'UDAPI100013',
      message: 'Instrument key not found',
      property_path: 'instrument_key',
    },
  ],
};

export const error429Fixture: UpstoxErrorEnvelope = {
  status: 'error',
  errors: [
    {
      error_code: 'UDAPI10005',
      message: 'Rate limit exceeded',
    },
  ],
};

export const error500Fixture: UpstoxErrorEnvelope = {
  status: 'error',
  errors: [
    {
      error_code: 'UDAPI100500',
      message: 'Internal server error',
    },
  ],
};

export const statusErrorFixture = {
  status: 'error',
  data: null,
};

export const malformedJsonFixture = '{not valid json';
