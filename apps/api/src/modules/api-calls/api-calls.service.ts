import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import {
  listExternalApiCalls,
  summarizeExternalApiCalls,
} from '@ai-trading/database';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
} from '../../common/pagination/cursor.js';
import { backwardPage, forwardPage } from '../../common/pagination/page.js';
import { createApiCallMapper } from './api-call.mapper.js';
import type { ApiCallQueryDto } from './dto/api-call-query.dto.js';

@Injectable()
export class ApiCallsService {
  private readonly mapApiCall: ReturnType<typeof createApiCallMapper>;

  constructor(config: ConfigService) {
    this.mapApiCall = createApiCallMapper(config);
  }

  /** Global call feed with the same keyset pagination as every other list page. */
  async list(query: ApiCallQueryDto) {
    const filters = {
      services: query.service,
      outcomes: query.outcome,
      search: query.search,
    };
    const fingerprint = filterFingerprint({
      scope: 'api-calls',
      services: query.service ?? [],
      outcomes: query.outcome ?? [],
      search: query.search ?? null,
    });
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const afterKey = after ? parseTimestampCursor(after) : undefined;
    const beforeKey = before ? parseTimestampCursor(before) : undefined;

    const [result, summary] = await Promise.all([
      listExternalApiCalls({
        ...filters,
        limit,
        after: afterKey
          ? { startedAt: afterKey.createdAt, id: afterKey.id }
          : undefined,
        before: beforeKey
          ? { startedAt: beforeKey.createdAt, id: beforeKey.id }
          : undefined,
      }),
      summarizeExternalApiCalls(filters),
    ]);
    const items = result.items.map((row) => this.mapApiCall(row));

    const page = before
      ? backwardPage({
          items: [...items].reverse(),
          total: result.total,
          limit,
          hasExtra: result.hasExtra,
          fingerprint,
          keyOf: (item) => item.startedAt,
          idOf: (item) => String(item.id),
        })
      : forwardPage({
          items,
          total: result.total,
          limit,
          hasExtra: result.hasExtra,
          fingerprint,
          keyOf: (item) => item.startedAt,
          idOf: (item) => String(item.id),
          hadAfter: Boolean(after),
        });

    return { ...page, summary };
  }
}
