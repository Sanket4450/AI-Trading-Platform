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

describe('R1 database lifecycle', () => {
  it('creates 58 logical tables, the materialized view and the partitions', async () => {
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
    expect(schema.tables).toBe(58);
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
    expect(counts.universe_members).toBe(20);
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

  it('keeps R1 free of live orders and binds every strategy version', async () => {
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
});
