import { Injectable, NotFoundException } from '@nestjs/common';
import {
  createStrategyVersion,
  getStrategy,
  getStrategyVersion,
  listStrategies,
  recordAudit,
  resolveEffectiveConfiguration,
} from '@ai-trading/database';
import type { CreateStrategyVersionDto } from './dto/create-strategy-version.dto.js';
import type { RequestMeta } from '../../common/http/request-meta.js';

@Injectable()
export class StrategiesService {
  list() {
    return listStrategies();
  }

  async detail(id: string) {
    const strategy = await getStrategy(id);
    if (!strategy) throw new NotFoundException('Strategy not found');
    return strategy;
  }

  async versions(id: string) {
    const strategy = await this.detail(id);
    return strategy.versions;
  }

  async effectiveConfiguration(
    id: string,
    versionId: string,
    role: string,
    at?: string,
  ) {
    const version = await getStrategyVersion(versionId);
    if (!version || version.strategyId !== id) {
      throw new NotFoundException('Strategy version not found');
    }
    const effectiveAt = at ? new Date(at) : new Date();
    if (Number.isNaN(effectiveAt.getTime())) {
      throw new NotFoundException('Invalid effective timestamp');
    }
    return resolveEffectiveConfiguration(versionId, role, effectiveAt);
  }

  async createVersion(
    strategyId: string,
    body: CreateStrategyVersionDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const strategy = await this.detail(strategyId);
    const created = await createStrategyVersion({
      strategyId,
      codeRef: body.codeRef,
      parameterSchema: body.parameterSchema,
      changelog: body.changelog ?? null,
      createdBy: actorUserId,
    });

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'strategy_version.created',
      entityType: 'strategy_version',
      entityId: created.id,
      beforeState: null,
      afterState: {
        strategy: strategy.code,
        version: created.version,
        codeRef: created.codeRef,
        status: created.status,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return created;
  }
}
