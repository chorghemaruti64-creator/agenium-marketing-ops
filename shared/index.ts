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

// Moltbook
export {
  audit,
  createAuditEvent,
  writeEvent,
  appendDailySummary,
  createMockAudit,
} from './moltbook/audit.js';

export type {
  AuditEvent,
} from './moltbook/audit.js';
