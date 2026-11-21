import { Injectable, NotFoundException } from '@nestjs/common';
import { getIssueSummary, getSystemIssue, listSystemIssues } from '@ai-trading/database';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
} from '../../common/pagination/cursor.js';
import { backwardPage, forwardPage } from '../../common/pagination/page.js';
import type { SystemIssueQueryDto } from './system-issue-query.dto.js';

function filtersOf(query: SystemIssueQueryDto) {
  return {
    source: query.source,
    kind: query.kind,
    severity: query.severity,
    scope: query.scope,
    instrumentId: query.instrumentId,
    providerId: query.providerId,
  };
}

function fingerprintOf(query: SystemIssueQueryDto) {
  return filterFingerprint({
    scope: 'issues',
    source: query.source ?? null,
    kind: query.kind ?? null,
    severity: query.severity ?? null,
    scopeValue: query.scope ?? null,
    instrumentId: query.instrumentId ?? null,
    providerId: query.providerId ?? null,
  });
}

@Injectable()
export class IssuesService {
  async list(query: SystemIssueQueryDto) {
    const fingerprint = fingerprintOf(query);
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const afterKey = after ? parseTimestampCursor(after) : undefined;
    const beforeKey = before ? parseTimestampCursor(before) : undefined;

    const result = await listSystemIssues({
      ...filtersOf(query),
      limit,
      after: afterKey ? { lastSeenAt: afterKey.createdAt, id: afterKey.id } : undefined,
      before: beforeKey ? { lastSeenAt: beforeKey.createdAt, id: beforeKey.id } : undefined,
    });
    const items = result.items;

    if (before) {
      return backwardPage({
        items: items.reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf: (item) => item.lastSeenAt.toISOString(),
        idOf: (item) => item.id,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf: (item) => item.lastSeenAt.toISOString(),
      idOf: (item) => item.id,
      hadAfter: Boolean(after),
    });
  }

  summary(query: SystemIssueQueryDto) {
    return getIssueSummary(filtersOf(query));
  }

  async detail(id: string) {
    const row = await getSystemIssue(id);
    if (!row) throw new NotFoundException('Issue not found');
    return row;
  }
}
