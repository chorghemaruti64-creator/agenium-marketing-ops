/**
 * Moltbook Audit Module
 * High-level audit interface that uses the ledger
 * Backward compatible with Phase 2 API
 */
import { MoltEvent, SourceAgent, Platform, ActionType } from './types.js';
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
export declare function createAuditEvent(action: PlatformAction, decision: PolicyDecision): AuditEvent;
/**
 * Audit a policy decision
 * This is the main entry point used by the policy engine
 */
export declare function audit(action: PlatformAction, decision: PolicyDecision, sourceAgent?: SourceAgent, traceId?: string): AuditEvent;
/**
 * Create a mock audit function for testing (doesn't write to disk)
 */
export declare function createMockAudit(): {
    audit: typeof audit;
    events: AuditEvent[];
};
/**
 * Audit a platform attempt (for distribution agent)
 */
export declare function auditPlatformAttempt(platform: Platform, actionType: ActionType, fingerprint: string, traceId: string, sourceAgent?: SourceAgent, retryCount?: number): MoltEvent;
/**
 * Audit a platform result (for distribution agent)
 */
export declare function auditPlatformResult(platform: Platform, actionType: ActionType, fingerprint: string, traceId: string, success: boolean, sourceAgent?: SourceAgent, options?: {
    httpStatus?: number;
    responseId?: string;
    permalink?: string;
    errorMessage?: string;
    latencyMs?: number;
}): MoltEvent;
/**
 * Audit artifact creation
 */
export declare function auditArtifact(path: string, sha256: string, kind: 'content_draft' | 'screenshot' | 'log' | 'outreach_list' | 'report' | 'other', sizeBytes: number, sourceAgent?: SourceAgent, metadata?: Record<string, any>): MoltEvent;
export { logPolicyDecision, logPlatformAttempt, logPlatformResult, logRetryScheduled, logCircuitBreaker, logArtifact, logPipelineStart, logPipelineEnd, appendEvent, appendEventBatch, writeEvent, } from './ledger.js';
export { readEventsByDate, findByFingerprint, findByTraceId, findByPlatform, findByStatus, getLatestEvents, query, } from './reader.js';
export { generateDailySummary, generateWeeklySummary, } from './summarize.js';
//# sourceMappingURL=audit.d.ts.map