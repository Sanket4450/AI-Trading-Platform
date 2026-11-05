const DEFAULT_STAGES = ['start', 'work', 'finish'];

/**
 * Only jobs that call the tracker directly get domain stages. Everything else
 * receives the generic start/work/finish rail driven by the processor wrapper.
 */
const STAGES_BY_JOB: Record<string, string[]> = {
  'historical-backfill': ['prepare', 'chunks', 'close'],
};

export function stagesForJob(jobName: string): string[] {
  return STAGES_BY_JOB[jobName] ?? DEFAULT_STAGES;
}

export function isInstrumentedJob(jobName: string): boolean {
  return Object.hasOwn(STAGES_BY_JOB, jobName);
}
