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

  const [nifty] = await sql<{ members: number; status_rows: number; missing_mappings: number }[]>`
    SELECT
      (SELECT count(*)::int
         FROM instrument_universe_members m
         JOIN instrument_universe_versions v ON v.id = m.universe_version_id
         JOIN instrument_universes u ON u.id = v.universe_id
        WHERE u.code = 'nifty-50' AND v.effective_to IS NULL) AS members,
      (SELECT count(*)::int
         FROM instrument_universe_members m
         JOIN instrument_universe_versions v ON v.id = m.universe_version_id
         JOIN instrument_universes u ON u.id = v.universe_id
         JOIN instrument_data_status s ON s.instrument_id = m.instrument_id
        WHERE u.code = 'nifty-50' AND v.effective_to IS NULL) AS status_rows,
      (SELECT count(*)::int
         FROM instrument_universe_members m
         JOIN instrument_universe_versions v ON v.id = m.universe_version_id
         JOIN instrument_universes u ON u.id = v.universe_id
        WHERE u.code = 'nifty-50' AND v.effective_to IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM instrument_provider_mappings p
            WHERE p.instrument_id = m.instrument_id AND p.is_primary AND p.valid_to IS NULL
          )) AS missing_mappings
  `;

  const [tickSizes] = await sql<{ invalid: number }[]>`
    SELECT count(*)::int AS invalid FROM instruments WHERE tick_size <= 0 OR tick_size > 5
  `;

  const [calendar] = await sql<{ days: number }[]>`
    SELECT count(DISTINCT tc.trading_date)::int AS days
    FROM trading_calendar tc
    JOIN exchanges e ON e.id = tc.exchange_id
    WHERE e.code = 'NSE'
      AND tc.trading_date BETWEEN '2022-01-01' AND '2027-12-31'
  `;

  const [r2Objects] = await sql<{ tables: number; indexes: number }[]>`
    SELECT
      (SELECT count(*)::int
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('instrument_data_status', 'market_data_daily_validation')) AS tables,
      (SELECT count(*)::int
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('uq_raw_payload_request_hash', 'uq_ingestion_active_instrument',
                            'uq_quality_open_dedupe', 'uq_ingestion_parent_chunk')) AS indexes
  `;

  const [seed] = await sql<
    {
      users: number;
      accounts: number;
      instruments: number;
      mappings: number;
      universe_members: number;
      nifty_members: number;
      status_rows: number;
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
      (SELECT count(*)::int
         FROM instrument_universe_members m
         JOIN instrument_universe_versions v ON v.id = m.universe_version_id
         JOIN instrument_universes u ON u.id = v.universe_id
        WHERE u.code = 'nifty-50' AND v.effective_to IS NULL) AS nifty_members,
      (SELECT count(*)::int FROM instrument_data_status) AS status_rows,
      (SELECT count(*)::int FROM strategies) AS strategies,
      (SELECT count(*)::int FROM strategy_versions) AS strategy_versions,
      (SELECT count(*)::int FROM configuration_versions) AS configurations,
      (SELECT count(*)::int FROM strategy_config_bindings) AS bindings,
      (SELECT count(*)::int FROM account_instrument_permissions) AS permissions
  `;

  const checks = [
    { name: '60 logical tables', ok: schema.logical_tables === 60, value: schema.logical_tables },
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
    { name: 'no live orders in R2', ok: orders.count === 0, value: orders.count },
    {
      name: 'every strategy version has parameters binding',
      ok: missingBindings.count === 0,
      value: missingBindings.count,
    },
    {
      name: 'nifty-50 active version has 51 members',
      ok: nifty.members === 51,
      value: nifty.members,
    },
    {
      name: 'every nifty-50 member has a status row',
      ok: nifty.status_rows === 51,
      value: nifty.status_rows,
    },
    {
      name: 'every nifty-50 member has a primary mapping',
      ok: nifty.missing_mappings === 0,
      value: nifty.missing_mappings,
    },
    { name: 'tick sizes are valid', ok: tickSizes.invalid === 0, value: tickSizes.invalid },
    { name: 'calendar covers 2022–2027', ok: calendar.days === 2191, value: calendar.days },
    {
      name: 'R2 tables and indexes exist',
      ok: r2Objects.tables === 2 && r2Objects.indexes === 4,
      value: `${r2Objects.tables} tables / ${r2Objects.indexes} indexes`,
    },
  ];

  console.log('R2 database verification');
  console.table({
    'logical tables': schema.logical_tables,
    matviews: schema.matviews,
    'foreign keys': constraints.foreign_keys,
    'check constraints': constraints.checks,
    'candle partitions': candlePartitions.count,
    'quote partitions': quotePartitions.count,
    'live orders': orders.count,
    'nifty-50 members': nifty.members,
    'status rows': nifty.status_rows,
    'calendar days': calendar.days,
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
