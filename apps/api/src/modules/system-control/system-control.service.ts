import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { sql } from 'drizzle-orm';
import {
  createJobRun,
  db,
  getDashboardOverview,
  getSystemStatus,
  listAccounts,
  listHealthSnapshots,
  listJobRuns,
  listNotificationEvents,
  listReportRuns,
  listRiskEvents,
  listTradingCalendar,
  listTradingSessions,
  recordAudit,
  updateJobRun,
} from '@ai-trading/database';
import { QUEUES } from '@ai-trading/domain';
import type { RequestMeta } from '../../common/http/request-meta.js';

export interface CheckResult {
  status: 'healthy' | 'unhealthy';
  latencyMs: number | null;
  error?: string;
}

@Injectable()
export class SystemControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemControlService.name);
  private readonly redis: Redis;

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
    @InjectQueue(QUEUES.maintenance) private readonly maintenanceQueue: Queue,
  ) {
    this.redis = new Redis(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
      {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      },
    );
  }

  async onModuleInit(): Promise<void> {
    const accounts = await listAccounts();
    const allowed = new Set(['offline', 'research']);
    const invalid = accounts.filter(
      (account) => account.isActive && !allowed.has(account.mode),
    );
    if (invalid.length > 0) {
      throw new Error(
        `R2 only supports offline or research accounts. Found invalid account(s): ${invalid
          .map((account) => `${account.code}=${account.mode}`)
          .join(', ')}`,
      );
    }
    this.logger.log('Offline/research mode asserted for every active account.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  async health() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const status =
      database.status === 'healthy' && redis.status === 'healthy'
        ? 'ok'
        : database.status === 'healthy' || redis.status === 'healthy'
          ? 'degraded'
          : 'unhealthy';

    let mode = this.config.get<string>('TRADING_MODE', 'offline');
    try {
      mode = (await getSystemStatus()).mode;
    } catch {
      // The database check already reports the failure.
    }

    return {
      status,
      service: 'ai-trading-api',
      mode,
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  async status() {
    const status = await getSystemStatus();
    const queues = await this.queueCounts();
    return { ...status, queues };
  }

  overview() {
    return getDashboardOverview();
  }

  jobs(limit = 100, status?: string) {
    return listJobRuns({ limit, status });
  }

  async rebuildCoverage(actorUserId: string, meta: RequestMeta) {
    const jobRun = await createJobRun({
      jobName: 'coverage-rebuild',
      queueName: QUEUES.historicalData,
      jobType: 'maintenance',
      status: 'queued',
      payload: {},
      correlationId: meta.requestId,
    });
    try {
      await this.historicalQueue.add(
        'coverage-rebuild',
        { jobRunId: jobRun.id },
        {
          jobId: jobRun.id,
          priority: 10,
          attempts: 1,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
    } catch (error) {
      await updateJobRun(jobRun.id, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : 'Queue unavailable',
      });
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.coverage_rebuild_queued',
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: { jobName: 'coverage-rebuild' },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return jobRun;
  }

  healthSnapshots(limit = 100, component?: string) {
    return listHealthSnapshots({ limit, component });
  }

  notifications(limit = 100) {
    return listNotificationEvents(limit);
  }

  reports(limit = 100) {
    return listReportRuns(limit);
  }

  calendar(filters: { from?: string; to?: string; exchangeCode?: string }) {
    return listTradingCalendar(filters);
  }

  riskEvents(filters: { accountId?: string; limit?: number }) {
    return listRiskEvents(filters);
  }

  sessions(filters: { accountId?: string; limit?: number }) {
    return listTradingSessions(filters);
  }

  private async checkDatabase(): Promise<CheckResult> {
    const started = Date.now();
    try {
      await db.execute(sql`select 1`);
      return { status: 'healthy', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'Database check failed',
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const started = Date.now();
    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }
      await this.redis.ping();
      return { status: 'healthy', latencyMs: Date.now() - started };
    } catch (error) {
      return {
        status: 'unhealthy',
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'Redis check failed',
      };
    }
  }

  private async queueCounts() {
    try {
      const [historical, maintenance] = await Promise.all([
        this.historicalQueue.getJobCounts(),
        this.maintenanceQueue.getJobCounts(),
      ]);
      return { historicalData: historical, maintenance };
    } catch (error) {
      return {
        historicalData: null,
        maintenance: null,
        error: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }
}
