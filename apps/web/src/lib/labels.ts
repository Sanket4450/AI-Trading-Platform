const LABEL_OVERRIDES: Record<string, string> = {
  api_key: 'API key',
  api_secret: 'API secret',
  access_token: 'Access token',
  refresh_token: 'Refresh token',
  totp_secret: 'TOTP secret',
  broker_user_ref: 'Broker user reference',
  partial_reconciled: 'Gaps · reconciled',
  partial_mismatch: 'Gaps · mismatch',
  not_requested: 'Not requested',
  not_applicable: 'Not applicable',
  not_checked: 'Not checked',
  needs_review: 'Needs review',
  liquidity_median_value: 'Median traded value',
  index_constituents: 'Index constituents',
  session_open: 'Session open',
  session_close: 'Session close',
  broker_sync: 'Broker sync',
  intraday_sync: 'Intraday sync',
  instrument_master: 'Instrument master',
  historical_backfill: 'Historical backfill',
  historical_repair: 'Historical repair',
  quote_snapshot: 'Quote snapshot',
  corporate_actions: 'Corporate actions',
  daily_validation: 'Daily validation',
  quality_scan: 'Quality scan',
  mapping_missing: 'Mapping missing',
  unsupported_instrument: 'Unsupported instrument',
  volume_reconciled: 'Volume reconciled',
  volume_mismatch: 'Volume mismatch',
  ohlc_mismatch: 'OHLC mismatch',
  daily_missing: 'Daily missing',
  minute_missing: 'Minute missing',
  upstream_error: 'Upstream error',
  part_of_day: 'Part of day',
  co: 'Cover order',
  mtf: 'MTF',
  ioc: 'IOC',
  sl: 'Stop loss',
  sl_m: 'Stop loss market',
  NSE_EQ: 'NSE equity',
  NSE_INDEX: 'NSE index',
  BSE_EQ: 'BSE equity',
  BSE_INDEX: 'BSE index',
};

const ACRONYMS = new Set([
  'api',
  'bse',
  'csv',
  'http',
  'id',
  'ids',
  'isin',
  'json',
  'ltp',
  'ms',
  'nse',
  'ohlc',
  'pct',
  'sha',
  'totp',
  'ttl',
  'url',
  'utc',
  'uuid',
  'vwap',
]);

const SETTING_LABELS: Record<string, string> = {
  'system.instance_name': 'Instance name',
  'system.trading_mode': 'Trading mode',
  'ui.theme': 'Theme',
  'ui.timezone': 'Display timezone',
  'data.retention.quotes_days': 'Quote retention (days)',
  'data.retention.raw_payload_days': 'Raw payload retention (days)',
  'data.retention.raw_payload_months': 'Raw payload retention (months)',
  'data.quality.max_gap_minutes': 'Maximum gap (minutes)',
  'data.quality.volume_tolerance_pct': 'Volume tolerance (%)',
  'data.quality.stale_hours': 'Stale after (hours)',
  'data.status.stale_sessions': 'Stale after (sessions)',
  'data.validation.daily_oracle': 'Daily oracle',
  'security.session_ttl_hours': 'Session lifetime (hours)',
  'seed.fixture_version': 'Seed fixture version',
};

/** Turns an enum or identifier into operator-facing words without leaking underscores. */
export function humanize(value: string): string {
  const words = value
    .split(/[_.]/)
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase();
      return ACRONYMS.has(lower) ? lower.toUpperCase() : lower;
    });

  const [first, ...rest] = words;
  if (!first) return '';
  const head = ACRONYMS.has(first.toLowerCase())
    ? first
    : first.charAt(0).toUpperCase() + first.slice(1);
  return [head, ...rest].join(' ');
}

/** Maps a stored value to a display label, falling back to a readable form of the code. */
export function label(value: string | null | undefined, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return LABEL_OVERRIDES[value] ?? humanize(value);
}

/** Audit actions are stored as dotted codes such as `configuration.created`. */
export function formatAction(action: string): string {
  return LABEL_OVERRIDES[action] ?? humanize(action.replaceAll('.', '_'));
}

/** System setting keys are namespaced; show the operator-facing name, keep the key as evidence. */
export function formatSettingKey(key: string): string {
  const mapped = SETTING_LABELS[key];
  if (mapped) return mapped;
  const segments = key.split('.').filter(Boolean);
  return humanize(segments.at(-1) ?? key);
}
