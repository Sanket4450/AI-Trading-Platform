import postgres from 'postgres';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

beforeAll(async () => {
  container = await new GenericContainer('postgres:17-alpine')
    .withEnvironment({
      POSTGRES_USER: 'r1',
      POSTGRES_PASSWORD: 'r1',
      POSTGRES_DB: 'r1',
    })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forListeningPorts())
    .withStartupTimeout(60_000)
    .start();

  databaseUrl = `postgresql://r1:r1@${container.getHost()}:${container.getMappedPort(5432)}/r1`;
  await migrateAndSeed();
  sql = postgres(databaseUrl, { max: 2, onnotice: () => undefined });
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
  const { closeDatabase } = await import('../../packages/database/client.js');
  await closeDatabase().catch(() => undefined);
  await container?.stop();
});

describe('R2 database lifecycle', () => {
  it('creates 60 logical tables, the materialized view and the partitions', async () => {
    const [schema] = await sql<{ tables: number; matviews: number }[]>`
      select
        count(*) filter (
          where relkind in ('r','p')
            and relname <> 'schema_migrations'
            and not exists (select 1 from pg_inherits where inhrelid = c.oid)
        )::int as tables,
        count(*) filter (where relkind = 'm')::int as matviews
      from pg_class c
      where relnamespace = 'public'::regnamespace
    `;
    expect(schema.tables).toBe(60);
    expect(schema.matviews).toBe(1);

    const [partitions] = await sql<{ count: number }[]>`
      select count(*)::int as count from pg_inherits
      where inhparent = 'market_candles_1m'::regclass
    `;
    expect(partitions.count).toBeGreaterThanOrEqual(63);
  });

  it('seeds the operator, account, instruments, universe and bindings', async () => {
    const [counts] = await sql<
      {
        users: number;
        accounts: number;
        instruments: number;
        mappings: number;
        universe_members: number;
        strategy_versions: number;
        configurations: number;
        bindings: number;
        permissions: number;
      }[]
    >`
      select
        (select count(*)::int from users) as users,
        (select count(*)::int from accounts) as accounts,
        (select count(*)::int from instruments) as instruments,
        (select count(*)::int from instrument_provider_mappings) as mappings,
        (select count(*)::int from instrument_universe_members) as universe_members,
        (select count(*)::int from strategy_versions) as strategy_versions,
        (select count(*)::int from configuration_versions) as configurations,
        (select count(*)::int from strategy_config_bindings) as bindings,
        (select count(*)::int from account_instrument_permissions) as permissions
    `;
    expect(counts.users).toBe(1);
    expect(counts.accounts).toBe(1);
    expect(counts.instruments).toBe(51);
    expect(counts.mappings).toBe(51);
    expect(counts.universe_members).toBe(71);
    expect(counts.strategy_versions).toBe(1);
    expect(counts.configurations).toBe(3);
    expect(counts.bindings).toBe(3);
    expect(counts.permissions).toBe(20);
  });

  it('is idempotent when the seed runs again', async () => {
    const before = await sql<{ count: number }[]>`
      select count(*)::int as count from instruments
    `;
    const { seedDatabase } = await import('../../packages/database/seed.js');
    await seedDatabase(seedEnv);
    const after = await sql<{ count: number }[]>`
      select count(*)::int as count from instruments
    `;
    expect(after[0].count).toBe(before[0].count);
  });

  it('enforces foreign keys on market data', async () => {
    const [provider] = await sql<{ id: string }[]>`
      select id from providers where code = 'upstox'
    `;
    await expect(
      sql`
        insert into market_candles_1m
          (instrument_id, candle_start, trading_date, open, high, low, close, volume, source_provider_id)
        values
          (gen_random_uuid(), now(), current_date, 100, 101, 99, 100.5, 1000, ${provider.id})
      `,
    ).rejects.toThrow(/foreign key/i);
  });

  it('prevents configuration payload updates', async () => {
    await expect(
      sql`
        update configuration_versions
        set payload = '{"tampered": true}'::jsonb
        where id = (select id from configuration_versions limit 1)
      `,
    ).rejects.toThrow(/append-only/i);
  });

  it('allows only one open position per account, instrument and product', async () => {
    const [account] = await sql<{ id: string }[]>`select id from accounts limit 1`;
    const [instrument] = await sql<{ id: string }[]>`
      select id from instruments where instrument_type = 'EQ' limit 1
    `;
    await sql`
      insert into positions (account_id, instrument_id, product, quantity, status)
      values (${account.id}, ${instrument.id}, 'intraday', 1, 'open')
    `;
    await expect(
      sql`
        insert into positions (account_id, instrument_id, product, quantity, status)
        values (${account.id}, ${instrument.id}, 'intraday', 1, 'open')
      `,
    ).rejects.toThrow(/uq_positions_open|duplicate key/i);
  });

  it('refreshes the daily materialized view from 1-minute candles', async () => {
    const [provider] = await sql<{ id: string }[]>`
      select id from providers where code = 'upstox'
    `;
    const [instrument] = await sql<{ id: string }[]>`
      select id from instruments where trading_symbol = 'RELIANCE' limit 1
    `;
    await sql`
      insert into market_candles_1m
        (instrument_id, candle_start, trading_date, open, high, low, close, volume, source_provider_id)
      values
        (${instrument.id}, date_trunc('day', now()) + interval '3 hours 45 minutes', current_date,
         100, 102, 99, 101, 10000, ${provider.id})
      on conflict do nothing
    `;
    await sql`refresh materialized view concurrently mv_instrument_daily_stats`;
    const rows = await sql<{ bar_count: number }[]>`
      select bar_count from mv_instrument_daily_stats
      where instrument_id = ${instrument.id} and trading_date = current_date
    `;
    expect(rows[0]?.bar_count).toBeGreaterThanOrEqual(1);
  });

  it('keeps R2 free of live orders and binds every strategy version', async () => {
    const [orders] = await sql<{ count: number }[]>`select count(*)::int as count from orders`;
    expect(orders.count).toBe(0);

    const [missing] = await sql<{ count: number }[]>`
      select count(*)::int as count
      from strategy_versions sv
      where not exists (
        select 1 from strategy_config_bindings b
        where b.strategy_version_id = sv.id and b.role = 'parameters'
      )
    `;
    expect(missing.count).toBe(0);
  });

  it('seeds the nifty-50 catalog with rank order, status rows and corrected ticks', async () => {
    const [nifty] = await sql<{ members: number; status_rows: number; index_rank: number }[]>`
      select
        (select count(*)::int
           from instrument_universe_members m
           join instrument_universe_versions v on v.id = m.universe_version_id
           join instrument_universes u on u.id = v.universe_id
          where u.code = 'nifty-50' and v.effective_to is null) as members,
        (select count(*)::int
           from instrument_universe_members m
           join instrument_universe_versions v on v.id = m.universe_version_id
           join instrument_universes u on u.id = v.universe_id
           join instrument_data_status s on s.instrument_id = m.instrument_id
          where u.code = 'nifty-50' and v.effective_to is null) as status_rows,
        (select m.rank
           from instrument_universe_members m
           join instrument_universe_versions v on v.id = m.universe_version_id
           join instrument_universes u on u.id = v.universe_id
           join instruments i on i.id = m.instrument_id
          where u.code = 'nifty-50' and v.effective_to is null and i.segment = 'NSE_INDEX'
          limit 1) as index_rank
    `;
    expect(nifty.members).toBe(51);
    expect(nifty.status_rows).toBe(51);
    expect(nifty.index_rank).toBe(1);

    const ticks = await sql<{ symbol: string; tick_size: string }[]>`
      select trading_symbol as symbol, tick_size::text
      from instruments where trading_symbol in ('RELIANCE','HDFCBANK','MARUTI')
      order by trading_symbol
    `;
    expect(ticks).toEqual([
      { symbol: 'HDFCBANK', tick_size: '0.0500' },
      { symbol: 'MARUTI', tick_size: '1.0000' },
      { symbol: 'RELIANCE', tick_size: '0.1000' },
    ]);
  });

  it('covers every calendar date from 2022 through 2027', async () => {
    const [calendar] = await sql<{ days: number }[]>`
      select count(distinct tc.trading_date)::int as days
      from trading_calendar tc
      join exchanges e on e.id = tc.exchange_id
      where e.code = 'NSE' and tc.trading_date between '2022-01-01' and '2027-12-31'
    `;
    expect(calendar.days).toBe(2191);

    const [special] = await sql<
      { is_trading_day: boolean; session_open: string | null; session_close: string | null }[]
    >`
      select tc.is_trading_day, tc.session_open::text, tc.session_close::text
      from trading_calendar tc
      join exchanges e on e.id = tc.exchange_id
      where e.code = 'NSE' and tc.trading_date = '2026-11-08'
    `;
    expect(special?.is_trading_day).toBe(true);
    expect(special?.session_open).toContain('08:50:00');
    expect(special?.session_close).toContain('10:00:00');

    const [holiday] = await sql<{ is_trading_day: boolean }[]>`
      select tc.is_trading_day
      from trading_calendar tc
      join exchanges e on e.id = tc.exchange_id
      where e.code = 'NSE' and tc.trading_date = '2026-01-15'
    `;
    expect(holiday?.is_trading_day).toBe(false);

    const weekdays = await sql<{ trading_date: string; is_trading_day: boolean }[]>`
      select tc.trading_date::text as trading_date, tc.is_trading_day
      from trading_calendar tc
      join exchanges e on e.id = tc.exchange_id
      where e.code = 'NSE' and tc.trading_date in ('2026-11-02', '2026-11-07')
      order by tc.trading_date
    `;
    expect(weekdays).toEqual([
      { trading_date: '2026-11-02', is_trading_day: true },
      { trading_date: '2026-11-07', is_trading_day: false },
    ]);
  });

  it('enforces one active manual backfill per instrument', async () => {
    const [provider] = await sql<{ id: string }[]>`select id from providers where code = 'upstox'`;
    const [instrument] = await sql<{ id: string }[]>`
      select id from instruments where trading_symbol = 'RELIANCE' limit 1
    `;
    await sql`
      insert into market_data_ingestion_runs
        (provider_id, run_type, instrument_id, timeframe_unit, timeframe_interval,
         requested_from, requested_to, status)
      values (${provider.id}, 'historical_backfill', ${instrument.id}, 'minutes', 1,
              '2022-01-01', '2022-01-31', 'queued')
    `;
    await expect(
      sql`
        insert into market_data_ingestion_runs
          (provider_id, run_type, instrument_id, timeframe_unit, timeframe_interval,
           requested_from, requested_to, status)
        values (${provider.id}, 'historical_backfill', ${instrument.id}, 'minutes', 1,
                '2022-02-01', '2022-02-28', 'queued')
      `,
    ).rejects.toThrow(/uq_ingestion_active_instrument|duplicate key/i);
  });

  it('deduplicates quality issues and daily validation rows', async () => {
    const [instrument] = await sql<{ id: string }[]>`
      select id from instruments where trading_symbol = 'RELIANCE' limit 1
    `;
    const dedupe = 'a'.repeat(64);
    await sql`
      insert into data_quality_issues
        (provider_id, instrument_id, issue_type, severity, status, detected_by,
         rule_id, dedupe_key)
      values ((select id from providers where code = 'upstox'), ${instrument.id},
              'missing_bar', 'warning', 'open', 'validation', 'DQ-001', ${dedupe})
    `;
    await expect(
      sql`
        insert into data_quality_issues
          (provider_id, instrument_id, issue_type, severity, status, detected_by,
           rule_id, dedupe_key)
        values ((select id from providers where code = 'upstox'), ${instrument.id},
                'missing_bar', 'warning', 'open', 'validation', 'DQ-001', ${dedupe})
      `,
    ).rejects.toThrow(/uq_quality_open_dedupe|duplicate key/i);

    const [provider] = await sql<{ id: string }[]>`select id from providers where code = 'upstox'`;
    await sql`
      insert into market_data_daily_validation
        (instrument_id, trading_date, source_provider_id, status)
      values (${instrument.id}, '2026-09-01', ${provider.id}, 'matched')
    `;
    await expect(
      sql`
        insert into market_data_daily_validation
          (instrument_id, trading_date, source_provider_id, status)
        values (${instrument.id}, '2026-09-01', ${provider.id}, 'matched')
      `,
    ).rejects.toThrow(/uq_daily_validation_instrument_date_provider|duplicate key/i);
  });

  it('upserts coverage idempotently in a batch', async () => {
    const { upsertCoverageBatch } = await import('../../packages/database/index.js');
    const [instrument] = await sql<{ id: string }[]>`
      select id from instruments where trading_symbol = 'RELIANCE' limit 1
    `;
    const base = {
      instrumentId: instrument.id,
      tradingDate: '2026-09-01',
      expectedBars: 375,
      storedBars: 375,
      gapCount: 0,
      gapRunCount: 0,
      maxGapMinutes: 0,
      firstBarAt: null,
      lastBarAt: null,
      status: 'complete',
      validationStatus: 'matched',
      details: {},
    };
    await upsertCoverageBatch([base]);
    await upsertCoverageBatch([
      {
        ...base,
        storedBars: 372,
        gapCount: 3,
        gapRunCount: 2,
        maxGapMinutes: 2,
        status: 'partial',
        validationStatus: 'volume_reconciled',
      },
    ]);
    const rows = await sql<{ count: number; status: string; stored_bars: number }[]>`
      select count(*)::int as count, max(status) as status, max(stored_bars)::int as stored_bars
      from market_data_coverage
      where instrument_id = ${instrument.id} and trading_date = '2026-09-01'
    `;
    expect(rows[0]?.count).toBe(1);
    expect(rows[0]?.status).toBe('partial');
    expect(rows[0]?.stored_bars).toBe(372);
  });
});
