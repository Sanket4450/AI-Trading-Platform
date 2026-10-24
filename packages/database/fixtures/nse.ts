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
 * replaces these rows when a provider is configured. Dates are intentionally
 * conservative: weekends are always non-trading, and these are the widely
 * observed national market holidays.
 */
export const nseHolidays: Record<string, string> = {
  '2026-01-26': 'Republic Day',
  '2026-03-04': 'Holi',
  '2026-03-21': 'Eid-Ul-Fitr',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day',
  '2026-08-15': 'Independence Day',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-11-08': 'Diwali Laxmi Pujan',
  '2026-11-09': 'Diwali Balipratipada',
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
