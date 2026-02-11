/**
 * Moltbook Ledger
 * Append-only event writer with crash safety
 */
import { MoltEvent, SourceAgent, EventStatus, Platform, ActionType } from './types.js';
/**
 * Append event to JSONL file (crash-safe)
 */
export declare function appendEvent(event: MoltEvent): string;
/**
 * Write multiple events in a batch (more efficient)
 */
export declare function appendEventBatch(events: MoltEvent[]): string;
/**
 * Write event and return event (for chaining)
 */
export declare function writeEvent(event: MoltEvent): MoltEvent;
/**
 * Create and write a policy decision event (legacy signature)
 */
export declare function logPolicyDecisionLegacy(sourceAgent: SourceAgent, platform: Platform, actionType: ActionType, fingerprint: string, allow: boolean, reasonCodes: string[], riskScore: number, redactedText: string, traceId?: string): MoltEvent;
/**
 * Log platform attempt (legacy signature)
 */
export declare function logPlatformAttemptLegacy(sourceAgent: SourceAgent, platform: Platform, actionType: ActionType, fingerprint: string, traceId: string, retryCount?: number): MoltEvent;
/**
 * Log platform result (legacy signature)
 */
export declare function logPlatformResultLegacy(sourceAgent: SourceAgent, platform: Platform, actionType: ActionType, fingerprint: string, traceId: string, success: boolean, options?: {
    httpStatus?: number;
    responseId?: string;
    permalink?: string;
    errorMessage?: string;
    latencyMs?: number;
}): MoltEvent;
/**
 * Log retry scheduled
 */
export declare function logRetryScheduled(sourceAgent: SourceAgent, platform: Platform, actionType: ActionType, fingerprint: string, traceId: string, attempt: number, maxAttempts: number, backoffSeconds: number, reason: string): MoltEvent;
/**
 * Log circuit breaker change
 */
export declare function logCircuitBreaker(sourceAgent: SourceAgent, platform: Platform, action: 'opened' | 'closed', failures: number, threshold: number, cooldownUntil?: string, reason?: string): MoltEvent;
/**
 * Log artifact creation
 */
export declare function logArtifact(sourceAgent: SourceAgent, path: string, sha256: string, kind: 'content_draft' | 'screenshot' | 'log' | 'outreach_list' | 'report' | 'other', sizeBytes: number, metadata?: Record<string, any>): MoltEvent;
/**
 * Log pipeline run start
 */
export declare function logPipelineStart(sourceAgent: SourceAgent, runId: string, pipelineName: string, triggeredBy: 'schedule' | 'manual' | 'webhook', config?: Record<string, any>): MoltEvent;
/**
 * Log pipeline run end
 */
export declare function logPipelineEnd(sourceAgent: SourceAgent, runId: string, pipelineName: string, success: boolean, durationMs: number, eventsCount: number, successCount: number, failureCount: number): MoltEvent;
/**
 * Get all event files for a date
 */
export declare function getEventFiles(date: string): string[];
interface AgentLogParams {
    sourceAgent: string;
    platform?: Platform;
    actionType?: ActionType;
    fingerprint?: string;
    traceId?: string;
    status?: EventStatus;
    summary?: string;
    data?: Record<string, any>;
    links?: string[];
}
/**
 * Log policy decision (agent-friendly version)
 */
export declare function logPolicyDecision(moltbookDir: string, params: AgentLogParams): Promise<MoltEvent>;
/**
 * Log platform attempt (agent-friendly version)
 */
export declare function logPlatformAttempt(moltbookDir: string, params: AgentLogParams): Promise<MoltEvent>;
/**
 * Log platform result (agent-friendly version)
 */
export declare function logPlatformResult(moltbookDir: string, params: AgentLogParams): Promise<MoltEvent>;
/**
 * Log agent action (generic logging for agent activities)
 */
export declare function logAgentAction(moltbookDir: string, params: AgentLogParams): Promise<MoltEvent>;
/**
 * Log error (agent-friendly version)
 */
export declare function logError(moltbookDir: string, params: AgentLogParams): Promise<MoltEvent>;
/**
 * Check for partial/corrupt files
 */
export declare function checkIntegrity(date: string): {
    valid: string[];
    partial: string[];
};
export {};
//# sourceMappingURL=ledger.d.ts.map