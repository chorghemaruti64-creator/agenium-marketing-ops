/**
 * Moltbook Reader
 * Query helpers for the event ledger
 */
import { MoltEvent, EventType, SourceAgent, EventStatus, Platform } from './types.js';
/**
 * Read events with custom moltbook directory
 * Used by agents that need to specify the path
 */
export declare function queryByDate(moltbookDir: string, date: string): MoltEvent[];
/**
 * Query events by platform with custom moltbook directory
 */
export declare function queryByPlatform(moltbookDir: string, platform: Platform, date?: string): MoltEvent[];
/**
 * Get all event dates available
 */
export declare function getAvailableDates(): string[];
/**
 * Read all events for a specific date
 */
export declare function readEventsByDate(date: string): MoltEvent[];
/**
 * Read events for date range
 */
export declare function readEventsByDateRange(startDate: string, endDate: string): MoltEvent[];
/**
 * Find events by fingerprint
 */
export declare function findByFingerprint(fingerprint: string, daysBack?: number): MoltEvent[];
/**
 * Find events by trace ID
 */
export declare function findByTraceId(traceId: string, daysBack?: number): MoltEvent[];
/**
 * Find events by platform
 */
export declare function findByPlatform(platform: Platform, date?: string): MoltEvent[];
/**
 * Find events by status
 */
export declare function findByStatus(status: EventStatus, date?: string): MoltEvent[];
/**
 * Find events by event type
 */
export declare function findByEventType(eventType: EventType, date?: string): MoltEvent[];
/**
 * Find events by source agent
 */
export declare function findByAgent(agent: SourceAgent, date?: string): MoltEvent[];
/**
 * Get latest N events
 */
export declare function getLatestEvents(limit?: number): MoltEvent[];
/**
 * Get failed events
 */
export declare function getFailedEvents(date?: string): MoltEvent[];
/**
 * Get blocked events
 */
export declare function getBlockedEvents(date?: string): MoltEvent[];
/**
 * Get successful posts (with permalinks)
 */
export declare function getSuccessfulPosts(date?: string): MoltEvent[];
/**
 * Get circuit breaker changes
 */
export declare function getCircuitBreakerChanges(date?: string): MoltEvent[];
/**
 * Get pipeline runs
 */
export declare function getPipelineRuns(date?: string): MoltEvent[];
/**
 * Get artifacts created
 */
export declare function getArtifacts(date?: string): MoltEvent[];
/**
 * Count events by field
 */
export declare function countBy<T extends keyof MoltEvent>(events: MoltEvent[], field: T): Record<string, number>;
/**
 * Get top deny reasons
 */
export declare function getTopDenyReasons(events: MoltEvent[], limit?: number): Array<{
    reason: string;
    count: number;
}>;
/**
 * Query events with filters
 */
export interface QueryFilters {
    date?: string;
    dateFrom?: string;
    dateTo?: string;
    platform?: Platform;
    status?: EventStatus;
    eventType?: EventType;
    agent?: SourceAgent;
    fingerprint?: string;
    traceId?: string;
    limit?: number;
}
export declare function query(filters: QueryFilters): MoltEvent[];
//# sourceMappingURL=reader.d.ts.map