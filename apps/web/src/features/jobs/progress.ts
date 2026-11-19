import { stagesForJob } from '@ai-trading/domain';
import type { JobEvent, JobProgress } from '@/lib/types';

/** Derives the same live progress shape the API returns, from one event. */
export function progressFromEvent(jobName: string, event: JobEvent | null): JobProgress | null {
  if (!event) return null;
  const stages = stagesForJob(jobName);
  const index = stages.indexOf(event.stage);
  if (index < 0) return null;

  if (event.type === 'progress') {
    const completed = Number(event.data.index ?? 0);
    const total = Number(event.data.total ?? 0);
    return {
      stage: event.stage,
      stageIndex: index + 1,
      stageTotal: stages.length,
      completed: Number.isFinite(completed) ? completed : null,
      total: Number.isFinite(total) ? total : null,
    };
  }

  return {
    stage: event.stage,
    stageIndex: index + 1,
    stageTotal: stages.length,
    completed: null,
    total: null,
  };
}

export function eventFigures(event: JobEvent): string | null {
  const { index, total, written, fetched, rejected, from, to } = event.data;
  const parts: string[] = [];
  if (typeof index === 'number' && typeof total === 'number') parts.push(`${index}/${total}`);
  if (typeof from === 'string' && typeof to === 'string') parts.push(`${from} → ${to}`);
  if (typeof fetched === 'number') parts.push(`${fetched} fetched`);
  if (typeof written === 'number') parts.push(`${written} written`);
  if (typeof rejected === 'number' && rejected > 0) parts.push(`${rejected} rejected`);
  return parts.length > 0 ? parts.join(' · ') : null;
}
