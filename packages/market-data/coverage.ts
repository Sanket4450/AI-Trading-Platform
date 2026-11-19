import type { CoverageStatus, CoverageVerdict, GapRun, SessionWindow } from './types.js';
import { boundaryFindings, diffMinutes, expectedMinutes, gapRuns } from './sessions.js';

export function coverageStatus(input: {
  session: SessionWindow | null;
  storedBars: number;
  missingBarCount: number;
  hasCriticalIssue: boolean;
}): CoverageStatus {
  if (!input.session) return 'not_applicable';
  if (input.storedBars === 0) return 'missing';
  if (input.missingBarCount === 0 && !input.hasCriticalIssue) return 'complete';
  return 'partial';
}

/** Strict completeness: every expected session minute is present, or the day is partial. */
export function computeCoverageVerdict(input: {
  session: SessionWindow | null;
  observed: readonly Date[];
  hasCriticalIssue: boolean;
}): CoverageVerdict {
  if (!input.session) {
    return {
      expectedBars: 0,
      storedBars: 0,
      missingBarCount: 0,
      gapRunCount: 0,
      maxGapMinutes: 0,
      firstBarAt: null,
      lastBarAt: null,
      status: 'not_applicable',
      details: { reason: 'not a scheduled trading session' },
    };
  }

  const expected = expectedMinutes(input.session);
  const observed = [...input.observed].sort((a, b) => a.getTime() - b.getTime());
  const missing = diffMinutes(expected, observed);
  const runs: GapRun[] = gapRuns(missing);
  const boundaries = boundaryFindings(expected, observed);

  const status = coverageStatus({
    session: input.session,
    storedBars: observed.length,
    missingBarCount: missing.length,
    hasCriticalIssue: input.hasCriticalIssue,
  });

  return {
    expectedBars: expected.length,
    storedBars: observed.length,
    missingBarCount: missing.length,
    gapRunCount: runs.length,
    maxGapMinutes: runs.reduce((max, run) => Math.max(max, run.minutes), 0),
    firstBarAt: observed[0] ?? null,
    lastBarAt: observed[observed.length - 1] ?? null,
    status,
    details: {
      missingSample: missing.slice(0, 25).map((value) => value.toISOString()),
      gapRuns: runs.slice(0, 25).map((run) => ({
        start: run.start.toISOString(),
        end: run.end.toISOString(),
        minutes: run.minutes,
      })),
      missingOpen: boundaries.missingOpen,
      missingClose: boundaries.missingClose,
    },
  };
}
