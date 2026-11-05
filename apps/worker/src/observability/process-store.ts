import {
  appendJobRunEvents,
  beginJobRunTracking,
  finishJobRunTracking,
  setJobRunStage,
} from '@ai-trading/database';
import type { ProcessStore } from '@ai-trading/observability';

/** Bridges the framework-free tracker to Drizzle repositories. */
export const processStore: ProcessStore = {
  beginRun: beginJobRunTracking,
  setStage: setJobRunStage,
  finishRun: finishJobRunTracking,
  appendEvents: appendJobRunEvents,
};
