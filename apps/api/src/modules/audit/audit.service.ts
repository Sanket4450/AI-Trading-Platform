import { Injectable, NotFoundException } from '@nestjs/common';
import { getAuditLogEntry, getAuditSummary, listAuditLog } from '@ai-trading/database';
import { PAGINATION_DEFAULT_LIMIT } from '@ai-trading/domain';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
} from '../../common/pagination/cursor.js';
import { backwardPage, forwardPage } from '../../common/pagination/page.js';
import type { AuditQueryDto } from './dto/audit-query.dto.js';

function filtersOf(query: AuditQueryDto) {
  return {
    actorUserId: query.actorUserId,
    entityType: query.entityType,
    action: query.action,
    search: query.search,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
}

function fingerprintOf(query: AuditQueryDto) {
  return filterFingerprint({
    scope: 'audit',
    actorUserId: query.actorUserId ?? null,
    entityType: query.entityType ?? null,
    action: query.action ?? null,
    search: query.search ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  });
}

@Injectable()
export class AuditService {
  async list(query: AuditQueryDto) {
    const fingerprint = fingerprintOf(query);
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;

    const result = await listAuditLog({
      ...filtersOf(query),
      limit,
      after: after ? parseTimestampCursor(after) : undefined,
      before: before ? parseTimestampCursor(before) : undefined,
    });

    const items = result.items.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
    const keyOf = (item: (typeof items)[number]) => item.createdAt;
    const idOf = (item: (typeof items)[number]) => item.id;

    if (before) {
      return backwardPage({
        items: items.reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf,
        idOf,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf,
      idOf,
      hadAfter: Boolean(after),
    });
  }

  summary(query: AuditQueryDto) {
    return getAuditSummary(filtersOf(query));
  }

  async detail(id: string) {
    const row = await getAuditLogEntry(id);
    if (!row) throw new NotFoundException('Audit entry not found');
    return { ...row, createdAt: row.createdAt.toISOString() };
  }
}
