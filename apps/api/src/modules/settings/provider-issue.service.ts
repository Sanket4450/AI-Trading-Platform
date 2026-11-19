import { Injectable } from '@nestjs/common';
import { listQualityIssues } from '@ai-trading/database';
import type { QualityIssueActionDto } from '../../common/dto/quality-issue.dto.js';
import {
  acknowledgeScopedIssue,
  loadScopedIssue,
} from '../../common/data-quality/issue-transition.js';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { ProviderIssueQueryDto } from './dto/provider-issue-query.dto.js';

/** Data-quality issues with no instrument: provider, calendar and market-wide checks. */
@Injectable()
export class ProviderIssueService {
  list(query: ProviderIssueQueryDto) {
    return listQualityIssues({
      providerWideOnly: true,
      status: query.status,
      severity: query.severity,
      limit: query.limit,
    });
  }

  detail(id: string) {
    return loadScopedIssue(id, 'provider');
  }

  acknowledge(
    id: string,
    body: QualityIssueActionDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    return acknowledgeScopedIssue(id, body, actorUserId, meta);
  }
}
