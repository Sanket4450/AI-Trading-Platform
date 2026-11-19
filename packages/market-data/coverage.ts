import type { CoverageStatus, CoverageVerdict, GapRun, SessionWindow } from './types.js';
import { boundaryFindings, diffMinutes, expectedMinutes, gapRuns } from './sessions.js';

export function coverageStatus(input: {
  storedBars: number;
  missingBarCount: number;
}): CoverageStatus {
  if (input.storedBars === 0) return 'missing';
  if (input.missingBarCount === 0) return 'complete';
  return 'partial';
}

/**
 * Strict completeness: every expected session minute is present, or the day is
 * partial. `storedBars` counts distinct in-session minutes, so it can never
 * exceed `expectedBars`.
 */
export function computeCoverageVerdict(input: {
  session: SessionWindow;
  observed: readonly Date[];
}): CoverageVerdict {
  const expected = expectedMinutes(input.session);
  const observed = [...input.observed].sort((a, b) => a.getTime() - b.getTime());
  const missing = diffMinutes(expected, observed);
  const runs: GapRun[] = gapRuns(missing);
  const boundaries = boundaryFindings(expected, observed);
  const storedBars = expected.length - missing.length;

  return {
    expectedBars: expected.length,
    storedBars,
    missingBarCount: missing.length,
    gapRunCount: runs.length,
    maxGapMinutes: runs.reduce((max, run) => Math.max(max, run.minutes), 0),
    status: coverageStatus({ storedBars, missingBarCount: missing.length }),
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
