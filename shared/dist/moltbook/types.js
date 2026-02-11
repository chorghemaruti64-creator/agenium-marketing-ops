/**
 * Moltbook Event Types
 * Schema for the event ledger
 */
import { randomUUID } from 'crypto';
/**
 * Create a new MoltEvent with required fields
 */
export function createEvent(source_agent, event_type, status, summary, data, options) {
    return {
        event_id: randomUUID(),
        ts: new Date().toISOString(),
        source_agent,
        event_type,
        status,
        summary,
        data,
        platform: options?.platform,
        action_type: options?.action_type,
        fingerprint: options?.fingerprint,
        trace_id: options?.trace_id ?? randomUUID(),
        links: options?.links,
    };
}
//# sourceMappingURL=types.js.map