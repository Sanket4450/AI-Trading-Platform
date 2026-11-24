import './load-env.js';
import postgres from 'postgres';
import { canonicalJson, ORB_CODE_REF, ORB_PARAMETER_SCHEMA } from '@ai-trading/domain';

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
  const [fills] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM fills`;
  const [positions] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM positions`;
  const [missingBindings] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM strategy_versions sv
    WHERE NOT EXISTS (
      SELECT 1 FROM strategy_config_bindings b
      WHERE b.strategy_version_id = sv.id AND b.role = 'parameters'
    )
  `;

  const [syncTargets] = await sql<{
    targets: number;
    status_rows: number;
    missing_mappings: number;
  }[]>`
    SELECT
      (SELECT count(*)::int FROM instruments WHERE is_sync_target) AS targets,
      (SELECT count(*)::int
         FROM instruments i
         JOIN instrument_data_status s ON s.instrument_id = i.id
        WHERE i.is_sync_target) AS status_rows,
      (SELECT count(*)::int
         FROM instruments i
        WHERE i.is_sync_target
          AND NOT EXISTS (
            SELECT 1 FROM instrument_provider_mappings p
            WHERE p.instrument_id = i.id AND p.is_primary AND p.valid_to IS NULL
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
          AND table_name = 'instrument_data_status') AS tables,
      (SELECT count(*)::int
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('uq_raw_payload_request_hash', 'uq_job_runs_active_backfill',
                            'uq_system_issues_dedupe', 'idx_job_runs_status_started')) AS indexes
  `;

  const [seed] = await sql<
    {
      users: number;
      accounts: number;
      instruments: number;
      mappings: number;
      sync_targets: number;
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
      (SELECT count(*)::int FROM instruments WHERE is_sync_target) AS sync_targets,
      (SELECT count(*)::int FROM instrument_data_status) AS status_rows,
      (SELECT count(*)::int FROM strategies) AS strategies,
      (SELECT count(*)::int FROM strategy_versions) AS strategy_versions,
      (SELECT count(*)::int FROM configuration_versions) AS configurations,
      (SELECT count(*)::int FROM strategy_config_bindings) AS bindings,
      (SELECT count(*)::int FROM account_instrument_permissions) AS permissions
  `;

  const [r3Objects] = await sql<{ tables: number; indexes: number }[]>`
    SELECT
      (SELECT count(*)::int
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('strategy_evaluation_runs', 'strategy_evaluation_results')) AS tables,
      (SELECT count(*)::int
         FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN ('uq_evaluation_runs_active', 'uq_evaluation_result_day',
                            'uq_signals_research_decision', 'uq_signals_live_decision')) AS indexes
  `;

  const [signalShape] = await sql<{ columns: number; checks: number; nullable: boolean }[]>`
    SELECT
      (SELECT count(*)::int
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'signals'
          AND column_name IN ('evaluation_run_id', 'trading_session_id')) AS columns,
      (SELECT count(*)::int
         FROM pg_constraint
        WHERE conrelid = 'signals'::regclass
          AND conname IN ('chk_signals_scope', 'chk_signals_quantity_whole',
                          'chk_signals_evidence_object')) AS checks,
      (SELECT is_nullable = 'YES'
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'signals'
          AND column_name = 'trading_session_id' LIMIT 1) AS nullable
  `;

  const [droppedColumns] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name, column_name) IN (
        ('providers', 'capabilities'),
        ('raw_provider_payloads', 'http_method'),
        ('raw_provider_payloads', 'http_status'),
        ('market_candles_1m', 'created_at'),
        ('risk_decisions', 'created_at'),
        ('orders', 'order_ref_id'),
        ('reconciliations', 'raw_payload_id')
      )
  `;

  const version2Rows = await sql<
    { code_ref: string; status: string; parameter_schema: unknown; bindings: number }[]
  >`
    SELECT sv.code_ref, sv.status, sv.parameter_schema,
           (SELECT count(*)::int FROM strategy_config_bindings b
             WHERE b.strategy_version_id = sv.id AND b.role = 'parameters') AS bindings
    FROM strategy_versions sv
    JOIN strategies s ON s.id = sv.strategy_id
    WHERE s.code = 'orb-15m' AND sv.version = 2
    LIMIT 1
  `;
  const version2 = version2Rows[0] ?? null;
  const version2SchemaMatches = version2
    ? canonicalJson(version2.parameter_schema) === canonicalJson(ORB_PARAMETER_SCHEMA)
    : false;

  const [indexInstruments] = await sql<{ count: number }[]>`
    SELECT count(*)::int AS count
    FROM instruments
    WHERE trading_symbol = 'NIFTY 50'
      AND segment = 'NSE_INDEX'
      AND instrument_type = 'INDEX'
      AND is_active = true
  `;

  const [jobNameCheck] = await sql<{ definition: string | null }[]>`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = 'chk_job_runs_name'
    LIMIT 1
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
    { name: 'no live orders', ok: orders.count === 0, value: orders.count },
    { name: 'no live fills', ok: fills.count === 0, value: fills.count },
    { name: 'no live positions', ok: positions.count === 0, value: positions.count },
    {
      name: 'every strategy version has parameters binding',
      ok: missingBindings.count === 0,
      value: missingBindings.count,
    },
    {
      name: '51 instruments are sync targets',
      ok: syncTargets.targets === 51,
      value: syncTargets.targets,
    },
    {
      name: 'every sync target has a status row',
      ok: syncTargets.status_rows === 51,
      value: syncTargets.status_rows,
    },
    {
      name: 'every sync target has a primary mapping',
      ok: syncTargets.missing_mappings === 0,
      value: syncTargets.missing_mappings,
    },
    { name: 'tick sizes are valid', ok: tickSizes.invalid === 0, value: tickSizes.invalid },
    { name: 'calendar covers 2022–2027', ok: calendar.days === 2191, value: calendar.days },
    {
      name: 'R2 tables and indexes exist',
      ok: r2Objects.tables === 1 && r2Objects.indexes === 4,
      value: `${r2Objects.tables} tables / ${r2Objects.indexes} indexes`,
    },
    {
      name: 'R3 evaluation tables and indexes exist',
      ok: r3Objects.tables === 2 && r3Objects.indexes === 4,
      value: `${r3Objects.tables} tables / ${r3Objects.indexes} indexes`,
    },
    {
      name: 'signals has the research scope and checks',
      ok: signalShape.columns === 2 && signalShape.checks === 3 && signalShape.nullable,
      value: `${signalShape.columns} columns / ${signalShape.checks} checks / nullable ${signalShape.nullable}`,
    },
    {
      name: 'seven R3 dead columns are absent',
      ok: droppedColumns.count === 0,
      value: droppedColumns.count,
    },
    {
      name: 'orb-15m version 2 is active and bound',
      ok:
        version2?.code_ref === ORB_CODE_REF &&
        version2.status === 'active' &&
        version2.bindings === 1 &&
        version2SchemaMatches,
      value: version2
        ? `${version2.code_ref} / ${version2.status} / bindings ${version2.bindings} / schema ${version2SchemaMatches ? 'match' : 'DIFF'}`
        : 'missing',
    },
    {
      name: 'exactly one NIFTY 50 index instrument',
      ok: indexInstruments.count === 1,
      value: indexInstruments.count,
    },
    {
      name: 'job_runs accepts strategy-evaluation',
      ok: jobNameCheck.definition?.includes('strategy-evaluation') ?? false,
      value: jobNameCheck.definition ? 'present' : 'missing',
    },
  ];

  console.log('R3 database verification');
  console.table({
    'logical tables': schema.logical_tables,
    matviews: schema.matviews,
    'foreign keys': constraints.foreign_keys,
    'check constraints': constraints.checks,
    'candle partitions': candlePartitions.count,
    'quote partitions': quotePartitions.count,
    'live orders': orders.count,
    'live fills': fills.count,
    'live positions': positions.count,
    'sync targets': syncTargets.targets,
    'status rows': syncTargets.status_rows,
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
