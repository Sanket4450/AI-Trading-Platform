import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PAGINATION_DEFAULT_LIMIT, INSTRUMENT_ISSUE_PAGE_LIMIT, QUEUES } from '@ai-trading/domain';
import {
  createJobRun,
  deleteJobRun,
  getCatalogSummary,
  getCoverageDayDetail,
  getInstrumentStatusDetail,
  listInstrumentCatalog,
  listInstrumentDayIssues,
  listInstrumentIssues,
  recordAudit,
} from '@ai-trading/database';
import { offsetPage, backwardPage, forwardPage } from '../../common/pagination/page.js';
import {
  filterFingerprint,
  parseTimestampCursor,
  readDirectionalCursor,
} from '../../common/pagination/cursor.js';
import type { OffsetQueryDto } from '../../common/pagination/pagination.dto.js';
import type { RequestMeta } from '../../common/http/request-meta.js';
import type {
  InstrumentCoverageQueryDto,
  InstrumentIssueQueryDto,
  RecomputeInstrumentCoverageDto,
} from './dto/instrument-coverage-query.dto.js';

@Injectable()
export class InstrumentCoverageService {
  constructor(
    @InjectQueue(QUEUES.historicalData) private readonly historicalQueue: Queue,
  ) {}

  async list(query: InstrumentCoverageQueryDto) {
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listInstrumentCatalog({
      fetchStatus: query.fetchStatus,
      dataStatus: query.dataStatus,
      search: query.search,
      limit,
      offset,
    });
    return offsetPage(result.items, result.total, limit, offset);
  }

  summary(query: InstrumentCoverageQueryDto) {
    return getCatalogSummary({
      fetchStatus: query.fetchStatus,
      dataStatus: query.dataStatus,
      search: query.search,
    });
  }

  async detail(instrumentId: string) {
    const detail = await getInstrumentStatusDetail(instrumentId);
    if (!detail) throw new NotFoundException('Instrument not found');
    return detail;
  }

  async issues(instrumentId: string, query: InstrumentIssueQueryDto) {
    const fingerprint = filterFingerprint({ scope: 'instrument-issues', instrumentId });
    const { after, before } = readDirectionalCursor(query, fingerprint);
    const limit = query.limit ?? INSTRUMENT_ISSUE_PAGE_LIMIT;
    const afterKey = after ? parseTimestampCursor(after) : undefined;
    const beforeKey = before ? parseTimestampCursor(before) : undefined;

    await this.detail(instrumentId);
    const result = await listInstrumentIssues(instrumentId, {
      limit,
      after: afterKey ? { lastSeenAt: afterKey.createdAt, id: afterKey.id } : undefined,
      before: beforeKey ? { lastSeenAt: beforeKey.createdAt, id: beforeKey.id } : undefined,
    });
    const items = result.items;

    if (before) {
      return backwardPage({
        items: [...items].reverse(),
        total: result.total,
        limit,
        hasExtra: result.hasExtra,
        fingerprint,
        keyOf: (item) => item.lastSeenAt.toISOString(),
        idOf: (item) => item.id,
      });
    }

    return forwardPage({
      items,
      total: result.total,
      limit,
      hasExtra: result.hasExtra,
      fingerprint,
      keyOf: (item) => item.lastSeenAt.toISOString(),
      idOf: (item) => item.id,
      hadAfter: Boolean(after),
    });
  }

  coverageDay(instrumentId: string, date: string) {
    this.assertDate(date);
    return getCoverageDayDetail(instrumentId, date);
  }

  async coverageDayIssues(
    instrumentId: string,
    date: string,
    query: OffsetQueryDto,
  ) {
    this.assertDate(date);
    const limit = query.limit ?? PAGINATION_DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const result = await listInstrumentDayIssues(instrumentId, date, { limit, offset });
    return offsetPage(result.items, result.total, limit, offset);
  }

  private assertDate(date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD');
    }
  }

  async recompute(
    instrumentId: string,
    body: RecomputeInstrumentCoverageDto,
    actorUserId: string,
    meta: RequestMeta,
  ) {
    const jobRun = await createJobRun({
      jobName: 'coverage-recompute',
      instrumentId,
      status: 'queued',
      payload: {
        from: body.from ?? '2022-01-01',
        to: body.to,
      },
      maxAttempts: 2,
    });
    try {
      await this.historicalQueue.add(
        'coverage-recompute',
        {
          jobRunId: jobRun.id,
          instrumentIds: [instrumentId],
          from: body.from ?? '2022-01-01',
          to: body.to,
        },
        {
          jobId: jobRun.id,
          priority: 5,
          attempts: 2,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
    } catch {
      await deleteJobRun(jobRun.id);
      throw new ServiceUnavailableException(
        'The background queue is unavailable',
      );
    }
    await recordAudit({
      actorUserId,
      accountId: null,
      action: 'data.instrument_status_recomputed',
      entityType: 'job_run',
      entityId: jobRun.id,
      beforeState: null,
      afterState: { instrumentId, from: body.from, to: body.to },
      requestId: meta.requestId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return jobRun;
  }
}
