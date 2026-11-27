import { upsertSystemIssue } from '@ai-trading/database';
import {
  issueDedupeKey,
  qualityRule,
  systemIssue,
} from '@ai-trading/market-data';

export type IssueSource = 'ingestion' | 'validation' | 'reconciliation' | 'manual';

/** The identity a finding will occupy, so a writer can read its own prior evidence. */
export function issueKey(values: {
  ruleId: string;
  source: IssueSource;
  providerId: string | null;
  instrumentId: string | null;
  scope: Record<string, unknown>;
}): string {
  const rule = qualityRule(values.ruleId);
  return issueDedupeKey({
    source: values.source,
    kind: rule.issueType,
    providerId: values.providerId,
    instrumentId: values.instrumentId,
    scope: { ruleId: rule.ruleId, ...values.scope },
  });
}

/**
 * Writes one finding into the current-state ledger. The rule id is kept in the
 * payload and in the dedupe scope so two detectors sharing a kind stay distinct.
 */
export async function recordIssue(values: {
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  source: IssueSource;
  providerId: string | null;
  instrumentId: string | null;
  scope: Record<string, unknown>;
  payload: Record<string, unknown>;
}) {
  const rule = qualityRule(values.ruleId);
  await upsertSystemIssue(
    systemIssue({
      source: values.source,
      kind: rule.issueType,
      severity: values.severity,
      providerId: values.providerId,
      instrumentId: values.instrumentId,
      scope: { ruleId: rule.ruleId, ...values.scope },
      payload: { ruleId: rule.ruleId, ...values.payload },
    }),
  );
}
