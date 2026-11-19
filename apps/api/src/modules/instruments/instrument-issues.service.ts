import { Injectable } from '@nestjs/common';
import type { QualityIssueActionDto } from '../../common/dto/quality-issue.dto.js';
import {
  acknowledgeScopedIssue,
  loadScopedIssue,
} from '../../common/data-quality/issue-transition.js';
import type { RequestMeta } from '../../common/http/request-meta.js';

@Injectable()
export class InstrumentIssuesService {
  detail(id: string) {
    return loadScopedIssue(id, 'instrument');
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
