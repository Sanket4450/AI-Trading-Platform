export interface RouteMeta {
  title: string;
  description: string;
}

const routes: Record<string, RouteMeta> = {
  '/': {
    title: 'Overview',
    description:
      'Trading mode, system health, data coverage and recent activity at a glance.',
  },
  '/accounts': {
    title: 'Accounts',
    description: 'Broker accounts, their equity, tradable instruments and trading sessions.',
  },
  '/instruments': {
    title: 'Instruments',
    description:
      'Browse the instruments marked for data sync and download missing history.',
  },
  '/issues': {
    title: 'Issues',
    description:
      'Active data and ingestion problems, the window they cover and the evidence behind them.',
  },
  '/strategies': {
    title: 'Strategies',
    description:
      'Registered strategies with their versions, parameter bindings and activation state.',
  },  '/jobs': {
    title: 'Jobs',
    description: 'Scheduled and manual jobs with progress, timing and outcomes.',
  },
  '/api-calls': {
    title: 'API calls',
    description:
      'Every outbound provider request with its outcome, latency and exact failure detail.',
  },
  '/audit': {
    title: 'Audit',
    description: 'A permanent history of sign-ins, configuration changes and system actions.',
  },
  '/settings': {
    title: 'Settings',
    description:
      'System preferences, provider connection details, configuration history and provider issues.',
  },
};

const coverageDayMeta: RouteMeta = {
  title: 'Coverage day',
  description:
    'How many minute bars were stored versus expected for this day, with gaps highlighted.',
};

const evaluationsMeta: RouteMeta = {
  title: 'Evaluations',
  description:
    'Research evaluation runs for this strategy, their status, date range and signal counts.',
};

const evaluationRunMeta: RouteMeta = {
  title: 'Evaluation run',
  description:
    'Pinned inputs, summary counts, research signals and the instrument-day explainability ledger.',
};

const detailRoutes: Array<{ prefix: string; meta: RouteMeta }> = [
  {
    prefix: '/accounts/',
    meta: {
      title: 'Account',
      description:
        'Account details, tradable instruments, equity snapshots and recent trading sessions.',
    },
  },
  {
    prefix: '/instruments/',
    meta: {
      title: 'Instrument',
      description:
        'Download coverage, run history, provider mappings and data issues for this instrument.',
    },
  },
  {
    prefix: '/strategies/',
    meta: {
      title: 'Strategy',
      description:
        'Versions, parameter bindings and activation state for this strategy.',
    },
  },
  {
    prefix: '/jobs/',
    meta: {
      title: 'Job',
      description: 'Progress, timing and details for this job run.',
    },
  },
  {
    prefix: '/settings/',
    meta: {
      title: 'Settings',
      description: 'Provider state, configuration history and system preferences.',
    },
  },
];

const fallback: RouteMeta = { title: 'AI Trading System', description: '' };

const coverageDayPattern = /^\/instruments\/[^/]+\/coverage\//;
const evaluationRunPattern = /^\/strategies\/[^/]+\/evaluations\/[^/]+$/;
const evaluationsPattern = /^\/strategies\/[^/]+\/evaluations$/;

export function routeMetaFor(pathname: string): RouteMeta {
  const exact = routes[pathname];
  if (exact) return exact;

  if (coverageDayPattern.test(pathname)) return coverageDayMeta;
  if (evaluationRunPattern.test(pathname)) return evaluationRunMeta;
  if (evaluationsPattern.test(pathname)) return evaluationsMeta;

  const detail = detailRoutes.find((route) => pathname.startsWith(route.prefix));
  return detail?.meta ?? fallback;
}
