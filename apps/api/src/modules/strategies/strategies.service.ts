import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { PAGINATION_DEFAULT_LIMIT, QUEUES } from '@ai-trading/domain';
import {
  cancelEvaluationRun,
  createEvaluationRunWithJob,
  createStrategyVersion,
  deleteEvaluationRunAndJob,
  findActiveEvaluationRun,
  getConfigurationVersion,
  getEvaluationRun,
  getEvaluationRunRiskConfiguration,
  getEvaluationRunSummary,
  getNifty50IndexInstruments,
  getSignalForStrategy,
  getStrategy,
  getStrategySummary,
  getStrategyVersion,
  getSyncTargetEquities,
  getTradingCalendarBounds,
  getTradingDaysInRange,
  listActiveResearchAccounts,
  listEvaluationResults,
  listEvaluationRuns,
  listSignals,
  listStrategies,
  recordAudit,
  resolveEffectiveConfiguration,
  updateJobRun,
} from '@ai-trading/database';
import {
  riskConfigurationSchema,
  validateJsonSchema,
} from '@ai-trading/configuration';
import { istClock } from '@ai-trading/trading-engine';
import { resolveStrategyRuntime, validateStrategyParameters } from '@ai-trading/strategies';
import { offsetPage } from '../../common/pagination/page.js';
import type { SearchOffsetQueryDto } from '../../common/pagination/search-offset-query.dto.js';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type { CreateStrategyVersionDto } from './dto/create-strategy-version.dto.js';
import type { CreateEvaluationRunDto } from './dto/create-evaluation-run.dto.js';
import type {
  EvaluationResultQueryDto,
  EvaluationRunQueryDto,
  RunSignalQueryDto,
  SignalQueryDto,
} from './dto/evaluation-query.dto.js';
import type { StrategyRuntimeDto } from './dto/strategy-response.dto.js';

const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const MAX_EVALUATION_DAYS = 750;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asJsonSchema(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toRuntimeDto(runtime: ReturnType<typeof resolveStrategyRuntime>): StrategyRuntimeDto {
  return {
    status: runtime.status,
    code: runtime.code,
    codeRef: runtime.codeRef,
    implementation: runtime.implementation,
    implementationVersion: runtime.implementationVersion,
    schemaMatches: runtime.schemaMatches,
    parameterNames: [...runtime.parameterNames],
    error: runtime.error,
  };
}

function daysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

@Injectable()
export class StrategiesService {
  constructor(
    @InjectQueue(QUEUES.strategyEvaluation)
    private readonly evaluationQueue: Queue,
  ) {}

  async list(query: SearchOffsetQueryDto) {
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listStrategies({ search: query.search, limit, offset });
    const items = result.items.map((item) => {
      const runtime = resolveStrategyRuntime({
        code: item.code,
        codeRef: item.latestCodeRef,
        parameterSchema: asJsonSchema(item.latestParameterSchema),
      });
      const { latestCodeRef: _codeRef, latestParameterSchema: _schema, ...rest } = item;
      return { ...rest, runtimeStatus: runtime.status };
    });
    return offsetPage(items, result.total, limit, offset);
  }

  summary(query: SearchOffsetQueryDto) {
    return getStrategySummary(query.search);
  }

  async detail(id: string) {
    const strategy = await getStrategy(id);
    if (!strategy) throw new NotFoundException('Strategy not found');

    const versions = strategy.versions.map((version) => {
      const runtime = resolveStrategyRuntime({
        code: strategy.code,
        codeRef: version.codeRef,
        parameterSchema: asJsonSchema(version.parameterSchema),
      });
      return {
        ...version,
        runtimeStatus: runtime.status,
        runtimeError: runtime.error,
      };
    });

    const latest = strategy.versions[0];
    const runtime = latest
      ? resolveStrategyRuntime({
          code: strategy.code,
          codeRef: latest.codeRef,
          parameterSchema: asJsonSchema(latest.parameterSchema),
        })
      : resolveStrategyRuntime({
          code: strategy.code,
          codeRef: null,
          parameterSchema: {},
        });

    return {
      ...strategy,
      versions,
      runtimeStatus: runtime.status,
      runtime: toRuntimeDto(runtime),
    };
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

  async createEvaluationRun(
    strategyId: string,
    body: CreateEvaluationRunDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const strategy = await this.detail(strategyId);
    const version = strategy.versions.find((item) => item.id === body.strategyVersionId);
    if (!version) throw new NotFoundException('Strategy version not found');

    const runtime = resolveStrategyRuntime({
      code: strategy.code,
      codeRef: version.codeRef,
      parameterSchema: asJsonSchema(version.parameterSchema),
    });
    if (runtime.status !== 'registered') {
      throw new UnprocessableEntityException(runtime.error ?? 'Strategy version is not runnable');
    }

    const now = new Date();
    const parameters = body.configurationVersionId
      ? await this.explicitParameterConfig(body.configurationVersionId, strategy.code)
      : await resolveEffectiveConfiguration(version.id, 'parameters', now);
    if (!parameters) {
      throw new UnprocessableEntityException(
        'No parameters configuration is effective for this strategy version',
      );
    }
    const parameterErrors = validateStrategyParameters(
      asJsonSchema(version.parameterSchema),
      parameters.payload,
    );
    if (parameterErrors.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Invalid strategy parameters',
        errors: parameterErrors,
      });
    }

    const risk = await resolveEffectiveConfiguration(version.id, 'risk', now);
    if (!risk) {
      throw new UnprocessableEntityException(
        'No risk configuration is effective for this strategy version',
      );
    }
    const riskErrors = validateJsonSchema(riskConfigurationSchema, risk.payload);
    if (riskErrors.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Invalid risk configuration',
        errors: riskErrors,
      });
    }

    const accounts = await listActiveResearchAccounts();
    if (accounts.length !== 1) {
      throw new UnprocessableEntityException(
        'Exactly one active offline/research account is required for an evaluation run',
      );
    }

    const universe = await this.resolveUniverse(body.instrumentIds);

    await this.validateRunDates(body.fromDate, body.toDate);

    const active = await findActiveEvaluationRun(version.id);
    if (active) {
      throw new ConflictException(
        'An evaluation run is already queued or running for this strategy version',
      );
    }

    let created: Awaited<ReturnType<typeof createEvaluationRunWithJob>>;
    try {
      created = await createEvaluationRunWithJob({
        strategyVersionId: version.id,
        configurationVersionId: parameters.configurationVersionId,
        riskConfigurationVersionId: risk.configurationVersionId,
        accountId: accounts[0]!.id,
        fromDate: body.fromDate,
        toDate: body.toDate,
        initialCapital: body.initialCapital.toFixed(2),
        universe,
        note: body.note ?? null,
        createdBy: actorUserId,
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException(
          'An evaluation run is already queued or running for this strategy version',
        );
      }
      throw error;
    }

    try {
      await this.evaluationQueue.add(
        'strategy-evaluation',
        { jobRunId: created.jobRun.id, evaluationRunId: created.run.id },
        {
          jobId: created.jobRun.id,
          attempts: 1,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
    } catch {
      await deleteEvaluationRunAndJob(created.run.id, created.jobRun.id);
      throw new ServiceUnavailableException('The background queue is unavailable');
    }

    await recordAudit({
      actorUserId,
      accountId: accounts[0]!.id,
      action: 'strategy.evaluation_run.created',
      entityType: 'strategy_evaluation_run',
      entityId: created.run.id,
      beforeState: null,
      afterState: {
        strategy: strategy.code,
        strategyVersionId: version.id,
        version: version.version,
        configurationVersionId: parameters.configurationVersionId,
        riskConfigurationVersionId: risk.configurationVersionId,
        fromDate: body.fromDate,
        toDate: body.toDate,
        initialCapital: body.initialCapital,
        jobRunId: created.jobRun.id,
      },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.evaluationRunDetail(strategyId, created.run.id);
  }

  private async explicitParameterConfig(id: string, strategyCode: string) {
    const config = await getConfigurationVersion(id);
    if (
      !config ||
      config.configType !== 'strategy' ||
      config.scopeKey !== strategyCode
    ) {
      throw new UnprocessableEntityException(
        'Parameter configuration version not found for this strategy',
      );
    }
    return {
      configurationVersionId: config.id,
      payload: config.payload,
      payloadHash: config.payloadHash,
      version: config.version,
    };
  }

  private async resolveUniverse(instrumentIds?: string[]) {
    const equities = await getSyncTargetEquities();
    const byId = new Map(equities.map((equity) => [equity.id, equity]));
    const requested = instrumentIds && instrumentIds.length > 0
      ? [...new Set(instrumentIds)]
      : equities.map((equity) => equity.id);

    const unknown = requested.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Every requested instrument must be an active sync-target equity',
        instrumentIds: unknown,
      });
    }

    const resolved = requested
      .map((id) => byId.get(id)!)
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .map((equity) => ({ id: equity.id, symbol: equity.symbol }));

    const indexInstruments = await getNifty50IndexInstruments();
    if (indexInstruments.length !== 1) {
      throw new UnprocessableEntityException(
        'Exactly one NIFTY 50 index instrument is required for market confirmation',
      );
    }
    const index = indexInstruments[0]!;

    return {
      market: { id: index.id, symbol: index.symbol, exchange: index.exchange },
      requestedIds: requested,
      resolved,
      excluded: [],
    };
  }

  private async validateRunDates(fromDate: string, toDate: string) {
    if (!ISO_DATE.test(fromDate) || !ISO_DATE.test(toDate)) {
      throw new BadRequestException('fromDate and toDate must be YYYY-MM-DD');
    }
    if (fromDate > toDate) {
      throw new BadRequestException('fromDate must be on or before toDate');
    }
    if (daysBetween(fromDate, toDate) > MAX_EVALUATION_DAYS) {
      throw new BadRequestException(`The evaluation range is limited to ${MAX_EVALUATION_DAYS} days`);
    }
    const today = istClock(new Date()).date;
    if (toDate > today) {
      throw new BadRequestException('toDate cannot be in the future');
    }
    const bounds = await getTradingCalendarBounds();
    if (!bounds.fromDate || !bounds.toDate || fromDate < bounds.fromDate || toDate > bounds.toDate) {
      throw new BadRequestException('The date range is outside the loaded NSE calendar');
    }
    const days = await getTradingDaysInRange(fromDate, toDate);
    if (days.length === 0) {
      throw new BadRequestException('The date range contains no NSE trading day');
    }
    return days;
  }

  async listEvaluationRuns(strategyId: string, query: EvaluationRunQueryDto) {
    const strategy = await this.detail(strategyId);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listEvaluationRuns({
      strategyId: strategy.id,
      status: query.status ? [query.status] : undefined,
      fromDate: query.from,
      toDate: query.to,
      limit,
      offset,
    });
    return offsetPage(
      result.items.map((run) => this.mapRun(run)),
      result.total,
      limit,
      offset,
    );
  }

  async evaluationRunDetail(strategyId: string, runId: string) {
    const run = await getEvaluationRun(runId);
    if (!run || run.strategyId !== strategyId) {
      throw new NotFoundException('Evaluation run not found');
    }
    const [summary, risk] = await Promise.all([
      getEvaluationRunSummary(runId),
      getEvaluationRunRiskConfiguration(runId),
    ]);
    const runtime = resolveStrategyRuntime({
      code: run.strategyCode,
      codeRef: run.codeRef,
      parameterSchema: asJsonSchema(run.parameterSchema),
    });

    return {
      ...this.mapRun(run),
      strategyId: run.strategyId,
      strategyCode: run.strategyCode,
      strategyName: run.strategyName,
      parameterVersion: run.parameterVersion,
      parameterHash: run.parameterHash,
      riskVersion: risk?.version ?? null,
      runtime: toRuntimeDto(runtime),
      summary,
    };
  }

  async listEvaluationResults(
    strategyId: string,
    runId: string,
    query: EvaluationResultQueryDto,
  ) {
    await this.assertRunBelongsToStrategy(strategyId, runId);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listEvaluationResults({
      runId,
      tradingDate: query.date,
      status: query.status,
      reasonCode: query.reasonCode,
      instrumentId: query.instrumentId,
      limit,
      offset,
    });
    return offsetPage(
      result.items.map((row) => ({
        id: row.id,
        tradingDate: row.tradingDate,
        instrumentId: row.instrumentId,
        symbol: row.symbol,
        name: row.name,
        status: row.status,
        reasonCode: row.reasonCode,
        diagnostics: row.diagnostics as Record<string, unknown>,
        signalCount: row.signalCount,
      })),
      result.total,
      limit,
      offset,
    );
  }

  async listRunSignals(strategyId: string, runId: string, query: RunSignalQueryDto) {
    await this.assertRunBelongsToStrategy(strategyId, runId);
    return this.listSignals({
      strategyId,
      runId,
      fromDate: query.from,
      toDate: query.to,
      instrumentId: query.instrumentId,
      signalType: query.signalType,
      limit: query.limit,
      offset: query.offset,
    });
  }

  async listStrategySignals(strategyId: string, query: SignalQueryDto) {
    const strategy = await this.detail(strategyId);
    return this.listSignals({
      strategyId: strategy.id,
      runId: query.runId,
      fromDate: query.from,
      toDate: query.to,
      instrumentId: query.instrumentId,
      signalType: query.signalType,
      limit: query.limit,
      offset: query.offset,
    });
  }

  private async listSignals(input: {
    strategyId: string;
    runId?: string;
    fromDate?: string;
    toDate?: string;
    instrumentId?: string;
    signalType?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = input.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = input.offset ?? 0;
    const result = await listSignals({
      strategyId: input.strategyId,
      runId: input.runId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      instrumentId: input.instrumentId,
      signalType: input.signalType,
      limit,
      offset,
    });
    return offsetPage(
      result.items.map((signal) => ({
        ...signal,
        signalAt: signal.signalAt.toISOString(),
        candleStart: signal.candleStart.toISOString(),
      })),
      result.total,
      limit,
      offset,
    );
  }

  async signalDetail(strategyId: string, signalId: string) {
    const signal = await getSignalForStrategy(strategyId, signalId);
    if (!signal) throw new NotFoundException('Signal not found');
    return {
      ...signal,
      signalAt: signal.signalAt.toISOString(),
      candleStart: signal.candleStart.toISOString(),
      createdAt: signal.createdAt.toISOString(),
      evidence: signal.evidence as Record<string, unknown>,
    };
  }

  async cancelEvaluationRun(
    strategyId: string,
    runId: string,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const run = await getEvaluationRun(runId);
    if (!run || run.strategyId !== strategyId) {
      throw new NotFoundException('Evaluation run not found');
    }
    if (TERMINAL_RUN_STATUSES.has(run.status)) {
      return this.evaluationRunDetail(strategyId, runId);
    }

    const cancelled = await cancelEvaluationRun(runId);
    if (run.jobRunId) {
      await updateJobRun(run.jobRunId, { status: 'cancelled', finishedAt: new Date() });
      await this.evaluationQueue.remove(run.jobRunId).catch(() => undefined);
    }

    await recordAudit({
      actorUserId,
      accountId: run.accountId,
      action: 'strategy.evaluation_run.cancelled',
      entityType: 'strategy_evaluation_run',
      entityId: runId,
      beforeState: { status: run.status },
      afterState: { status: cancelled?.status ?? 'cancelled' },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.evaluationRunDetail(strategyId, runId);
  }

  private async assertRunBelongsToStrategy(strategyId: string, runId: string) {
    const run = await getEvaluationRun(runId);
    if (!run || run.strategyId !== strategyId) {
      throw new NotFoundException('Evaluation run not found');
    }
    return run;
  }

  private mapRun(run: {
    id: string;
    strategyVersionId: string;
    version: number;
    codeRef: string;
    configurationVersionId: string;
    riskConfigurationVersionId: string | null;
    fromDate: string;
    toDate: string;
    initialCapital: string;
    status: string;
    note: string | null;
    jobRunId: string | null;
    error: unknown;
    createdAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
    entries?: number;
    exits?: number;
    instrumentDays?: number;
  }) {
    return {
      id: run.id,
      strategyVersionId: run.strategyVersionId,
      version: run.version,
      codeRef: run.codeRef,
      configurationVersionId: run.configurationVersionId,
      riskConfigurationVersionId: run.riskConfigurationVersionId,
      fromDate: run.fromDate,
      toDate: run.toDate,
      initialCapital: run.initialCapital,
      status: run.status,
      note: run.note,
      jobRunId: run.jobRunId,
      error: (run.error as Record<string, unknown> | null) ?? null,
      createdAt: run.createdAt.toISOString(),
      startedAt: iso(run.startedAt),
      finishedAt: iso(run.finishedAt),
      entries: run.entries,
      exits: run.exits,
      instrumentDays: run.instrumentDays,
    };
  }
}
