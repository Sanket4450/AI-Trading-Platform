/**
 * Timeline and run context share one height band so the two cards always line up: the shorter
 * one keeps blank space, the taller one scrolls internally.
 */
export const JOB_PANEL_MIN_HEIGHT_PX = 320;
export const JOB_PANEL_MAX_HEIGHT_PX = 560;

/** First events rendered before the operator asks for the full history. */
export const TIMELINE_EVENT_WINDOW = 20;
