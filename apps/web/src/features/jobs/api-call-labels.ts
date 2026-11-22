/**
 * Operator-facing copy for the external API call ledger.
 *
 * The API owns the operation catalogue (method and endpoint template); every label an operator
 * reads lives here so backend configuration carries no presentation copy.
 */

import { EXTERNAL_API_OUTCOMES, EXTERNAL_API_SERVICES } from '@ai-trading/domain';

export const API_SERVICE_LABELS: Record<string, string> = {
  upstox: 'Upstox API',
  'upstox-assets': 'Upstox assets CDN',
};

/**
 * One label per catalogue operation. Read on its own in a table cell, it must say what the call
 * does, which is why the request URL is only shown inside the detail dialog.
 */
export const API_OPERATION_LABELS: Record<string, string> = {
  'historical-candle': 'Historical 1-minute candles',
  'intraday-candle': 'Intraday candles · current session',
  'market-holidays': 'Market holiday calendar',
  'market-timings': 'Market session timings',
  'instrument-master': 'Instrument master download',
};

export const API_OPERATION_HINTS: Record<string, string> = {
  'historical-candle': 'One month of minute candles for a single instrument',
  'intraday-candle': 'The running session for a single instrument',
  'market-holidays': 'NSE holiday list used to reconcile the calendar',
  'market-timings': 'Session open and close for one trading date',
  'instrument-master': 'Full NSE instrument dump used to refresh the master',
};

export interface ApiOutcomeMeta {
  label: string;
  hint: string;
  badgeClass: string;
}

export const API_OUTCOME_META: Record<string, ApiOutcomeMeta> = {
  success: {
    label: 'Succeeded',
    hint: 'Provider returned a valid response',
    badgeClass: 'border-success/30 bg-success/10 text-success',
  },
  contract_error: {
    label: 'Invalid response',
    hint: 'The response arrived but did not match the documented contract',
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  auth_error: {
    label: 'Not authorised',
    hint: 'Credentials were rejected; a retry cannot help',
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  client_error: {
    label: 'Rejected',
    hint: 'The provider refused the request parameters',
    badgeClass: 'border-warning/30 bg-warning/10 text-warning-strong',
  },
  throttled: {
    label: 'Rate limited',
    hint: 'Rate limit hit; the retry waits for the provider window',
    badgeClass: 'border-warning/30 bg-warning/10 text-warning-strong',
  },
  server_error: {
    label: 'Provider error',
    hint: 'The provider failed; safe to retry with backoff',
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  timeout: {
    label: 'Timed out',
    hint: 'No response before the request timeout',
    badgeClass: 'border-warning/30 bg-warning/10 text-warning-strong',
  },
  network_error: {
    label: 'Network failure',
    hint: 'The connection failed before any response arrived',
    badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  unknown: {
    label: 'Unclassified',
    hint: 'The failure did not match any known class',
    badgeClass: 'border-muted/40 bg-muted/20 text-muted-foreground',
  },
};

export const API_OUTCOME_ORDER = [
  'success',
  'throttled',
  'timeout',
  'network_error',
  'server_error',
  'auth_error',
  'client_error',
  'contract_error',
  'unknown',
] as const;

export const API_SCOPE_GROUP_LABELS = {
  path: 'Path parameters',
  query: 'Query parameters',
  body: 'Request body',
} as const;

export const API_SCOPE_GROUP_HINTS = {
  path: 'Values decoded from the request path, before encoding',
  query: 'Values sent in the query string',
  body: 'Request body as sent, with secret fields removed',
} as const;

/** Parameter keys are API vocabulary; this is the only place they become operator language. */
export const API_PARAM_LABELS: Record<string, string> = {
  instrumentKey: 'Instrument key',
  unit: 'Candle unit',
  interval: 'Interval',
  from: 'From date',
  to: 'To date',
  date: 'Trading date',
  exchange: 'Exchange',
  segment: 'Segment',
  orderId: 'Order id',
  quantity: 'Quantity',
  transactionType: 'Transaction type',
  orderType: 'Order type',
  product: 'Product',
};

/** Filter options shared by every provider-call table. */
export const API_SERVICE_OPTIONS = EXTERNAL_API_SERVICES.map((value) => ({
  value,
  label: apiServiceLabel(value),
}));

export const API_OUTCOME_OPTIONS = EXTERNAL_API_OUTCOMES.map((value) => ({
  value,
  label: apiOutcomeMeta(value).label,
}));

export function apiParamLabel(key: string): string {
  if (API_PARAM_LABELS[key]) return API_PARAM_LABELS[key];
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

export function apiServiceLabel(service: string): string {
  return API_SERVICE_LABELS[service] ?? service;
}

/** Falls back to the raw key so an unlabelled catalogue entry is visible, not hidden. */
export function apiOperationLabel(operation: string): string {
  return API_OPERATION_LABELS[operation] ?? operation;
}

export function apiOperationHint(operation: string): string | null {
  return API_OPERATION_HINTS[operation] ?? null;
}

export function apiOutcomeMeta(outcome: string): ApiOutcomeMeta {
  return API_OUTCOME_META[outcome] ?? API_OUTCOME_META.unknown;
}
