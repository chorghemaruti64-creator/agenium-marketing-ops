/**
 * Moltbook Audit Module
 * High-level audit interface that uses the ledger
 * Backward compatible with Phase 2 API
 */

import { MoltEvent, SourceAgent, Platform, ActionType } from './types.js';
import { 
  logPolicyDecision,
  logPlatformAttempt,
  logPlatformResult,
  logArtifact,
  appendEvent,
} from './ledger.js';
import { PlatformAction, PolicyDecision } from '../policy/types.js';

export interface AuditEvent {
  timestamp: string;
  fingerprint: string;
  platform: string;
  action_type: string;
  decision: 'allow' | 'deny';
  risk_score: number;
  reason_codes: string[];
  text_preview: string;
  links: string[];
  metadata: Record<string, any>;
  evidence_count: number;
}

/**
 * Create audit event from action and decision (backward compatible)
 */
export function createAuditEvent(
  action: PlatformAction,
  decision: PolicyDecision
): AuditEvent {
  return {
    timestamp: new Date().toISOString(),
    fingerprint: decision.action_fingerprint,
    platform: action.platform,
    action_type: action.action_type,
    decision: decision.allow ? 'allow' : 'deny',
    risk_score: decision.risk_score,
    reason_codes: decision.reason_codes,
    text_preview: decision.redacted_text.substring(0, 200),
    links: action.links,
    metadata: action.metadata,
    evidence_count: action.evidence?.length ?? 0,
  };
}

/**
 * Audit a policy decision
 * This is the main entry point used by the policy engine
 */
export function audit(
  action: PlatformAction, 
  decision: PolicyDecision,
  sourceAgent: SourceAgent = 'orchestrator',
  traceId?: string
): AuditEvent {
  // Create the backward-compatible audit event
  const auditEvent = createAuditEvent(action, decision);
  
  // Log to the new ledger system
  logPolicyDecision(
    sourceAgent,
    action.platform as Platform,
    action.action_type as ActionType,
    decision.action_fingerprint,
    decision.allow,
    decision.reason_codes,
    decision.risk_score,
    decision.redacted_text,
    traceId
  );
  
  return auditEvent;
}

/**
 * Create a mock audit function for testing (doesn't write to disk)
 */
export function createMockAudit(): {
  audit: typeof audit;
  events: AuditEvent[];
} {
  const events: AuditEvent[] = [];
  
  return {
    audit: (action: PlatformAction, decision: PolicyDecision): AuditEvent => {
      const event = createAuditEvent(action, decision);
      events.push(event);
      return event;
    },
    events,
  };
}

/**
 * Audit a platform attempt (for distribution agent)
 */
export function auditPlatformAttempt(
  platform: Platform,
  actionType: ActionType,
  fingerprint: string,
  traceId: string,
  sourceAgent: SourceAgent = 'distribution',
  retryCount: number = 0
): MoltEvent {
  return logPlatformAttempt(
    sourceAgent,
    platform,
    actionType,
    fingerprint,
    traceId,
    retryCount
  );
}

/**
 * Audit a platform result (for distribution agent)
 */
export function auditPlatformResult(
  platform: Platform,
  actionType: ActionType,
  fingerprint: string,
  traceId: string,
  success: boolean,
  sourceAgent: SourceAgent = 'distribution',
  options?: {
    httpStatus?: number;
    responseId?: string;
    permalink?: string;
    errorMessage?: string;
    latencyMs?: number;
  }
): MoltEvent {
  return logPlatformResult(
    sourceAgent,
    platform,
    actionType,
    fingerprint,
    traceId,
    success,
    options
  );
}

/**
 * Audit artifact creation
 */
export function auditArtifact(
  path: string,
  sha256: string,
  kind: 'content_draft' | 'screenshot' | 'log' | 'outreach_list' | 'report' | 'other',
  sizeBytes: number,
  sourceAgent: SourceAgent = 'content',
  metadata?: Record<string, any>
): MoltEvent {
  return logArtifact(sourceAgent, path, sha256, kind, sizeBytes, metadata);
}

// Re-export for convenience
export { 
  logPolicyDecision,
  logPlatformAttempt,
  logPlatformResult,
  logRetryScheduled,
  logCircuitBreaker,
  logArtifact,
  logPipelineStart,
  logPipelineEnd,
  appendEvent,
  appendEventBatch,
  writeEvent,
} from './ledger.js';

export {
  readEventsByDate,
  findByFingerprint,
  findByTraceId,
  findByPlatform,
  findByStatus,
  getLatestEvents,
  query,
} from './reader.js';

export {
  generateDailySummary,
  generateWeeklySummary,
} from './summarize.js';
