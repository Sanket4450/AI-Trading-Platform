import { Injectable, NotFoundException } from '@nestjs/common';
import { getSystemIssue, listSystemIssues } from '@ai-trading/database';
import type { SystemIssueQueryDto } from './system-issue-query.dto.js';

@Injectable()
export class IssuesService {
  list(query: SystemIssueQueryDto) {
    return listSystemIssues({
      source: query.source,
      kind: query.kind,
      severity: query.severity,
      scope: query.scope,
      instrumentId: query.instrumentId,
      providerId: query.providerId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async detail(id: string) {
    const row = await getSystemIssue(id);
    if (!row) throw new NotFoundException('Issue not found');
    return row;
  }
}
