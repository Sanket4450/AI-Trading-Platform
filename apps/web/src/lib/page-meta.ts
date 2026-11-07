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
      'Browse NSE cash equities, check NIFTY 50 membership and download missing data.',
  },
  '/universes': {
    title: 'Universes',
    description: 'Reusable instrument groups with versioned membership and strategy links.',
  },
  '/strategies': {
    title: 'Strategies',
    description:
      'Registered strategies with their versions, parameter bindings and activation state.',
  },
  '/data': {
    title: 'Data health',
    description:
      'Coverage, downloads, validation results and the data issues that need attention.',
  },
  '/jobs': {
    title: 'Jobs',
    description: 'Scheduled and manual jobs with progress, timing and outcomes.',
  },
  '/audit': {
    title: 'Audit',
    description: 'A permanent history of sign-ins, configuration changes and system actions.',
  },
  '/settings': {
    title: 'Settings',
    description: 'System preferences, configuration history and provider connection details.',
  },
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
    prefix: '/universes/',
    meta: {
      title: 'Universe',
      description: 'Version history and current members of this universe.',
    },
  },
  {
    prefix: '/strategies/',
    meta: {
      title: 'Strategy',
      description:
        'Versions, parameter bindings, member universes and activation state for this strategy.',
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
    prefix: '/data/backfills/',
    meta: {
      title: 'Backfill plan',
      description: 'Progress of this download plan across instruments and monthly chunks.',
    },
  },
  {
    prefix: '/data/runs/',
    meta: {
      title: 'Ingestion run',
      description: 'Counts, timing and the archived provider payload for this download.',
    },
  },
  {
    prefix: '/data/issues/',
    meta: {
      title: 'Quality issue',
      description: 'What was detected, the affected dates and the resolution history.',
    },
  },
  {
    prefix: '/data/coverage/',
    meta: {
      title: 'Coverage day',
      description:
        'How many minute bars were stored versus expected for this day, with gaps highlighted.',
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
