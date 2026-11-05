import { ApiProperty } from '@nestjs/swagger';
import { JobRunDto } from '../../../common/dto/job-run.dto.js';
import { QualityIssueDto } from '../../data/dto/data-response.dto.js';

export class HealthCheckDto {
  @ApiProperty({ enum: ['healthy', 'unhealthy'] })
  status!: 'healthy' | 'unhealthy';

  @ApiProperty({ type: Number, nullable: true })
  latencyMs!: number | null;

  @ApiProperty({ type: String, required: false })
  error?: string;
}

export class HealthChecksDto {
  @ApiProperty({ type: HealthCheckDto })
  database!: HealthCheckDto;

  @ApiProperty({ type: HealthCheckDto })
  redis!: HealthCheckDto;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded', 'unhealthy'] })
  status!: 'ok' | 'degraded' | 'unhealthy';

  @ApiProperty({ example: 'ai-trading-api' })
  service!: string;

  @ApiProperty({ example: 'offline' })
  mode!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  timestamp!: string;

  @ApiProperty({ type: HealthChecksDto })
  checks!: HealthChecksDto;
}

export class QueueCountsDto {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    nullable: true,
    required: false,
  })
  historicalData?: Record<string, number> | null;

  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    nullable: true,
    required: false,
  })
  maintenance?: Record<string, number> | null;

  @ApiProperty({ type: String, required: false })
  error?: string;
}

export class SystemStatusDto {
  @ApiProperty({ example: 'offline' })
  mode!: string;

  @ApiProperty({
    type: Object,
    additionalProperties: { oneOf: [{ type: 'number' }, { type: 'string' }], nullable: true },
    example: {
      accounts: 1,
      activeAccounts: 1,
      instruments: 50,
      queuedJobs: 0,
      runningJobs: 0,
      failedJobs24h: 0,
    },
  })
  counts!: Record<string, number | string | null>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        component: { type: 'string' },
        status: { type: 'string' },
        latencyMs: { type: 'number', nullable: true },
        capturedAt: { type: 'string', format: 'date-time' },
      },
      required: ['component', 'status', 'latencyMs', 'capturedAt'],
    },
  })
  latestHealth!: {
    component: string;
    status: string;
    latencyMs: number | null;
    capturedAt: string;
  }[];

  @ApiProperty({ type: QueueCountsDto })
  queues!: QueueCountsDto;
}

export class OverviewDto {
  @ApiProperty({
    type: Object,
    additionalProperties: { type: 'number' },
    example: {
      accounts: 1,
      instruments: 50,
      universes: 1,
      strategies: 1,
      openIssues: 0,
      criticalIssues: 0,
      coverageRows: 12000,
      completeCoverage: 11800,
      partialCoverage: 200,
      missingCoverage: 0,
      candles: 4500000,
    },
  })
  counts!: Record<string, number>;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        jobName: { type: 'string' },
        jobType: { type: 'string' },
        status: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time', nullable: true },
        finishedAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
      required: [
        'id',
        'jobName',
        'jobType',
        'status',
        'startedAt',
        'finishedAt',
        'createdAt',
      ],
    },
  })
  recentJobs!: Array<
    Pick<
      JobRunDto,
      'id' | 'jobName' | 'jobType' | 'status' | 'startedAt' | 'finishedAt' | 'createdAt'
    >
  >;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        issueType: { type: 'string' },
        severity: { type: 'string' },
        status: { type: 'string' },
        tradingDate: { type: 'string', format: 'date', nullable: true },
        detectedAt: { type: 'string', format: 'date-time' },
      },
      required: [
        'id',
        'issueType',
        'severity',
        'status',
        'tradingDate',
        'detectedAt',
      ],
    },
  })
  openIssues!: Array<
    Pick<
      QualityIssueDto,
      'id' | 'issueType' | 'severity' | 'status' | 'tradingDate' | 'detectedAt'
    >
  >;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  latestCoverageDate!: string | null;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        count: { type: 'number' },
      },
      required: ['status', 'count'],
    },
  })
  coverageByStatus!: { status: string; count: number }[];
}

export class HealthSnapshotDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  capturedAt!: string;

  @ApiProperty({
    enum: [
      'api',
      'web',
      'worker',
      'postgres',
      'redis',
      'upstox_api',
      'market_data_feed',
    ],
  })
  component!: string;

  @ApiProperty({ enum: ['healthy', 'degraded', 'unhealthy', 'unknown'] })
  status!: string;

  @ApiProperty({ type: Number, nullable: true })
  latencyMs!: number | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class NotificationEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['dashboard', 'email', 'webhook', 'log'] })
  channel!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: string;

  @ApiProperty({ example: 'data.quality.critical' })
  eventType!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: String, nullable: true })
  relatedEntityType!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  relatedEntityId!: string | null;

  @ApiProperty({ enum: ['pending', 'sent', 'failed', 'read'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class ReportRunDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({
    enum: ['daily', 'monthly', 'strategy', 'risk', 'reconciliation'],
  })
  reportType!: string;

  @ApiProperty({ type: String, format: 'date' })
  periodStart!: string;

  @ApiProperty({ type: String, format: 'date' })
  periodEnd!: string;

  @ApiProperty({ enum: ['queued', 'running', 'completed', 'failed'] })
  status!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  generatedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  fileRef!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  parameters!: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class TradingCalendarDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'NSE' })
  exchangeCode!: string;

  @ApiProperty({ type: String, format: 'date' })
  tradingDate!: string;

  @ApiProperty()
  isTradingDay!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sessionOpen!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sessionClose!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  preOpenStart!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closingAuctionStart!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closingAuctionEnd!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  settlementDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;
}

export class RiskEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tradingSessionId!: string;

  @ApiProperty({ format: 'uuid' })
  accountId!: string;

  @ApiProperty({
    enum: [
      'limit_breach',
      'trade_blocked',
      'kill_switch',
      'stale_data',
      'protective_order_failure',
      'reconciliation_mismatch',
      'manual_override',
      'data_quality_block',
    ],
  })
  eventType!: string;

  @ApiProperty({ enum: ['info', 'warning', 'critical'] })
  severity!: string;

  @ApiProperty({ type: String, nullable: true })
  ruleCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  observedValue!: string | null;

  @ApiProperty({ type: String, nullable: true })
  limitValue!: string | null;

  @ApiProperty({ type: Object, additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty({ type: String, format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;
}
