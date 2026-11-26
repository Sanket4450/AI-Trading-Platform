import type { Paginated, PaginationMeta } from '@ai-trading/domain';

export type { Paginated, PaginationMeta };

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
  mode: string;
  isActive: boolean;
  openedAt: string | null;
  latestEquityAt: string | null;
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
  tickSize: string;
  freezeQuantity: string | null;
  isActive: boolean;
  isSyncTarget: boolean;
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
  runtimeStatus?: string;
  lastEvaluationId?: string | null;
  lastEvaluationStatus?: string | null;
  lastEvaluationAt?: string | null;
}

export interface StrategyRuntime {
  status: string;
  code: string;
  codeRef: string | null;
  implementation: string | null;
  implementationVersion: string | null;
  schemaMatches: boolean | null;
  parameterNames: string[];
  error: string | null;
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
  runtimeStatus?: string;
  runtimeError?: string | null;
}

export interface StrategyDetail extends Strategy {
  versions: StrategyVersion[];
  runtime: StrategyRuntime;
}

export interface EvaluationRunSummary {
  instrumentDays: number;
  instrumentsWithSignals: number;
  entries: number;
  exits: number;
  skippedDays: number;
  noSignalDays: number;
}

export interface EvaluationRun {
  id: string;
  strategyVersionId: string;
  version: number;
  codeRef: string;
  configurationVersionId: string;
  riskConfigurationVersionId: string | null;
  fromDate: string;
  toDate: string;
  initialCapital: string;
  status: string;
  note: string | null;
  jobRunId: string | null;
  error: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  entries?: number;
  exits?: number;
  instrumentDays?: number;
}

export interface EvaluationRunDetail extends EvaluationRun {
  strategyId: string;
  strategyCode: string;
  strategyName: string;
  parameterVersion: number;
  parameterHash: string;
  riskVersion: number | null;
  runtime: StrategyRuntime;
  summary: EvaluationRunSummary;
}

export interface EvaluationResult {
  id: string;
  tradingDate: string;
  instrumentId: string;
  symbol: string;
  name: string;
  status: string;
  reasonCode: string | null;
  diagnostics: Record<string, unknown>;
  signalCount: number;
}

export interface ResearchSignal {
  id: string;
  evaluationRunId: string | null;
  strategyVersionId: string;
  instrumentId: string;
  symbol: string;
  name: string;
  signalAt: string;
  candleStart: string;
  direction: string;
  signalType: string;
  referencePrice: string;
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  quantity: string | null;
  evidence?: Record<string, unknown>;
  status: string;
}

export interface ResearchSignalDetail extends ResearchSignal {
  version: number;
  evidence: Record<string, unknown>;
  createdAt: string;
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
  requestId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditDetail extends AuditRow {
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
}

export interface AuditSummary {
  total: number;
  actors: number;
  entityTypes: number;
}

export interface IssueSummary {
  total: number;
  critical: number;
  instrumentScoped: number;
  providerScoped: number;
}

export interface StrategySummary {
  total: number;
  versions: number;
  activeActivations: number;
}

export interface AccountSummary {
  total: number;
  active: number;
  permissionTotal: number;
  credentialsTracked: number;
}

export interface ConfigurationSummary {
  total: number;
  configTypes: number;
  scopeKeys: number;
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

export type JobListResponse = Paginated<JobRun>;

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
  /** Resolved from the instrument master; null for runs without an instrument. */
  instrument: { symbol: string; name: string } | null;
  stages: JobStage[];
  events: JobEvent[];
  eventsPage: PaginationMeta;
  progress: JobProgress | null;
}

/** Recorded shape of a call's parameters; all three buckets are always present. */
export interface ApiCallScope {
  path: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, unknown>;
}

export interface ExternalApiCall {
  id: number;
  jobRunId: string | null;
  jobName: string | null;
  instrumentId: string | null;
  instrumentSymbol: string | null;
  startedAt: string;
  latencyMs: number;
  service: string;
  operation: string;
  method: string;
  endpoint: string;
  url: string;
  requestScope: ApiCallScope;
  statusCode: number | null;
  outcome: string;
  errorBody: string | null;
}

export interface ApiCallOutcomeCount {
  outcome: string;
  count: number;
}

export interface ApiCallSummary {
  total: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  outcomes: ApiCallOutcomeCount[];
}

export interface ExternalApiCallPage {
  items: ExternalApiCall[];
  page: PaginationMeta;
  summary: ApiCallSummary;
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
  /** Live queued/running historical-backfill job, or null when nothing is in flight. */
  activeJobId: string | null;
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

