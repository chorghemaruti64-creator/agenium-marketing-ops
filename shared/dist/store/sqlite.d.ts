/**
 * SQLite Store Module
 * Local storage for action history, rate counters, and dedupe
 * Uses sql.js for pure JavaScript SQLite (no native deps)
 */
import { Platform, ActionType, PolicyDecision } from '../policy/types.js';
export interface ActionLogEntry {
    id: number;
    ts: string;
    platform: Platform;
    action_type: ActionType;
    fingerprint: string;
    allow: boolean;
    risk_score: number;
    reason_codes: string[];
    text_preview?: string;
}
export interface RateCount {
    platform: Platform;
    action_type: ActionType;
    count: number;
}
export interface DedupeEntry {
    fingerprint: string;
    first_seen: string;
    last_seen: string;
    platform: Platform;
    count: number;
}
export declare class PolicyStore {
    private db;
    private dbPath;
    private initialized;
    constructor(dbPath?: string);
    /**
     * Initialize database (async for sql.js)
     */
    init(): Promise<void>;
    /**
     * Save database to disk
     */
    save(): void;
    /**
     * Log a policy decision
     */
    logAction(platform: Platform, actionType: ActionType, fingerprint: string, decision: PolicyDecision, textPreview?: string): void;
    /**
     * Get today's action count for rate limiting
     */
    getTodayCount(platform: Platform, actionType: ActionType): number;
    /**
     * Increment rate counter
     */
    incrementCounter(platform: Platform, actionType: ActionType): void;
    /**
     * Check if fingerprint exists in dedupe index within N days
     */
    isDuplicate(fingerprint: string, days?: number): boolean;
    /**
     * Add fingerprint to dedupe index
     */
    addFingerprint(fingerprint: string, platform: Platform): void;
    /**
     * Get recent actions for a platform
     */
    getRecentActions(platform: Platform, limit?: number): ActionLogEntry[];
    /**
     * Clean up old entries (called periodically)
     */
    cleanup(retentionDays?: number): void;
    /**
     * Close database connection
     */
    close(): void;
}
export interface MockStore {
    counters: Map<string, number>;
    fingerprints: Map<string, Date>;
    actions: any[];
}
export declare function createMockStore(): MockStore;
export declare function getMockStore(): MockStore | null;
export declare function clearMockStore(): void;
/**
 * Create an in-memory store interface for testing (no SQLite)
 */
export declare function createInMemoryStore(): {
    getTodayCount: (platform: Platform, actionType: ActionType) => number;
    isDuplicate: (fingerprint: string, _days?: number) => boolean;
    incrementCounter: (platform: Platform, actionType: ActionType) => void;
    addFingerprint: (fingerprint: string, _platform: Platform) => void;
    logAction: (platform: Platform, actionType: ActionType, fingerprint: string, decision: PolicyDecision, textPreview?: string) => void;
    _counters: Map<string, number>;
    _fingerprints: Map<string, Date>;
    _actions: any[];
};
//# sourceMappingURL=sqlite.d.ts.map