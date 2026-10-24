export type InternalOrderStatus =
  | 'pending_new'
  | 'submitted'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'unknown';

const STATUS_MAP: Record<string, InternalOrderStatus> = {
  'put order req received': 'submitted',
  'validation pending': 'submitted',
  open: 'open',
  'trigger pending': 'open',
  'partially filled': 'partially_filled',
  complete: 'filled',
  cancelled: 'cancelled',
  rejected: 'rejected',
  'modify pending': 'submitted',
  'modification requested': 'submitted',
  'not modified': 'open',
};

/**
 * Upstox order statuses are lower-case, space-separated strings. Unknown
 * values are deliberately surfaced as `unknown` so the caller can raise a risk
 * event rather than guessing a terminal state.
 */
export function mapUpstoxOrderStatus(status: string): InternalOrderStatus {
  return STATUS_MAP[status.trim().toLowerCase()] ?? 'unknown';
}
