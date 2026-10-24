import { Injectable } from '@nestjs/common';
import { listAuditLog } from '@ai-trading/database';
import type { AuditQueryDto } from './dto/audit-query.dto.js';

@Injectable()
export class AuditService {
  list(query: AuditQueryDto) {
    return listAuditLog({
      actorUserId: query.actorUserId,
      entityType: query.entityType,
      action: query.action,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });
  }
}
