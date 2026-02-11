/**
 * Moltbook Ledger
 * Append-only event writer with crash safety
 */
import { mkdirSync, writeFileSync, renameSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
// Read path at runtime, not module load time
function getMoltbookPath() {
    return process.env.MOLTBOOK_PATH || '/opt/marketing-ops/moltbook';
}
/**
 * Ensure directory exists
 */
function ensureDir(path) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}
/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday() {
    return new Date().toISOString().split('T')[0];
}
/**
 * Get current week in YYYY-WW format
 */
function getWeek() {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${week.toString().padStart(2, '0')}`;
}
/**
 * Generate event filename
 */
function getEventFilename(event) {
    const ts = event.ts.replace(/[:.]/g, '-');
    const fp = event.fingerprint?.substring(0, 8) || 'none';
    return `${ts}_${fp}_${event.event_type}.jsonl`;
}
/**
 * Atomic write: write to temp then rename
 */
function atomicAppend(filepath, content) {
    ensureDir(dirname(filepath));
    const tempPath = `${filepath}.${randomUUID()}.tmp`;
    try {
        // If file exists, read it first
        let existing = '';
        if (existsSync(filepath)) {
            existing = readFileSync(filepath, 'utf-8');
        }
        // Write complete content to temp
        writeFileSync(tempPath, existing + content);
        // Atomic rename
        renameSync(tempPath, filepath);
    }
    catch (error) {
        // Clean up temp file if rename failed
        try {
            if (existsSync(tempPath)) {
                const { unlinkSync } = require('fs');
                unlinkSync(tempPath);
            }
        }
        catch { }
        throw error;
    }
}
/**
 * Append event to JSONL file (crash-safe)
 */
export function appendEvent(event) {
    const today = getToday();
    const eventsDir = join(getMoltbookPath(), 'events', today);
    ensureDir(eventsDir);
    const filename = getEventFilename(event);
    const filepath = join(eventsDir, filename);
    const line = JSON.stringify(event) + '\n';
    // Use atomic append for crash safety
    atomicAppend(filepath, line);
    return filepath;
}
/**
 * Write multiple events in a batch (more efficient)
 */
export function appendEventBatch(events) {
    if (events.length === 0)
        return '';
    const today = getToday();
    const eventsDir = join(getMoltbookPath(), 'events', today);
    ensureDir(eventsDir);
    // Use first event's fingerprint for filename
    const batchId = randomUUID().substring(0, 8);
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}_${batchId}_BATCH.jsonl`;
    const filepath = join(eventsDir, filename);
    const content = events.map(e => JSON.stringify(e)).join('\n') + '\n';
    atomicAppend(filepath, content);
    return filepath;
}
/**
 * Write event and return event (for chaining)
 */
export function writeEvent(event) {
    appendEvent(event);
    return event;
}
/**
 * Create and write a policy decision event (legacy signature)
 */
export function logPolicyDecisionLegacy(sourceAgent, platform, actionType, fingerprint, allow, reasonCodes, riskScore, redactedText, traceId) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'POLICY_DECISION',
        platform,
        action_type: actionType,
        fingerprint,
        trace_id: traceId ?? randomUUID(),
        status: allow ? 'ok' : 'blocked',
        summary: allow
            ? `Allowed ${actionType} on ${platform}`
            : `Blocked ${actionType} on ${platform}: ${reasonCodes.join(', ')}`,
        data: {
            allow,
            reason_codes: reasonCodes,
            risk_score: riskScore,
            redacted_text: redactedText.substring(0, 500),
        },
    };
    return writeEvent(event);
}
/**
 * Log platform attempt (legacy signature)
 */
export function logPlatformAttemptLegacy(sourceAgent, platform, actionType, fingerprint, traceId, retryCount = 0) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'PLATFORM_ATTEMPT',
        platform,
        action_type: actionType,
        fingerprint,
        trace_id: traceId,
        status: 'ok',
        summary: `Attempting ${actionType} on ${platform}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`,
        data: {
            retry_count: retryCount,
        },
    };
    return writeEvent(event);
}
/**
 * Log platform result (legacy signature)
 */
export function logPlatformResultLegacy(sourceAgent, platform, actionType, fingerprint, traceId, success, options) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'PLATFORM_RESULT',
        platform,
        action_type: actionType,
        fingerprint,
        trace_id: traceId,
        status: success ? 'ok' : 'failed',
        summary: success
            ? `Successfully posted ${actionType} on ${platform}`
            : `Failed ${actionType} on ${platform}: ${options?.errorMessage || 'unknown error'}`,
        data: {
            success,
            http_status: options?.httpStatus,
            response_id: options?.responseId,
            permalink: options?.permalink,
            error_message: options?.errorMessage,
            latency_ms: options?.latencyMs,
        },
        links: options?.permalink ? [options.permalink] : undefined,
    };
    return writeEvent(event);
}
/**
 * Log retry scheduled
 */
export function logRetryScheduled(sourceAgent, platform, actionType, fingerprint, traceId, attempt, maxAttempts, backoffSeconds, reason) {
    const scheduledAt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'RETRY_SCHEDULED',
        platform,
        action_type: actionType,
        fingerprint,
        trace_id: traceId,
        status: 'retrying',
        summary: `Retry ${attempt}/${maxAttempts} scheduled in ${backoffSeconds}s for ${platform}`,
        data: {
            attempt,
            max_attempts: maxAttempts,
            backoff_seconds: backoffSeconds,
            scheduled_at: scheduledAt,
            reason,
        },
    };
    return writeEvent(event);
}
/**
 * Log circuit breaker change
 */
export function logCircuitBreaker(sourceAgent, platform, action, failures, threshold, cooldownUntil, reason) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: action === 'opened' ? 'CIRCUIT_BREAKER_OPENED' : 'CIRCUIT_BREAKER_CLOSED',
        platform,
        status: action === 'opened' ? 'blocked' : 'ok',
        summary: action === 'opened'
            ? `Circuit breaker OPENED for ${platform} after ${failures} failures`
            : `Circuit breaker CLOSED for ${platform}`,
        data: {
            platform,
            failures,
            threshold,
            cooldown_until: cooldownUntil,
            reason,
        },
    };
    return writeEvent(event);
}
/**
 * Log artifact creation
 */
export function logArtifact(sourceAgent, path, sha256, kind, sizeBytes, metadata) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'ARTIFACT_CREATED',
        status: 'ok',
        summary: `Created ${kind}: ${path}`,
        data: {
            path,
            sha256,
            kind,
            size_bytes: sizeBytes,
            metadata,
        },
    };
    // Also update artifacts manifest
    updateArtifactsManifest(path, sha256, kind, sizeBytes);
    return writeEvent(event);
}
/**
 * Update artifacts manifest
 */
function updateArtifactsManifest(path, sha256, kind, sizeBytes) {
    const today = getToday();
    const artifactsDir = join(getMoltbookPath(), 'artifacts', today);
    ensureDir(artifactsDir);
    const manifestPath = join(artifactsDir, 'manifest.json');
    let manifest = [];
    if (existsSync(manifestPath)) {
        try {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        }
        catch { }
    }
    manifest.push({
        path,
        sha256,
        kind,
        size_bytes: sizeBytes,
        created_at: new Date().toISOString(),
    });
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
/**
 * Log pipeline run start
 */
export function logPipelineStart(sourceAgent, runId, pipelineName, triggeredBy, config) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'PIPELINE_RUN_START',
        trace_id: runId,
        status: 'ok',
        summary: `Pipeline ${pipelineName} started (${triggeredBy})`,
        data: {
            run_id: runId,
            pipeline_name: pipelineName,
            triggered_by: triggeredBy,
            config,
        },
    };
    return writeEvent(event);
}
/**
 * Log pipeline run end
 */
export function logPipelineEnd(sourceAgent, runId, pipelineName, success, durationMs, eventsCount, successCount, failureCount) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: sourceAgent,
        event_type: 'PIPELINE_RUN_END',
        trace_id: runId,
        status: success ? 'ok' : 'failed',
        summary: `Pipeline ${pipelineName} ${success ? 'completed' : 'failed'} in ${durationMs}ms`,
        data: {
            run_id: runId,
            pipeline_name: pipelineName,
            duration_ms: durationMs,
            events_count: eventsCount,
            success_count: successCount,
            failure_count: failureCount,
        },
    };
    return writeEvent(event);
}
/**
 * Get all event files for a date
 */
export function getEventFiles(date) {
    const eventsDir = join(getMoltbookPath(), 'events', date);
    if (!existsSync(eventsDir))
        return [];
    return readdirSync(eventsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => join(eventsDir, f))
        .sort();
}
/**
 * Append event to specific moltbook directory
 */
function appendEventToDir(moltbookDir, event) {
    const today = getToday();
    const eventsDir = join(moltbookDir, 'events', today);
    ensureDir(eventsDir);
    const filename = getEventFilename(event);
    const filepath = join(eventsDir, filename);
    const line = JSON.stringify(event) + '\n';
    atomicAppend(filepath, line);
    return filepath;
}
/**
 * Log policy decision (agent-friendly version)
 */
export function logPolicyDecision(moltbookDir, params) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: params.sourceAgent,
        event_type: 'POLICY_DECISION',
        platform: params.platform,
        action_type: params.actionType,
        fingerprint: params.fingerprint,
        trace_id: params.traceId ?? randomUUID(),
        status: params.status ?? 'ok',
        summary: params.summary ?? 'Policy decision',
        data: params.data ?? {},
        links: params.links,
    };
    appendEventToDir(moltbookDir, event);
    return Promise.resolve(event);
}
/**
 * Log platform attempt (agent-friendly version)
 */
export function logPlatformAttempt(moltbookDir, params) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: params.sourceAgent,
        event_type: 'PLATFORM_ATTEMPT',
        platform: params.platform,
        action_type: params.actionType,
        fingerprint: params.fingerprint,
        trace_id: params.traceId ?? randomUUID(),
        status: 'ok',
        summary: params.summary ?? `Attempting ${params.actionType} on ${params.platform}`,
        data: params.data ?? {},
    };
    appendEventToDir(moltbookDir, event);
    return Promise.resolve(event);
}
/**
 * Log platform result (agent-friendly version)
 */
export function logPlatformResult(moltbookDir, params) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: params.sourceAgent,
        event_type: 'PLATFORM_RESULT',
        platform: params.platform,
        action_type: params.actionType,
        fingerprint: params.fingerprint,
        trace_id: params.traceId ?? randomUUID(),
        status: params.status ?? 'ok',
        summary: params.summary ?? `Result for ${params.actionType} on ${params.platform}`,
        data: params.data ?? {},
        links: params.links,
    };
    appendEventToDir(moltbookDir, event);
    return Promise.resolve(event);
}
/**
 * Log agent action (generic logging for agent activities)
 */
export function logAgentAction(moltbookDir, params) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: params.sourceAgent,
        event_type: 'AGENT_ACTION',
        platform: params.platform,
        action_type: params.actionType,
        fingerprint: params.fingerprint,
        trace_id: params.traceId ?? randomUUID(),
        status: params.status ?? 'ok',
        summary: params.summary ?? 'Agent action',
        data: params.data ?? {},
        links: params.links,
    };
    appendEventToDir(moltbookDir, event);
    return Promise.resolve(event);
}
/**
 * Log error (agent-friendly version)
 */
export function logError(moltbookDir, params) {
    const event = {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent: params.sourceAgent,
        event_type: 'ERROR',
        platform: params.platform,
        fingerprint: params.fingerprint,
        trace_id: params.traceId ?? randomUUID(),
        status: 'error',
        summary: params.summary ?? 'Error occurred',
        data: params.data ?? {},
    };
    appendEventToDir(moltbookDir, event);
    return Promise.resolve(event);
}
// ============================================================================
/**
 * Check for partial/corrupt files
 */
export function checkIntegrity(date) {
    const files = getEventFiles(date);
    const valid = [];
    const partial = [];
    for (const file of files) {
        try {
            const content = readFileSync(file, 'utf-8');
            const lines = content.trim().split('\n');
            let isValid = true;
            for (const line of lines) {
                try {
                    JSON.parse(line);
                }
                catch {
                    isValid = false;
                    break;
                }
            }
            if (isValid) {
                valid.push(file);
            }
            else {
                partial.push(file);
            }
        }
        catch {
            partial.push(file);
        }
    }
    return { valid, partial };
}
//# sourceMappingURL=ledger.js.map