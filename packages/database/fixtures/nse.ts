/**
 * Deterministic R1 reference fixture.
 *
 * The live Upstox instrument master replaces these mappings when the worker
 * runs with credentials. Until then the seed gives the dashboard, universe
 * selector and strategy registry a complete, offline-safe data set.
 */
export interface EquityFixture {
  symbol: string;
  name: string;
  isin: string | null;
}

export const NIFTY_50_INDEX = {
  symbol: 'NIFTY 50',
  name: 'NIFTY 50',
  externalKey: 'NSE_INDEX|Nifty 50',
} as const;

export const nifty50Constituents: EquityFixture[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', isin: 'INE002A01018' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', isin: 'INE467B01029' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', isin: 'INE040A01034' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', isin: 'INE090A01021' },
  { symbol: 'INFY', name: 'Infosys', isin: 'INE009A01021' },
  { symbol: 'SBIN', name: 'State Bank of India', isin: 'INE062A01020' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', isin: 'INE397D01024' },
  { symbol: 'ITC', name: 'ITC', isin: 'INE154A01025' },
  { symbol: 'LT', name: 'Larsen & Toubro', isin: 'INE018A01030' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', isin: 'INE237A01028' },
  { symbol: 'AXISBANK', name: 'Axis Bank', isin: 'INE238A01034' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance', isin: 'INE296A01024' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', isin: 'INE030A01027' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India', isin: 'INE585B01010' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries', isin: 'INE044A01036' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', isin: 'INE155A01022' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints', isin: 'INE021A01026' },
  { symbol: 'TITAN', name: 'Titan Company', isin: 'INE280A01028' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', isin: 'INE481G01011' },
  { symbol: 'WIPRO', name: 'Wipro', isin: 'INE075A01022' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', isin: 'INE423A01024' },
  { symbol: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone', isin: 'INE742F01042' },
  { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise', isin: 'INE437A01024' },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', isin: 'INE918I01026' },
  { symbol: 'BPCL', name: 'Bharat Petroleum Corporation', isin: 'INE029A01011' },
  { symbol: 'BRITANNIA', name: 'Britannia Industries', isin: 'INE216A01030' },
  { symbol: 'CIPLA', name: 'Cipla', isin: 'INE059A01026' },
  { symbol: 'COALINDIA', name: 'Coal India', isin: 'INE522F01014' },
  { symbol: 'DIVISLAB', name: "Divi's Laboratories", isin: 'INE361B01024' },
  { symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories", isin: 'INE089A01023' },
  { symbol: 'EICHERMOT', name: 'Eicher Motors', isin: 'INE066A01021' },
  { symbol: 'GRASIM', name: 'Grasim Industries', isin: 'INE047A01021' },
  { symbol: 'HCLTECH', name: 'HCL Technologies', isin: 'INE860A01027' },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', isin: 'INE158A01026' },
  { symbol: 'HINDALCO', name: 'Hindalco Industries', isin: 'INE038A01020' },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank', isin: 'INE095A01012' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel', isin: 'INE019A01038' },
  { symbol: 'LTIM', name: 'LTIMindtree', isin: 'INE214T01019' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra', isin: 'INE101A01026' },
  { symbol: 'NESTLEIND', name: 'Nestle India', isin: 'INE239A01024' },
  { symbol: 'NTPC', name: 'NTPC', isin: 'INE733E01010' },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation', isin: 'INE213A01029' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India', isin: 'INE752E01010' },
  { symbol: 'TATACONSUM', name: 'Tata Consumer Products', isin: 'INE192A01025' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', isin: 'INE081A01020' },
  { symbol: 'TECHM', name: 'Tech Mahindra', isin: 'INE669C01036' },
  { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance Company', isin: 'INE795G01014' },
  { symbol: 'SBILIFE', name: 'SBI Life Insurance Company', isin: 'INE123W01016' },
  { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', isin: 'INE917I01010' },
  { symbol: 'SHRIRAMFIN', name: 'Shriram Finance', isin: 'INE721A01013' },
];

export const orbUniverseSymbols = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'ICICIBANK',
  'INFY',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'LT',
  'KOTAKBANK',
  'AXISBANK',
  'BAJFINANCE',
  'HINDUNILVR',
  'MARUTI',
  'SUNPHARMA',
  'TATAMOTORS',
  'ASIANPAINT',
  'TITAN',
  'ULTRACEMCO',
  'WIPRO',
] as const;

/**
 * NSE trading holidays used by the offline seed. The calendar sync job
 * reconciles these rows when a provider is configured. Dates are intentionally
 * conservative: weekends are always non-trading, and these are the widely
 * observed national market holidays. R2 extends the fixture to 2022–2027 and
 * marks the later years provisional until a reviewed exchange list is supplied.
 */
export const nseHolidays: Record<string, string> = {
  '2022-01-26': 'Republic Day',
  '2022-03-01': 'Mahashivratri',
  '2022-03-18': 'Holi',
  '2022-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2022-04-15': 'Good Friday',
  '2022-05-03': 'Eid-Ul-Fitr',
  '2022-08-09': 'Muharram',
  '2022-08-15': 'Independence Day',
  '2022-08-31': 'Ganesh Chaturthi',
  '2022-10-05': 'Dussehra',
  '2022-10-26': 'Diwali Balipratipada',
  '2022-11-08': 'Guru Nanak Jayanti',
  '2022-12-25': 'Christmas',
  '2023-01-26': 'Republic Day',
  '2023-03-07': 'Holi',
  '2023-03-30': 'Ram Navami',
  '2023-04-04': 'Mahavir Jayanti',
  '2023-04-07': 'Good Friday',
  '2023-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2023-05-01': 'Maharashtra Day',
  '2023-06-29': 'Bakri Eid',
  '2023-08-15': 'Independence Day',
  '2023-09-19': 'Ganesh Chaturthi',
  '2023-10-02': 'Mahatma Gandhi Jayanti',
  '2023-10-24': 'Dussehra',
  '2023-11-14': 'Diwali Balipratipada',
  '2023-11-27': 'Guru Nanak Jayanti',
  '2023-12-25': 'Christmas',
  '2024-01-26': 'Republic Day',
  '2024-03-08': 'Mahashivratri',
  '2024-03-25': 'Holi',
  '2024-03-29': 'Good Friday',
  '2024-04-11': 'Eid-Ul-Fitr',
  '2024-04-17': 'Ram Navami',
  '2024-05-01': 'Maharashtra Day',
  '2024-06-17': 'Bakri Eid',
  '2024-07-17': 'Muharram',
  '2024-08-15': 'Independence Day',
  '2024-10-02': 'Mahatma Gandhi Jayanti',
  '2024-11-15': 'Guru Nanak Jayanti',
  '2024-12-25': 'Christmas',
  '2025-02-26': 'Mahashivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Eid-Ul-Fitr',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-08-15': 'Independence Day',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Mahatma Gandhi Jayanti',
  '2025-10-22': 'Diwali Balipratipada',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas',
  '2026-01-15': 'Municipal Corporation Election',
  '2026-01-26': 'Republic Day',
  '2026-03-03': 'Holi',
  '2026-03-26': 'Ram Navami',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-05-28': 'Bakri Id / Eid-ul-Adha',
  '2026-06-26': 'Muharram',
  '2026-09-14': 'Ganesh Chaturthi',
  '2026-10-02': 'Gandhi Jayanti',
  '2026-10-20': 'Dussehra',
  '2026-11-10': 'Diwali-Balipratipada',
  '2026-11-24': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas',
  '2027-01-26': 'Republic Day',
  '2027-03-22': 'Holi',
  '2027-04-02': 'Good Friday',
  '2027-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2027-05-01': 'Maharashtra Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Mahatma Gandhi Jayanti',
  '2027-12-25': 'Christmas',
};

/**
 * Provisional Muhurat sessions. The exact window is reviewed with NSE
 * circulars before the full backfill; these rows keep the session math honest
 * instead of treating a one-hour session as a 375-minute day.
 */
export const nseSpecialSessions: Record<
  string,
  { open: string; close: string; description: string }
> = {
  '2022-10-24': {
    open: '18:15:00',
    close: '19:15:00',
    description: 'Diwali Laxmi Pujan (Muhurat, provisional)',
  },
  '2024-11-01': {
    open: '18:15:00',
    close: '19:15:00',
    description: 'Diwali Laxmi Pujan (Muhurat, provisional)',
  },
  '2025-10-21': {
    open: '18:15:00',
    close: '19:15:00',
    description: 'Diwali Laxmi Pujan (Muhurat, provisional)',
  },
  '2026-02-01': {
    open: '09:15:00',
    close: '15:30:00',
    description: 'Budget Day Session (live Upstox timings)',
  },
  '2026-11-08': {
    open: '14:20:00',
    close: '15:30:00',
    description: 'Diwali Laxmi Pujan (Muhurat, live Upstox timings)',
  },
};

/**
 * Provisional per-instrument tick sizes. The Upstox BOD master is the
 * authority; these values repair the seeded rows before the first live sync.
 * RELIANCE, HDFCBANK and MARUTI are the documented spot checks.
 */
export const reviewedTickSizes: Record<string, string> = {
  'NIFTY 50': '0.1000',
  RELIANCE: '0.1000',
  HDFCBANK: '0.0500',
  MARUTI: '1.0000',
};

export const defaultEquityTickSize = '0.0500';
