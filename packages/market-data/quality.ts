import { sha256Hex } from '@ai-trading/domain';
import type { QualityFinding, QualityRule } from './types.js';

export const QUALITY_RULES: readonly QualityRule[] = [
  {
    ruleId: 'DQ-001',
    issueType: 'missing_bar',
    dimension: 'completeness',
    defaultSeverity: 'warning',
    description: 'An expected session minute is absent.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-002',
    issueType: 'gap',
    dimension: 'completeness',
    defaultSeverity: 'warning',
    description: 'Two or more consecutive minutes are absent; critical inside protected windows.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-003',
    issueType: 'coverage_shortfall',
    dimension: 'completeness',
    defaultSeverity: 'critical',
    description: 'A scheduled trading day has zero bars or a volume shortfall.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-004',
    issueType: 'partial_bar',
    dimension: 'completeness',
    defaultSeverity: 'info',
    description: 'The final bar of the current session is not final.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-005',
    issueType: 'calendar_mismatch',
    dimension: 'completeness',
    defaultSeverity: 'critical',
    description: 'Candles contradict the reviewed calendar or session window.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-006',
    issueType: 'missing_bar',
    dimension: 'completeness',
    defaultSeverity: 'warning',
    description: 'The first bar after the open or the last bar before the close is absent.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-007',
    issueType: 'invalid_ohlc',
    dimension: 'validity',
    defaultSeverity: 'critical',
    description: 'A tuple is structurally invalid and was rejected.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-008',
    issueType: 'schema_invalid',
    dimension: 'validity',
    defaultSeverity: 'critical',
    description: 'The response envelope or tuple shape is not the documented contract.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-009',
    issueType: 'duplicate_bar',
    dimension: 'validity',
    defaultSeverity: 'warning',
    description: 'The same timestamp appears more than once with conflicting values.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-010',
    issueType: 'outlier',
    dimension: 'validity',
    defaultSeverity: 'warning',
    description: 'A minute extreme is outside the daily range or an unexplained jump occurred.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-011',
    issueType: 'tick_size_mismatch',
    dimension: 'validity',
    defaultSeverity: 'warning',
    description: 'A price is not aligned to the instrument tick size.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-012',
    issueType: 'volume_mismatch',
    dimension: 'consistency',
    defaultSeverity: 'critical',
    description: 'Minute volume differs from the daily volume beyond tolerance.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-013',
    issueType: 'volume_reconciled',
    dimension: 'consistency',
    defaultSeverity: 'info',
    description: 'Missing minutes had no trades; the daily volume proves it.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-014',
    issueType: 'outlier',
    dimension: 'consistency',
    defaultSeverity: 'warning',
    description: 'The minute aggregate differs from the daily candle by more than one tick.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-015',
    issueType: 'provider_revision',
    dimension: 'consistency',
    defaultSeverity: 'warning',
    description: 'A refetch returned a different final value for an existing final bar.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-016',
    issueType: 'coverage_shortfall',
    dimension: 'consistency',
    defaultSeverity: 'critical',
    description: 'The daily oracle or the minute side is missing for a scheduled day.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-017',
    issueType: 'mapping_missing',
    dimension: 'reference',
    defaultSeverity: 'critical',
    description: 'No primary provider mapping exists for the instrument.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-018',
    issueType: 'instrument_missing',
    dimension: 'reference',
    defaultSeverity: 'critical',
    description: 'The provider or master omits an expected instrument.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-019',
    issueType: 'unsupported_instrument',
    dimension: 'reference',
    defaultSeverity: 'info',
    description: 'The instrument type or segment is outside the R2 whitelist.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-020',
    issueType: 'corporate_action_mismatch',
    dimension: 'reference',
    defaultSeverity: 'critical',
    description: 'A price or volume discontinuity implies an unconfirmed corporate action.',
    blocksPreflightWhenCritical: true,
  },
  {
    ruleId: 'DQ-021',
    issueType: 'stale_ingestion',
    dimension: 'timeliness',
    defaultSeverity: 'warning',
    description:
      'The latest completed session has no successful ingestion within the freshness window.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-022',
    issueType: 'rate_limit_exhausted',
    dimension: 'timeliness',
    defaultSeverity: 'warning',
    description: 'A run exhausted its retry budget on provider throttling.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-023',
    issueType: 'stale_ingestion',
    dimension: 'timeliness',
    defaultSeverity: 'warning',
    description: 'A running chunk exceeded the heartbeat window and was recovered.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-024',
    issueType: 'coverage_shortfall',
    dimension: 'timeliness',
    defaultSeverity: 'info',
    description: 'A coverage verdict is older than the latest candle for the same instrument-day.',
    blocksPreflightWhenCritical: false,
  },
  {
    ruleId: 'DQ-025',
    issueType: 'duplicate_mapping',
    dimension: 'reference',
    defaultSeverity: 'warning',
    description: 'More than one primary mapping resolves to an instrument.',
    blocksPreflightWhenCritical: false,
  },
] as const;

export const QUALITY_RULE_BY_ID = new Map(QUALITY_RULES.map((rule) => [rule.ruleId, rule]));

export function qualityRule(ruleId: string): QualityRule {
  const rule = QUALITY_RULE_BY_ID.get(ruleId);
  if (!rule) throw new Error(`Unknown quality rule ${ruleId}`);
  return rule;
}

export function isCriticalSeverity(severity: string): boolean {
  return severity === 'critical';
}

/**
 * Stable key: rule, provider, instrument, date and window. Re-running a scan
 * increments the same issue instead of creating a duplicate.
 */
export function qualityDedupeKey(input: {
  ruleId: string;
  providerId: string | null;
  instrumentId: string | null;
  tradingDate: string | null;
  windowStart: Date | null;
  windowEnd: Date | null;
}): string {
  return sha256Hex(
    [
      input.ruleId,
      input.providerId ?? '',
      input.instrumentId ?? '',
      input.tradingDate ?? '',
      input.windowStart?.toISOString() ?? '',
      input.windowEnd?.toISOString() ?? '',
    ].join('|'),
  );
}

export function qualityFinding(input: Omit<QualityFinding, 'dedupeKey'>): QualityFinding {
  return {
    ...input,
    dedupeKey: qualityDedupeKey(input),
  };
}

/** The opening range, entry cutoff and exit window are stricter than the day. */
export function gapSeverity(input: {
  tradingDate: string;
  gapStart: Date;
  gapMinutes: number;
  volumeReconciled: boolean;
  maxAcceptedGapMinutes: number;
}): 'warning' | 'critical' {
  if (input.volumeReconciled) return 'warning';
  const istMinutes = input.gapStart.getUTCHours() * 60 + input.gapStart.getUTCMinutes() + 330;
  const minuteOfDay = ((istMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const inProtectedWindow =
    (minuteOfDay >= 9 * 60 + 15 && minuteOfDay < 9 * 60 + 30) ||
    (minuteOfDay >= 14 * 60 + 15 && minuteOfDay < 14 * 60 + 30) ||
    (minuteOfDay >= 15 * 60 + 15 && minuteOfDay < 15 * 60 + 30);
  if (inProtectedWindow && input.gapMinutes > input.maxAcceptedGapMinutes) return 'critical';
  return 'warning';
}
