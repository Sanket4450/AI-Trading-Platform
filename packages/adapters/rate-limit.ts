export interface RateLimitConfig {
  perSecond: number;
  perMinute: number;
  per30Minutes: number;
}

export interface RateLimitState {
  pausedUntil: number | null;
  availableSecond: number;
  availableMinute: number;
  available30Minutes: number;
}

/**
 * The provider budget is global to the account, not per worker process. The
 * production implementation is Redis-backed; this interface keeps the worker
 * and tests honest about the three windows.
 */
export interface RateLimiter {
  acquire(): Promise<void>;
  pause(milliseconds: number): Promise<void>;
  state(): Promise<RateLimitState>;
}

const WINDOW_30_MINUTES = 30 * 60 * 1000;

export class InMemoryRateLimiter implements RateLimiter {
  private readonly second: number[] = [];
  private readonly minute: number[] = [];
  private readonly thirtyMinutes: number[] = [];
  private pausedUntil = 0;

  constructor(private readonly config: RateLimitConfig) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      if (now < this.pausedUntil) {
        await sleep(this.pausedUntil - now);
        continue;
      }
      this.prune(now);
      const wait = this.waitFor(now);
      if (wait <= 0) {
        this.second.push(now);
        this.minute.push(now);
        this.thirtyMinutes.push(now);
        return;
      }
      await sleep(wait);
    }
  }

  async pause(milliseconds: number): Promise<void> {
    this.pausedUntil = Math.max(this.pausedUntil, Date.now() + milliseconds);
  }

  async state(): Promise<RateLimitState> {
    const now = Date.now();
    this.prune(now);
    return {
      pausedUntil: this.pausedUntil > now ? this.pausedUntil : null,
      availableSecond: Math.max(0, this.config.perSecond - this.second.length),
      availableMinute: Math.max(0, this.config.perMinute - this.minute.length),
      available30Minutes: Math.max(0, this.config.per30Minutes - this.thirtyMinutes.length),
    };
  }

  private prune(now: number): void {
    pruneBefore(this.second, now - 1000);
    pruneBefore(this.minute, now - 60_000);
    pruneBefore(this.thirtyMinutes, now - WINDOW_30_MINUTES);
  }

  private waitFor(now: number): number {
    if (this.second.length >= this.config.perSecond) {
      return this.second[0]! + 1000 - now;
    }
    if (this.minute.length >= this.config.perMinute) {
      return this.minute[0]! + 60_000 - now;
    }
    if (this.thirtyMinutes.length >= this.config.per30Minutes) {
      return this.thirtyMinutes[0]! + WINDOW_30_MINUTES - now;
    }
    return 0;
  }
}

function pruneBefore(values: number[], threshold: number): void {
  let index = 0;
  while (index < values.length && values[index]! <= threshold) index += 1;
  if (index > 0) values.splice(0, index);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(1, milliseconds)));
}
