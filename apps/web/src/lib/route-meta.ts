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
  '/strategies': {
    title: 'Strategies',
    description:
      'Registered strategies with their versions, parameter bindings and activation state.',
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
    description:
      'System preferences, provider connection details, configuration history and provider issues.',
  },
};

const coverageDayMeta: RouteMeta = {
  title: 'Coverage day',
  description:
    'How many minute bars were stored versus expected for this day, with gaps highlighted.',
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
    prefix: '/instruments/issues/',
    meta: {
      title: 'Data issue',
      description: 'What was detected, the affected dates and the resolution history.',
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
    prefix: '/settings/issues/',
    meta: {
      title: 'Provider issue',
      description: 'What was detected, the affected window and the resolution history.',
    },
  },
];

const fallback: RouteMeta = { title: 'AI Trading System', description: '' };

const coverageDayPattern = /^\/instruments\/[^/]+\/coverage\//;

export function routeMetaFor(pathname: string): RouteMeta {
  const exact = routes[pathname];
  if (exact) return exact;

  if (coverageDayPattern.test(pathname)) return coverageDayMeta;

  const detail = detailRoutes.find((route) => pathname.startsWith(route.prefix));
  return detail?.meta ?? fallback;
}
