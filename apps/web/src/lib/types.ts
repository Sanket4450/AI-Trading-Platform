export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  sessionId?: string;
}

export interface Account {
  id: string;
  code: string;
  displayName: string;
  brokerProviderId: string;
  brokerUserRef: string | null;
  baseCurrency: string;
  mode: string;
  timezone: string;
  isActive: boolean;
  openedAt: string | null;
  latestEquityAt: string | null;
  latestNetEquity: string | null;
  permissionCount: number;
  credentialExpiry: string | null;
  openSessionCount: number;
}

export interface AccountPermission {
  id: string;
  instrumentId: string;
  symbol: string;
  name: string;
  isTradable: boolean;
  productAllowlist: string[];
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface AccountAccess {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  role: string;
  grantedAt: string;
  expiresAt: string | null;
}

export interface EquitySnapshot {
  id: string;
  accountId: string;
  capturedAt: string;
  tradingDate: string;
  snapshotType: string;
  availableCash: string | null;
  netEquity: string | null;
  drawdownPct: string | null;
  source: string;
}

export interface Instrument {
  id: string;
  exchangeId: string;
  exchangeCode: string;
  tradingSymbol: string;
  name: string;
  shortName: string | null;
  isin: string | null;
  segment: string;
  instrumentType: string;
  lotSize: number;
  tickSize: string;
  freezeQuantity: string | null;
  isActive: boolean;
  listedOn: string | null;
  delistedOn: string | null;
  mappingCount: number;
}

export interface InstrumentMapping {
  id: string;
  providerId: string;
  providerCode: string;
  providerName: string;
  externalKey: string;
  exchangeToken: string | null;
  providerSymbol: string | null;
  providerSegment: string | null;
  isPrimary: boolean;
  validFrom: string;
  validTo: string | null;
}

export interface CorporateAction {
  id: string;
  instrumentId: string;
  symbol: string;
  actionType: string;
  exDate: string;
  recordDate: string | null;
  ratioNumerator: string | null;
  ratioDenominator: string | null;
  dividendPerShare: string | null;
  priceAdjustmentFactor: string;
  volumeAdjustmentFactor: string;
  source: string;
  status: string;
  notes: string | null;
}

export interface Strategy {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  latestVersion: number | null;
  latestVersionStatus: string | null;
  versionCount: number;
  activeActivations: number;
}

export interface StrategyBinding {
  id: string;
  strategyVersionId: string;
  configurationVersionId: string;
  role: string;
  boundAt: string;
  configType: string;
  scopeKey: string;
  configVersion: number;
  payloadHash: string;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface StrategyActivation {
  id: string;
  strategyVersionId: string;
  accountId: string;
  accountCode: string;
  mode: string;
  status: string;
  activatedAt: string;
  deactivatedAt: string | null;
}

export interface StrategyVersion {
  id: string;
  strategyId: string;
  version: number;
  codeRef: string;
  parameterSchema: Record<string, unknown>;
  status: string;
  changelog: string | null;
  releasedAt: string | null;
  createdAt: string;
  bindings: StrategyBinding[];
  activations: StrategyActivation[];
}

export interface StrategyDetail extends Strategy {
  versions: StrategyVersion[];
}

export interface ConfigurationVersion {
  id: string;
  configType: string;
  scopeKey: string;
  version: number;
  payload: Record<string, unknown>;
  payloadHash: string;
  schemaVersion: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  supersedesId: string | null;
  createdBy: string | null;
  createdAt: string;
  bindings?: {
    id: string;
    strategyVersionId: string;
    role: string;
    strategyCode: string;
    strategyVersion: number;
    boundAt: string;
  }[];
}

export interface ConfigurationDiff {
  left: ConfigurationVersion;
  right: ConfigurationVersion;
  changes: { path: string; left: unknown; right: unknown }[];
}

export interface CoverageRow {
  instrumentId: string;
  tradingDate: string;
  expectedBars: number;
  storedBars: number;
  status: string;
  checkedAt: string;
}

export interface SystemIssue {
  id: string;
  source: string;
  kind: string;
  severity: string;
  providerId: string | null;
  providerCode: string | null;
  instrumentId: string | null;
  symbol: string | null;
  scope: 'instrument' | 'provider' | 'system';
  dedupeKey: string;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  payload: Record<string, unknown>;
}

export interface AuditRow {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  accountId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface SystemSetting {
  key: string;
  value: unknown;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface JobRunSummary {
  id: string;
  jobName: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface JobStats {
  running: number;
  failed24h: number;
  succeeded24h: number;
  p95DurationMs: number;
}

export interface JobEvent {
  id: number;
  occurredAt: string;
  stage: string;
  type: string;
  data: Record<string, unknown>;
}

export interface JobProgress {
  stage: string;
  stageIndex: number;
  stageTotal: number;
  completed: number | null;
  total: number | null;
}

export interface JobRun {
  id: string;
  jobName: string;
  queueName: string;
  jobType: string;
  status: string;
  groupId: string | null;
  instrumentId: string | null;
  attempt: number;
  maxAttempts: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  durationMs: number | null;
  latestEvent: JobEvent | null;
  progress: JobProgress | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface JobListResponse {
  summary: JobStats;
  items: JobRun[];
}

export interface JobStage {
  key: string;
  status: string;
  quantified: boolean;
  completed: number | null;
  total: number | null;
  enteredAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
}

export interface JobDetail {
  run: JobRun;
  stages: JobStage[];
  events: JobEvent[];
  progress: JobProgress | null;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  latencyMs: number | null;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  service: string;
  mode: string;
  timestamp: string;
  checks: { database: HealthCheck; redis: HealthCheck };
}

export interface SystemStatus {
  mode: string;
  counts: Record<string, number | string | null>;
  latestHealth: {
    component: string;
    status: string;
    latencyMs: number | null;
    capturedAt: string;
  }[];
  queues: {
    historicalData: Record<string, number> | null;
    maintenance: Record<string, number> | null;
    error?: string;
  };
}

export interface Overview {
  counts: Record<string, number | string | null>;
  recentJobs: JobRunSummary[];
  openIssues: Array<
    Pick<
      SystemIssue,
      'id' | 'instrumentId' | 'source' | 'kind' | 'severity' | 'symbol' | 'lastSeenAt' | 'payload'
    >
  >;
  latestCoverageDate: string | null;
  coverageByStatus: { status: string; count: number }[];
}

export interface InstrumentCoverageRow {
  instrumentId: string;
  symbol: string;
  name: string;
  isin: string | null;
  segment: string;
  instrumentType: string;
  tickSize: string;
  isActive: boolean;
  listedOn: string | null;
  delistedOn: string | null;
  targetFrom: string | null;
  targetTo: string | null;
  fetchStatus: string | null;
  dataStatus: string | null;
  expectedDays: number | null;
  completeDays: number | null;
  partialDays: number | null;
  missingDays: number | null;
  openCriticalIssues: number | null;
  lastSuccessAt: string | null;
  computedAt: string | null;
  mappingCount: number;
}

export interface InstrumentCoverageMonth {
  month: string;
  complete: number;
  partial: number;
  missing: number;
}

export interface InstrumentCoverageDetail extends InstrumentCoverageRow {
  months: InstrumentCoverageMonth[];
  issues: SystemIssue[];
}

export interface ProviderStatus {
  provider: string;
  networkEnabled: boolean;
  apiKeyConfigured: boolean;
  tokenConfigured: boolean;
  baseUrl: string;
  budget: {
    availableSecond: number;
    availableMinute: number;
    available30Minutes: number;
    pausedUntil: string | null;
  } | null;
  lastSuccessfulSyncAt: string | null;
  lastSuccessfulBackfillAt: string | null;
  lastSuccessfulIntradayAt: string | null;
  failedRuns24h: number;
  runningChunks: number;
  queuedChunks: number;
  payloadCount: number;
  payloadBytes: string | number;
  oldestPayloadAt: string | null;
}

