import './load-env.js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to verify the database');
}

const sql = postgres(connectionString, { max: 1, onnotice: () => undefined });

try {
  const [schema] = await sql<{ logical_tables: number; matviews: number }[]>`
    SELECT
      count(*) FILTER (
        WHERE relkind IN ('r', 'p')
          AND relname <> 'schema_migrations'
          AND NOT EXISTS (SELECT 1 FROM pg_inherits WHERE inhrelid = c.oid)
      )::int AS logical_tables,
      count(*) FILTER (WHERE relkind = 'm')::int AS matviews
    FROM pg_class c
    WHERE relnamespace = 'public'::regnamespace
  `;

  const [constraints] = await sql<{ foreign_keys: number; checks: number }[]>`
    SELECT
      count(*) FILTER (WHERE contype = 'f')::int AS foreign_keys,
      count(*) FILTER (WHERE contype = 'c')::int AS checks
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
  `;

  const [candlePartitions] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM pg_inherits
    WHERE inhparent = 'market_candles_1m'::regclass
  `;
  const [quotePartitions] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM pg_inherits
    WHERE inhparent = 'market_quote_snapshots'::regclass
  `;

  const [orders] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM orders`;
  const [missingBindings] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM strategy_versions sv
    WHERE NOT EXISTS (
      SELECT 1 FROM strategy_config_bindings b
      WHERE b.strategy_version_id = sv.id AND b.role = 'parameters'
    )
  `;

  const [seed] = await sql<
    {
      users: number;
      accounts: number;
      instruments: number;
      mappings: number;
      universe_members: number;
      strategies: number;
      strategy_versions: number;
      configurations: number;
      bindings: number;
      permissions: number;
    }[]
  >`
    SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM accounts) AS accounts,
      (SELECT count(*)::int FROM instruments) AS instruments,
      (SELECT count(*)::int FROM instrument_provider_mappings) AS mappings,
      (SELECT count(*)::int FROM instrument_universe_members) AS universe_members,
      (SELECT count(*)::int FROM strategies) AS strategies,
      (SELECT count(*)::int FROM strategy_versions) AS strategy_versions,
      (SELECT count(*)::int FROM configuration_versions) AS configurations,
      (SELECT count(*)::int FROM strategy_config_bindings) AS bindings,
      (SELECT count(*)::int FROM account_instrument_permissions) AS permissions
  `;

  const checks = [
    { name: '58 logical tables', ok: schema.logical_tables === 58, value: schema.logical_tables },
    { name: 'materialized view present', ok: schema.matviews >= 1, value: schema.matviews },
    {
      name: 'candle partitions >= 63',
      ok: candlePartitions.count >= 63,
      value: candlePartitions.count,
    },
    {
      name: 'quote partitions >= 15',
      ok: quotePartitions.count >= 15,
      value: quotePartitions.count,
    },
    { name: 'no live orders in R1', ok: orders.count === 0, value: orders.count },
    {
      name: 'every strategy version has parameters binding',
      ok: missingBindings.count === 0,
      value: missingBindings.count,
    },
  ];

  console.log('R1 database verification');
  console.table({
    'logical tables': schema.logical_tables,
    matviews: schema.matviews,
    'foreign keys': constraints.foreign_keys,
    'check constraints': constraints.checks,
    'candle partitions': candlePartitions.count,
    'quote partitions': quotePartitions.count,
    'live orders': orders.count,
  });
  console.table(seed);
  console.table(
    checks.map((check) => ({ check: check.name, ok: check.ok ? 'yes' : 'NO', value: check.value })),
  );

  const failed = checks.filter((check) => !check.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
    throw new Error(`Verification failed: ${failed.map((check) => check.name).join(', ')}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
