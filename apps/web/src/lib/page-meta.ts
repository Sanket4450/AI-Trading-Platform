export interface RouteMeta {
  title: string;
  description: string;
}

const routes: Record<string, RouteMeta> = {
  '/': {
    title: 'System overview',
    description:
      'Trading mode, component health, data coverage and the most recent system activity at a glance.',
  },
  '/accounts': {
    title: 'Accounts',
    description:
      'Broker accounts with equity snapshots, instrument permissions, session history and encrypted credentials.',
  },
  '/instruments': {
    title: 'Instrument catalog',
    description:
      'The canonical cash-equity catalog, ranked NIFTY 50 membership and provider mappings for every instrument.',
  },
  '/universes': {
    title: 'Universes',
    description:
      'Curated instrument universes, their versioned membership snapshots and the strategies that use them.',
  },
  '/strategies': {
    title: 'Strategies',
    description:
      'Registered strategies, their versioned parameter sets, active bindings and promotion state.',
  },
  '/configuration': {
    title: 'Configuration',
    description:
      'Immutable configuration snapshots with canonical hashes, effective dates and change history.',
  },
  '/data': {
    title: 'Data health',
    description:
      'Data coverage, download runs, validation results and the quality issues that need attention.',
  },
  '/processes': {
    title: 'Processes',
    description:
      'Every scheduled and operator-triggered process with its stage, timestamped timeline and important figures.',
  },
  '/audit': {
    title: 'Audit',
    description:
      'An append-only record of security, configuration and operational actions across the system.',
  },
  '/settings': {
    title: 'Settings',
    description:
      'Non-trading system preferences such as refresh behaviour, defaults and operator notifications.',
  },
};

const detailRoutes: Array<{ prefix: string; meta: RouteMeta }> = [
  {
    prefix: '/instruments/',
    meta: {
      title: 'Instrument detail',
      description:
        'Symbol profile, fetch window, ingestion runs, provider mappings and outstanding data issues.',
    },
  },
  {
    prefix: '/processes/',
    meta: {
      title: 'Process detail',
      description:
        'Stage rail, timestamped steps, important figures and the payload or result of a single process run.',
    },
  },
  {
    prefix: '/data/backfills/',
    meta: {
      title: 'Backfill plan',
      description:
        'Parent backfill plan, per-instrument jobs, monthly chunks and retry or cancel controls.',
    },
  },
  {
    prefix: '/data/runs/',
    meta: {
      title: 'Ingestion run',
      description:
        'Single ingestion request with provider, counts, duration, status and the archived raw payload.',
    },
  },
  {
    prefix: '/data/issues/',
    meta: {
      title: 'Quality issue',
      description:
        'Quality rule violation with severity, evidence, affected dates and its resolution lifecycle.',
    },
  },
  {
    prefix: '/data/coverage/',
    meta: {
      title: 'Coverage day',
      description:
        'Stored minute bars against expected bars for this day, with gaps and the daily validation oracle.',
    },
  },
];

const fallback: RouteMeta = { title: 'AI Trading System', description: '' };

export function routeMetaFor(pathname: string): RouteMeta {
  const exact = routes[pathname];
  if (exact) return exact;

  const detail = detailRoutes.find((route) => pathname.startsWith(route.prefix));
  return detail?.meta ?? fallback;
}
