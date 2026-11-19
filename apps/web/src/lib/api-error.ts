/**
 * API error contract shared by the server client (`lib/api.ts`) and the browser client
 * (`lib/api-browser.ts`). Framework-free so client components can import it safely.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(body: string) {
    super('Authentication required', 401, body);
    this.name = 'UnauthorizedError';
  }
}

/** Pulls the operator-facing message out of a Nest error body, or null when it has none. */
export function apiMessage(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: unknown };
    if (Array.isArray(parsed.message)) {
      const lines = parsed.message.filter((line): line is string => typeof line === 'string');
      return lines.length > 0 ? lines.join('; ') : null;
    }
    return typeof parsed.message === 'string' && parsed.message ? parsed.message : null;
  } catch {
    return null;
  }
}

/**
 * Prefers the API's own explanation over the generic "API request failed: 400" text so
 * validation errors reach the operator instead of a bare status code.
 */
export function apiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (!(error instanceof Error)) return fallback;
  if (error instanceof ApiError) {
    return apiMessage(error.body) ?? error.message;
  }
  return error.message;
}
