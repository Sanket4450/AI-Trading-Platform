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

export interface Universe {
  id: string;
  code: string;
  name: string;
  description: string | null;
  selectionMethod: string;
  lookbackSessions: number | null;
  refreshCadence: string;
  isActive: boolean;
  latestVersion: number | null;
  latestMemberCount: number | null;
  latestEffectiveFrom: string | null;
  versionCount: number;
}

export interface UniverseMember {
  id: string;
  universeVersionId: string;
  instrumentId: string;
  symbol: string;
  name: string;
  isin: string | null;
  rank: number;
  medianTradedValue: string | null;
  addedAt: string;
  removedAt: string | null;
}

export interface UniverseVersion {
  id: string;
  universeId: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  memberCount: number;
  criteria: Record<string, unknown>;
  createdAt: string;
  members: UniverseMember[];
}

export interface UniverseDetail extends Universe {
  versions: UniverseVersion[];
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
  universeCount: number;
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

export interface StrategyMember {
  id: string;
  strategyVersionId: string;
  instrumentId: string;
  symbol: string;
  name: string;
  rank: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isEnabled: boolean;
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
  members: StrategyMember[];
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
  id: string;
  instrumentId: string;
  symbol: string;
  name: string;
  tradingDate: string;
  expectedBars: number;
  storedBars: number;
  gapCount: number;
  firstBarAt: string | null;
  lastBarAt: string | null;
  status: string;
  checkedAt: string;
}

export interface CoverageSummary {
  complete: number;
  partial: number;
  missing: number;
  total: number;
}

export interface IngestionRun {
  id: string;
  providerCode: string;
  runType: string;
  instrumentId: string | null;
  symbol: string | null;
  timeframeUnit: string | null;
  timeframeInterval: number | null;
  requestedFrom: string | null;
  requestedTo: string | null;
  status: string;
  rowsFetched: number;
  rowsWritten: number;
  rowsRejected: number;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface QualityIssue {
  id: string;
  providerCode: string | null;
  instrumentId: string | null;
  symbol: string | null;
  issueType: string;
  severity: string;
  tradingDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  details: Record<string, unknown>;
  status: string;
  detectedBy: string;
  detectedAt: string;
  resolvedAt: string | null;
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

export interface JobRun {
  id: string;
  jobName: string;
  queueName: string;
  jobType: string;
  status: string;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
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
  recentJobs: JobRun[];
  openIssues: QualityIssue[];
  latestCoverageDate: string | null;
  coverageByStatus: { status: string; count: number }[];
}
