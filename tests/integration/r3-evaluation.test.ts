import postgres from 'postgres';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Bar, OrbParameters, StrategyInstrument, VolumeSlotSample } from '@ai-trading/domain';
import {
  ORB_CODE_REF,
  ORB_PARAMETER_SCHEMA,
  canonicalJson,
  resolveOrbParameters,
} from '@ai-trading/domain';
import { evaluateOrbSession } from '@ai-trading/strategies';

const seedEnv = {
  email: 'integration@example.com',
  password: 'integration-password-123',
};

let container: StartedTestContainer;
let sql: postgres.Sql;
let databaseUrl: string;

async function migrateAndSeed(): Promise<void> {
  const { runMigrations } = await import('../../packages/database/migrate.js');
  await runMigrations(databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
  const { seedDatabase } = await import('../../packages/database/seed.js');
  await seedDatabase(seedEnv);
}

function minuteLabel(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

interface CandleRow {
  instrument_id: string;
  candle_start: string;
  trading_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  source_provider_id: string;
  is_final: boolean;
}

type JsonPayload = Parameters<postgres.Sql['json']>[0];

function buildCandles(input: {
  dates: string[];
  equities: { id: string; symbol: string }[];
  indexId: string;
  providerId: string;
}): CandleRow[] {
  const rows: CandleRow[] = [];
  let indexPrice = 20_000;
  for (const [dayIndex, date] of input.dates.entries()) {
    const breakout = dayIndex === 21;
    for (let minute = 0; minute < 375; minute += 1) {
      const label = minuteLabel(9 * 60 + 15 + minute);
      const start = new Date(`${date}T${label}:00.000+05:30`).toISOString();

      for (const equity of input.equities) {
        const isBreakoutBar =
          breakout && equity.symbol === 'RELIANCE' && label >= '09:30' && label <= '09:34';
        const isTargetBounce = breakout && equity.symbol === 'RELIANCE' && label === '09:35';
        rows.push({
          instrument_id: equity.id,
          candle_start: start,
          trading_date: date,
          open: isBreakoutBar ? 101 : isTargetBounce ? 101 : 100,
          high: isBreakoutBar ? 101.05 : isTargetBounce ? 102 : 100.05,
          low: isBreakoutBar ? 100.95 : isTargetBounce ? 101 : 99.95,
          close: isBreakoutBar ? 101 : isTargetBounce ? 101.5 : 100,
          volume: isBreakoutBar ? 1000 : isTargetBounce ? 1000 : 100,
          source_provider_id: input.providerId,
          is_final: true,
        });
      }

      rows.push({
        instrument_id: input.indexId,
        candle_start: start,
        trading_date: date,
        open: indexPrice,
        high: indexPrice + 0.5,
        low: indexPrice - 0.5,
        close: indexPrice,
        volume: 1000,
        source_provider_id: input.providerId,
        is_final: true,
      });
      indexPrice += 10;
    }
  }
  return rows;
}

function toBar(row: {
  candleStart: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}): Bar {
  return {
    instrument: '',
    timeframe: '1m',
    timestamp: row.candleStart,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  };
}

beforeAll(async () => {
  container = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({
      POSTGRES_USER: 'r3',
      POSTGRES_PASSWORD: 'r3',
      POSTGRES_DB: 'r3',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forListeningPorts())
    .withStartupTimeout(60_000)
    .start();

  databaseUrl = `postgresql://r3:r3@${container.getHost()}:${container.getMappedPort(5432)}/r3`;
  await migrateAndSeed();
  sql = postgres(databaseUrl, { max: 2, onnotice: () => undefined });
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  const { closeDatabase } = await import('../../packages/database/client.js');
  await closeDatabase().catch(() => undefined);
  await container?.stop();
});

describe('R3 database and research pipeline', () => {
  it('creates 58 tables, the evaluation objects and version 2', async () => {
    const [schema] = await sql<{ tables: number }[]>`
      select count(*) filter (
        where relkind in ('r','p')
          and relname <> 'schema_migrations'
          and not exists (select 1 from pg_inherits where inhrelid = c.oid)
      )::int as tables
      from pg_class c
      where relnamespace = 'public'::regnamespace
    `;
    expect(schema.tables).toBe(58);

    const version = await sql<{ code_ref: string; status: string; schema: unknown }[]>`
      select sv.code_ref, sv.status, sv.parameter_schema as schema
      from strategy_versions sv
      join strategies s on s.id = sv.strategy_id
      where s.code = 'orb-15m' and sv.version = 2
    `;
    expect(version[0]?.code_ref).toBe(ORB_CODE_REF);
    expect(version[0]?.status).toBe('active');
    expect(canonicalJson(version[0]?.schema)).toBe(canonicalJson(ORB_PARAMETER_SCHEMA));

    const [bindings] = await sql<{ count: number }[]>`
      select count(*)::int as count
      from strategy_config_bindings b
      join strategy_versions sv on sv.id = b.strategy_version_id
      join strategies s on s.id = sv.strategy_id
      where s.code = 'orb-15m' and sv.version = 2
    `;
    expect(bindings.count).toBe(3);

    const [dropped] = await sql<{ count: number }[]>`
      select count(*)::int as count from information_schema.columns
      where table_schema = 'public' and (table_name, column_name) in (
        ('providers','capabilities'),
        ('raw_provider_payloads','http_method'),
        ('raw_provider_payloads','http_status'),
        ('market_candles_1m','created_at'),
        ('risk_decisions','created_at'),
        ('orders','order_ref_id'),
        ('reconciliations','raw_payload_id')
      )
    `;
    expect(dropped.count).toBe(0);
  });

  it('persists a deterministic entry and exit and keeps the day idempotent', async () => {
    const { getSyncTargetEquities, getNifty50IndexInstruments, getTradingCalendarRow } =
      await import('../../packages/database/index.js');
    const {
      createEvaluationRunWithJob,
      getCoverageInRange,
      getEvaluationRunRiskConfiguration,
      getFinalCandlesForDay,
      getFiveMinuteSlotVolume,
      getIndexCandlesForDates,
      replaceEvaluationDay,
    } = await import('../../packages/database/index.js');

    const equities = (await getSyncTargetEquities()).filter((row) =>
      ['RELIANCE', 'HDFCBANK'].includes(row.symbol),
    );
    expect(equities).toHaveLength(2);
    const index = (await getNifty50IndexInstruments())[0]!;
    const [provider] = await sql<{ id: string }[]>`select id from providers where code = 'upstox'`;
    const [account] = await sql<{ id: string }[]>`select id from accounts limit 1`;
    const [version] = await sql<{ id: string }[]>`
      select sv.id from strategy_versions sv
      join strategies s on s.id = sv.strategy_id
      where s.code = 'orb-15m' and sv.version = 2
    `;
    const [parameters] = await sql<{ id: string }[]>`
      select b.configuration_version_id as id
      from strategy_config_bindings b
      where b.strategy_version_id = ${version!.id} and b.role = 'parameters'
      limit 1
    `;
    const [risk] = await sql<{ id: string }[]>`
      select b.configuration_version_id as id
      from strategy_config_bindings b
      where b.strategy_version_id = ${version!.id} and b.role = 'risk'
      limit 1
    `;

    const dates = (
      await sql<{ trading_date: string }[]>`
        select tc.trading_date::text as trading_date
        from trading_calendar tc
        join exchanges e on e.id = tc.exchange_id
        where e.code = 'NSE' and tc.is_trading_day
          and (tc.session_open at time zone 'Asia/Kolkata')::time = '09:15:00'
          and (tc.session_close at time zone 'Asia/Kolkata')::time = '15:30:00'
          and tc.trading_date between '2026-09-01' and '2026-11-30'
        order by tc.trading_date
        limit 25
      `
    ).map((row) => row.trading_date);
    expect(dates).toHaveLength(25);

    const candles = buildCandles({
      dates,
      equities,
      indexId: index.id,
      providerId: provider!.id,
    });
    await sql`
      insert into market_candles_1m
        (instrument_id, candle_start, trading_date, open, high, low, close, volume,
         source_provider_id, is_final)
      select instrument_id, candle_start, trading_date, open, high, low, close, volume,
             source_provider_id, is_final
      from jsonb_to_recordset(${sql.json(candles as unknown as JsonPayload)}) as x(
        instrument_id uuid, candle_start timestamptz, trading_date date,
        open numeric, high numeric, low numeric, close numeric, volume numeric,
        source_provider_id uuid, is_final boolean)
    `;

    const coverage = dates.flatMap((date) =>
      [...equities.map((equity) => equity.id), index.id].map((instrumentId) => ({
        instrument_id: instrumentId,
        trading_date: date,
        expected_bars: 375,
        stored_bars: 375,
      })),
    );
    await sql`
      insert into instrument_day_coverage (instrument_id, trading_date, expected_bars, stored_bars)
      select instrument_id, trading_date, expected_bars, stored_bars
      from jsonb_to_recordset(${sql.json(coverage as unknown as JsonPayload)}) as x(
        instrument_id uuid, trading_date date, expected_bars int, stored_bars int)
      on conflict (instrument_id, trading_date) do update
        set expected_bars = excluded.expected_bars, stored_bars = excluded.stored_bars
    `;

    const runDay = dates[21]!;
    expect(await getTradingCalendarRow(runDay)).not.toBeNull();

    const created = await createEvaluationRunWithJob({
      strategyVersionId: version!.id,
      configurationVersionId: parameters!.id,
      riskConfigurationVersionId: risk!.id,
      accountId: account!.id,
      fromDate: runDay,
      toDate: runDay,
      initialCapital: '1000000.00',
      universe: {
        market: { id: index.id, symbol: index.symbol, exchange: 'NSE' },
        requestedIds: equities.map((equity) => equity.id),
        resolved: equities.map((equity) => ({ id: equity.id, symbol: equity.symbol })),
        excluded: [],
      },
      note: 'integration',
      createdBy: (
        await sql<{ id: string }[]>`select id from users limit 1`
      )[0]!.id,
    });

    const riskConfig = await getEvaluationRunRiskConfiguration(created.run.id);
    expect(riskConfig).not.toBeNull();
    const [parameterConfig] = await sql<{ payload: unknown }[]>`
      select payload from configuration_versions where id = ${parameters!.id}
    `;
    const parametersResolved = resolveOrbParameters(parameterConfig!.payload as OrbParameters);

    const instrumentIds = equities.map((equity) => equity.id);
    const allIds = [...instrumentIds, index.id];
    const priorDates = dates.slice(0, 21).slice(-20);
    const coverageRows = await getCoverageInRange(allIds, priorDates[0]!, runDay);
    const complete = new Map<string, string[]>();
    for (const row of coverageRows) {
      if (row.storedBars !== row.expectedBars) continue;
      const list = complete.get(row.instrumentId) ?? [];
      list.push(row.tradingDate);
      complete.set(row.instrumentId, list);
    }

    const volumeRows = await getFiveMinuteSlotVolume(
      instrumentIds,
      [...new Set([...complete.values()].flat())],
    );
    const volumeHistory = new Map<string, VolumeSlotSample[]>();
    for (const row of volumeRows) {
      if (!complete.get(row.instrumentId)?.includes(row.tradingDate)) continue;
      const list = volumeHistory.get(row.instrumentId) ?? [];
      list.push({ tradingDate: row.tradingDate, slot: row.slot, volume: row.volume });
      volumeHistory.set(row.instrumentId, list);
    }

    const dayCandles = await getFinalCandlesForDay(allIds, runDay);
    const bars = new Map<string, Bar[]>();
    let indexBars: Bar[] = [];
    for (const row of dayCandles) {
      if (row.instrumentId === index.id) {
        indexBars.push({ ...toBar(row), instrument: index.symbol });
        continue;
      }
      const list = bars.get(row.instrumentId) ?? [];
      list.push(toBar(row));
      bars.set(row.instrumentId, list);
    }
    const indexHistory = await getIndexCandlesForDates(index.id, dates.slice(16, 21));
    indexBars = [
      ...indexHistory.map((row) => ({ ...toBar(row), instrument: index.symbol })),
      ...indexBars,
    ];

    const calendar = await getTradingCalendarRow(runDay);
    const instruments: StrategyInstrument[] = equities.map((equity) => ({
      id: equity.id,
      symbol: equity.symbol,
      tickSize: Number(equity.tickSize),
    }));

    const evaluation = evaluateOrbSession({
      runAt: new Date(),
      session: {
        tradingDate: runDay,
        open: new Date(calendar!.session_open!),
        close: new Date(calendar!.session_close!),
      },
      instruments,
      bars,
      indexBars,
      indexInstrument: { id: index.id, symbol: index.symbol, tickSize: Number(index.tickSize) },
      volumeHistory,
      initialCapital: 1_000_000,
      parameters: parametersResolved,
      risk: {
        riskPerTradePct: Number((riskConfig!.payload as { riskPerTradePct: number }).riskPerTradePct),
        maxOpenPositions: 1,
        maxEntriesPerDay: 2,
      },
      codeRef: ORB_CODE_REF,
      parameterHash: 'integration',
    });

    expect(evaluation.signals.map((signal) => signal.signalType)).toEqual(['entry', 'target']);
    expect(evaluation.results.find((result) => result.symbol === 'RELIANCE')?.status).toBe('signal');
    expect(evaluation.results.find((result) => result.symbol === 'HDFCBANK')?.reasonCode).toBe(
      'no_breakout',
    );

    const persist = async () => {
      await replaceEvaluationDay({
        runId: created.run.id,
        tradingDate: runDay,
        results: evaluation.results.map((result) => ({
          instrumentId: result.instrumentId,
          tradingDate: runDay,
          status: result.status,
          reasonCode: result.reasonCode,
          diagnostics: result.diagnostics as unknown as Record<string, unknown>,
        })),
        signals: evaluation.signals.map((signal) => ({
          strategyVersionId: version!.id,
          evaluationRunId: created.run.id,
          accountId: account!.id,
          instrumentId: signal.instrumentId,
          configurationVersionId: parameters!.id,
          signalAt: signal.signalAt,
          candleStart: signal.candleStart,
          direction: signal.side,
          signalType: signal.signalType,
          referencePrice: signal.referencePrice.toFixed(4),
          entryPrice: signal.entryPrice.toFixed(4),
          stopPrice: signal.stopPrice.toFixed(4),
          targetPrice: signal.targetPrice.toFixed(4),
          quantity: signal.quantity.toFixed(4),
          evidence: signal.evidence as unknown as Record<string, unknown>,
          status: 'created',
        })),
      });
    };

    await persist();
    await persist();

    const [counts] = await sql<{ results: number; signals: number }[]>`
      select
        (select count(*)::int from strategy_evaluation_results where evaluation_run_id = ${created.run.id}) as results,
        (select count(*)::int from signals where evaluation_run_id = ${created.run.id}) as signals
    `;
    expect(counts.results).toBe(2);
    expect(counts.signals).toBe(2);

    const persisted = await sql<{ signal_type: string; reference_price: string; candle_start: string }[]>`
      select signal_type, reference_price::text, candle_start::text
      from signals where evaluation_run_id = ${created.run.id}
      order by signal_at
    `;
    expect(persisted.map((row) => row.signal_type)).toEqual(['entry', 'target']);

    const [orders] = await sql<{ count: number }[]>`select count(*)::int as count from orders`;
    expect(orders.count).toBe(0);
  });
});
