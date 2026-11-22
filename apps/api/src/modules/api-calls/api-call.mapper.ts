import type { ConfigService } from '@nestjs/config';
import { apiOperationDefinition, readExternalApiScope, renderApiUrl } from '@ai-trading/domain';

/** Row shape every call query returns; the projection below is shared by both call endpoints. */
export interface ApiCallRow {
  id: number;
  jobRunId: string | null;
  jobName: string | null;
  instrumentId: string | null;
  instrumentSymbol: string | null;
  startedAt: Date;
  latencyMs: number;
  service: string;
  operation: string;
  requestScope: unknown;
  statusCode: number | null;
  outcome: string;
  errorBody: string | null;
}

/**
 * Projects a stored call into the API shape. Method and URL come from the catalogue so the
 * browser never re-implements endpoint templates; origins are resolved once and cached.
 */
export function createApiCallMapper(config: ConfigService) {
  const origins = new Map<string, string | null>();

  function originFor(baseUrlEnv: string): string | null {
    if (origins.has(baseUrlEnv)) return origins.get(baseUrlEnv) ?? null;

    let origin: string | null = null;
    const configured = config.get<string>(baseUrlEnv);
    if (configured) {
      try {
        origin = new URL(configured).origin;
      } catch {
        origin = null;
      }
    }
    origins.set(baseUrlEnv, origin);
    return origin;
  }

  return function mapApiCall(row: ApiCallRow) {
    const scope = readExternalApiScope(row.requestScope);
    const definition = apiOperationDefinition(row.service, row.operation);

    return {
      id: row.id,
      jobRunId: row.jobRunId,
      jobName: row.jobName,
      instrumentId: row.instrumentId,
      instrumentSymbol: row.instrumentSymbol,
      startedAt: row.startedAt.toISOString(),
      latencyMs: row.latencyMs,
      service: row.service,
      operation: row.operation,
      method: definition?.method ?? 'GET',
      endpoint: definition?.endpoint ?? '',
      url: definition
        ? renderApiUrl(definition.endpoint, scope, originFor(definition.baseUrlEnv))
        : '',
      requestScope: scope,
      statusCode: row.statusCode,
      outcome: row.outcome,
      errorBody: row.errorBody,
    };
  };
}
