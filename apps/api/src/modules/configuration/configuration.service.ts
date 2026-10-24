import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  bindConfiguration,
  createConfigurationVersion,
  findConfigurationByHash,
  findLatestStrategyVersionByCode,
  getConfigurationVersion,
  getStrategyVersion,
  listConfigurationVersions,
  recordAudit,
} from '@ai-trading/database';
import {
  hashPayload,
  riskConfigurationSchema,
  systemConfigurationSchema,
  validateJsonSchema,
} from '@ai-trading/configuration';
import type {
  BindConfigurationDto,
  CreateConfigurationDto,
} from './dto/create-configuration.dto.js';
import type { ListConfigurationDto } from './dto/list-configuration.dto.js';
import { diffJson } from './json-diff.js';
import type { RequestMeta } from '../../common/http/request-meta.js';

@Injectable()
export class ConfigurationService {
  list(query: ListConfigurationDto) {
    return listConfigurationVersions({
      configType: query.configType,
      scopeKey: query.scopeKey,
      limit: query.limit,
    });
  }

  async detail(id: string) {
    const version = await getConfigurationVersion(id);
    if (!version)
      throw new NotFoundException('Configuration version not found');
    return version;
  }

  async create(
    body: CreateConfigurationDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const schema = await this.schemaFor(body.configType, body.scopeKey);
    const errors = validateJsonSchema(schema, body.payload);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Configuration payload is invalid',
        errors,
      });
    }

    const effectiveFrom = new Date(body.effectiveFrom);
    const effectiveTo = body.effectiveTo ? new Date(body.effectiveTo) : null;
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new BadRequestException(
        'effectiveFrom must be a valid ISO timestamp',
      );
    }
    if (effectiveTo && Number.isNaN(effectiveTo.getTime())) {
      throw new BadRequestException(
        'effectiveTo must be a valid ISO timestamp',
      );
    }
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo must be later than effectiveFrom',
      );
    }

    const payloadHash = hashPayload(body.payload);
    const existing = await findConfigurationByHash({
      configType: body.configType,
      scopeKey: body.scopeKey,
      payloadHash,
    });
    if (existing) {
      return { ...existing, created: false };
    }

    const created = await createConfigurationVersion({
      configType: body.configType,
      scopeKey: body.scopeKey,
      payload: body.payload,
      payloadHash,
      schemaVersion: body.schemaVersion,
      effectiveFrom,
      effectiveTo,
      supersedesId: body.supersedesId ?? null,
      createdBy: actorUserId,
    });

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'configuration.created',
      entityType: 'configuration_version',
      entityId: created.id,
      beforeState: null,
      afterState: {
        configType: created.configType,
        scopeKey: created.scopeKey,
        version: created.version,
        payloadHash: created.payloadHash,
        effectiveFrom: created.effectiveFrom,
        effectiveTo: created.effectiveTo,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ...created, created: true };
  }

  async bind(
    configurationId: string,
    body: BindConfigurationDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const configuration = await this.detail(configurationId);
    const strategyVersion = await getStrategyVersion(body.strategyVersionId);
    if (!strategyVersion)
      throw new NotFoundException('Strategy version not found');

    const binding = await bindConfiguration({
      strategyVersionId: body.strategyVersionId,
      configurationVersionId: configurationId,
      role: body.role,
      boundBy: actorUserId,
    });

    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'configuration.bound',
      entityType: 'strategy_config_binding',
      entityId: binding?.id ?? null,
      beforeState: null,
      afterState: {
        configurationVersionId: configurationId,
        strategyVersionId: body.strategyVersionId,
        role: body.role,
        configurationVersion: configuration.version,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return binding;
  }

  async diff(id: string, againstId: string) {
    if (id === againstId) {
      throw new BadRequestException(
        'Choose two different configuration versions',
      );
    }
    const left = await this.detail(id);
    const right = await this.detail(againstId);
    return {
      left: {
        id: left.id,
        configType: left.configType,
        scopeKey: left.scopeKey,
        version: left.version,
        payloadHash: left.payloadHash,
        payload: left.payload,
      },
      right: {
        id: right.id,
        configType: right.configType,
        scopeKey: right.scopeKey,
        version: right.version,
        payloadHash: right.payloadHash,
        payload: right.payload,
      },
      changes: diffJson(left.payload, right.payload),
    };
  }

  private async schemaFor(configType: string, scopeKey: string) {
    if (configType === 'risk')
      return riskConfigurationSchema as unknown as Record<string, unknown>;
    if (configType === 'system') {
      return systemConfigurationSchema as unknown as Record<string, unknown>;
    }

    const latest = await findLatestStrategyVersionByCode(scopeKey);
    if (!latest) {
      throw new NotFoundException(
        `No strategy version found for scope "${scopeKey}"`,
      );
    }
    return latest.parameterSchema as Record<string, unknown>;
  }
}
