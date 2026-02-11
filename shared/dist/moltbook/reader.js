/**
 * Moltbook Reader
 * Query helpers for the event ledger
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
// Read path at runtime, not module load time
function getMoltbookPath() {
    return process.env.MOLTBOOK_PATH || '/opt/marketing-ops/moltbook';
}
/**
 * Read events with custom moltbook directory
 * Used by agents that need to specify the path
 */
export function queryByDate(moltbookDir, date) {
    const eventsDir = join(moltbookDir, 'events', date);
    if (!existsSync(eventsDir))
        return [];
    const files = readdirSync(eventsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => join(eventsDir, f));
    const events = [];
    for (const file of files) {
        events.push(...readJsonlFile(file));
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
}
/**
 * Query events by platform with custom moltbook directory
 */
export function queryByPlatform(moltbookDir, platform, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = queryByDate(moltbookDir, targetDate);
    return events.filter(e => e.platform === platform);
}
/**
 * Read all events from a JSONL file
 */
function readJsonlFile(filepath) {
    if (!existsSync(filepath))
        return [];
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.length > 0);
    const events = [];
    for (const line of lines) {
        try {
            events.push(JSON.parse(line));
        }
        catch {
            // Skip malformed lines
        }
    }
    return events;
}
/**
 * Get all event dates available
 */
export function getAvailableDates() {
    const eventsDir = join(getMoltbookPath(), 'events');
    if (!existsSync(eventsDir))
        return [];
    return readdirSync(eventsDir)
        .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
        .sort()
        .reverse();
}
/**
 * Read all events for a specific date
 */
export function readEventsByDate(date) {
    const eventsDir = join(getMoltbookPath(), 'events', date);
    if (!existsSync(eventsDir))
        return [];
    const files = readdirSync(eventsDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => join(eventsDir, f));
    const events = [];
    for (const file of files) {
        events.push(...readJsonlFile(file));
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
}
/**
 * Read events for date range
 */
export function readEventsByDateRange(startDate, endDate) {
    const dates = getAvailableDates().filter(d => d >= startDate && d <= endDate);
    const events = [];
    for (const date of dates) {
        events.push(...readEventsByDate(date));
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
}
/**
 * Find events by fingerprint
 */
export function findByFingerprint(fingerprint, daysBack = 7) {
    const events = [];
    const dates = getAvailableDates().slice(0, daysBack);
    for (const date of dates) {
        const dayEvents = readEventsByDate(date);
        events.push(...dayEvents.filter(e => e.fingerprint === fingerprint));
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
}
/**
 * Find events by trace ID
 */
export function findByTraceId(traceId, daysBack = 7) {
    const events = [];
    const dates = getAvailableDates().slice(0, daysBack);
    for (const date of dates) {
        const dayEvents = readEventsByDate(date);
        events.push(...dayEvents.filter(e => e.trace_id === traceId));
    }
    return events.sort((a, b) => a.ts.localeCompare(b.ts));
}
/**
 * Find events by platform
 */
export function findByPlatform(platform, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.platform === platform);
}
/**
 * Find events by status
 */
export function findByStatus(status, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.status === status);
}
/**
 * Find events by event type
 */
export function findByEventType(eventType, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.event_type === eventType);
}
/**
 * Find events by source agent
 */
export function findByAgent(agent, date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.source_agent === agent);
}
/**
 * Get latest N events
 */
export function getLatestEvents(limit = 50) {
    const events = [];
    const dates = getAvailableDates();
    for (const date of dates) {
        const dayEvents = readEventsByDate(date);
        events.push(...dayEvents);
        if (events.length >= limit)
            break;
    }
    return events
        .sort((a, b) => b.ts.localeCompare(a.ts))
        .slice(0, limit);
}
/**
 * Get failed events
 */
export function getFailedEvents(date) {
    return findByStatus('failed', date);
}
/**
 * Get blocked events
 */
export function getBlockedEvents(date) {
    return findByStatus('blocked', date);
}
/**
 * Get successful posts (with permalinks)
 */
export function getSuccessfulPosts(date) {
    const events = findByStatus('ok', date);
    return events.filter(e => e.event_type === 'PLATFORM_RESULT' &&
        e.data.success === true &&
        e.links &&
        e.links.length > 0);
}
/**
 * Get circuit breaker changes
 */
export function getCircuitBreakerChanges(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.event_type === 'CIRCUIT_BREAKER_OPENED' ||
        e.event_type === 'CIRCUIT_BREAKER_CLOSED');
}
/**
 * Get pipeline runs
 */
export function getPipelineRuns(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.event_type === 'PIPELINE_RUN_START' ||
        e.event_type === 'PIPELINE_RUN_END');
}
/**
 * Get artifacts created
 */
export function getArtifacts(date) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const events = readEventsByDate(targetDate);
    return events.filter(e => e.event_type === 'ARTIFACT_CREATED');
}
/**
 * Count events by field
 */
export function countBy(events, field) {
    const counts = {};
    for (const event of events) {
        const value = String(event[field] ?? 'unknown');
        counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
}
/**
 * Get top deny reasons
 */
export function getTopDenyReasons(events, limit = 10) {
    const blocked = events.filter(e => e.status === 'blocked' &&
        e.event_type === 'POLICY_DECISION');
    const reasonCounts = {};
    for (const event of blocked) {
        const reasons = event.data.reason_codes || [];
        for (const reason of reasons) {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        }
    }
    return Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
export function query(filters) {
    let events = [];
    // Determine date range
    if (filters.dateFrom && filters.dateTo) {
        events = readEventsByDateRange(filters.dateFrom, filters.dateTo);
    }
    else if (filters.date) {
        events = readEventsByDate(filters.date);
    }
    else {
        events = readEventsByDate(new Date().toISOString().split('T')[0]);
    }
    // Apply filters
    if (filters.platform) {
        events = events.filter(e => e.platform === filters.platform);
    }
    if (filters.status) {
        events = events.filter(e => e.status === filters.status);
    }
    if (filters.eventType) {
        events = events.filter(e => e.event_type === filters.eventType);
    }
    if (filters.agent) {
        events = events.filter(e => e.source_agent === filters.agent);
    }
    if (filters.fingerprint) {
        events = events.filter(e => e.fingerprint === filters.fingerprint);
    }
    if (filters.traceId) {
        events = events.filter(e => e.trace_id === filters.traceId);
    }
    // Apply limit
    if (filters.limit) {
        events = events.slice(0, filters.limit);
    }
    return events;
}
//# sourceMappingURL=reader.js.map