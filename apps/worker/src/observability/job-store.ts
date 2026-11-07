import {
  appendJobRunEvents,
  beginJobRunTracking,
  finishJobRunTracking,
  setJobRunStage,
} from '@ai-trading/database';
import type { JobStore } from '@ai-trading/observability';

/** Bridges the framework-free tracker to Drizzle repositories. */
export const jobStore: JobStore = {
  beginRun: beginJobRunTracking,
  setStage: setJobRunStage,
  finishRun: finishJobRunTracking,
  appendEvents: appendJobRunEvents,
};
