/**
 * Moltbook Audit Module
 * High-level audit interface that uses the ledger
 * Backward compatible with Phase 2 API
 */
import { logPolicyDecisionLegacy, logPlatformAttemptLegacy, logPlatformResultLegacy, logArtifact, } from './ledger.js';
/**
 * Create audit event from action and decision (backward compatible)
 */
export function createAuditEvent(action, decision) {
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
export function audit(action, decision, sourceAgent = 'orchestrator', traceId) {
    // Create the backward-compatible audit event
    const auditEvent = createAuditEvent(action, decision);
    // Log to the new ledger system
    logPolicyDecisionLegacy(sourceAgent, action.platform, action.action_type, decision.action_fingerprint, decision.allow, decision.reason_codes, decision.risk_score, decision.redacted_text, traceId);
    return auditEvent;
}
/**
 * Create a mock audit function for testing (doesn't write to disk)
 */
export function createMockAudit() {
    const events = [];
    return {
        audit: (action, decision) => {
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
export function auditPlatformAttempt(platform, actionType, fingerprint, traceId, sourceAgent = 'distribution', retryCount = 0) {
    return logPlatformAttemptLegacy(sourceAgent, platform, actionType, fingerprint, traceId, retryCount);
}
/**
 * Audit a platform result (for distribution agent)
 */
export function auditPlatformResult(platform, actionType, fingerprint, traceId, success, sourceAgent = 'distribution', options) {
    return logPlatformResultLegacy(sourceAgent, platform, actionType, fingerprint, traceId, success, options);
}
/**
 * Audit artifact creation
 */
export function auditArtifact(path, sha256, kind, sizeBytes, sourceAgent = 'content', metadata) {
    return logArtifact(sourceAgent, path, sha256, kind, sizeBytes, metadata);
}
// Re-export for convenience
export { logPolicyDecision, logPlatformAttempt, logPlatformResult, logRetryScheduled, logCircuitBreaker, logArtifact, logPipelineStart, logPipelineEnd, appendEvent, appendEventBatch, writeEvent, } from './ledger.js';
export { readEventsByDate, findByFingerprint, findByTraceId, findByPlatform, findByStatus, getLatestEvents, query, } from './reader.js';
export { generateDailySummary, generateWeeklySummary, } from './summarize.js';
//# sourceMappingURL=audit.js.map