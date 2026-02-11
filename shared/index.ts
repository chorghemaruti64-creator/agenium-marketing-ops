/**
 * Marketing-Ops Shared Modules
 * Export all public APIs
 */

// Policy Engine
export {
  evaluate,
  createPolicyEvaluator,
  generateFingerprint,
} from './policy/policy.js';

export type {
  PolicyStore,
  PolicyAudit,
} from './policy/policy.js';

// Types
export type {
  Platform,
  ActionType,
  Evidence,
  ContentMetadata,
  PlatformAction,
  EnforcedLimits,
  ReasonCode,
  PolicyDecision,
  RateLimitConfig,
  PolicyConfig,
} from './policy/types.js';

export {
  DEFAULT_CONFIG,
  DEFAULT_RATE_LIMITS,
} from './policy/types.js';

// Redaction
export {
  redactSecrets,
  containsSecrets,
} from './policy/redact.js';

export type {
  RedactionResult,
} from './policy/redact.js';

// Rules
export {
  runSafetyChecks,
  checkBrandCompliance,
  checkEvidenceRequirement,
  checkHateHarassment,
  checkSexualContent,
  checkDoxxing,
  checkIllegalInstructions,
  checkPoliticalTargeting,
  hasBrandMention,
  hasNumericClaims,
  requiresBrandMention,
  allowedDuringQuietHours,
} from './policy/rules.js';

// Risk
export {
  calculateRiskScore,
  isRiskTooHigh,
  countExternalLinks,
  isLowQuality,
  hasRiskyKeywords,
} from './policy/risk.js';

export type {
  RiskBreakdown,
} from './policy/risk.js';

// Store
export {
  PolicyStore as SQLitePolicyStore,
  createMockStore,
  getMockStore,
  clearMockStore,
  createInMemoryStore,
} from './store/sqlite.js';

export type {
  ActionLogEntry,
  RateCount,
  DedupeEntry,
} from './store/sqlite.js';

// Moltbook Types
export type {
  MoltEvent,
  EventType,
  SourceAgent,
  EventStatus,
  Platform as MoltPlatform,
  ActionType as MoltActionType,
  PeriodSummary,
} from './moltbook/types.js';

export { createEvent } from './moltbook/types.js';

// Moltbook Ledger
export {
  appendEvent,
  appendEventBatch,
  writeEvent as writeMoltEvent,
  logPolicyDecision,
  logPlatformAttempt,
  logPlatformResult,
  logRetryScheduled,
  logCircuitBreaker,
  logArtifact,
  logPipelineStart,
  logPipelineEnd,
  getEventFiles,
  checkIntegrity,
} from './moltbook/ledger.js';

// Moltbook Reader
export {
  getAvailableDates,
  readEventsByDate,
  readEventsByDateRange,
  findByFingerprint,
  findByTraceId,
  findByPlatform as findEventsByPlatform,
  findByStatus as findEventsByStatus,
  findByEventType,
  findByAgent,
  getLatestEvents,
  getFailedEvents,
  getBlockedEvents,
  getSuccessfulPosts,
  getCircuitBreakerChanges,
  getPipelineRuns,
  getArtifacts,
  countBy,
  getTopDenyReasons,
  query as queryEvents,
} from './moltbook/reader.js';

export type { QueryFilters } from './moltbook/reader.js';

// Moltbook Summarize
export {
  generateSummary,
  formatSummaryAsMarkdown,
  generateDailySummary,
  generateWeeklySummary,
  backfillSummaries,
} from './moltbook/summarize.js';

// Moltbook Audit (backward compatible)
export {
  audit,
  createAuditEvent,
  createMockAudit,
  auditPlatformAttempt,
  auditPlatformResult,
  auditArtifact,
} from './moltbook/audit.js';

export type {
  AuditEvent,
} from './moltbook/audit.js';
