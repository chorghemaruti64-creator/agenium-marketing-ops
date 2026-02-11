/**
 * SQLite Store Module
 * Local storage for action history, rate counters, and dedupe
 * Uses sql.js for pure JavaScript SQLite (no native deps)
 */
import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export class PolicyStore {
    db = null;
    dbPath;
    initialized = false;
    constructor(dbPath = '/opt/marketing-ops/shared/store/marketing.db') {
        this.dbPath = dbPath;
    }
    /**
     * Initialize database (async for sql.js)
     */
    async init() {
        if (this.initialized)
            return;
        const SQL = await initSqlJs();
        // Load existing database or create new
        if (existsSync(this.dbPath)) {
            const buffer = readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        }
        else {
            // Ensure directory exists
            const dir = dirname(this.dbPath);
            if (!existsSync(dir)) {
                mkdirSync(dir, { recursive: true });
            }
            this.db = new SQL.Database();
        }
        // Run schema
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.run(schema);
        this.initialized = true;
    }
    /**
     * Save database to disk
     */
    save() {
        if (!this.db)
            return;
        const data = this.db.export();
        const buffer = Buffer.from(data);
        writeFileSync(this.dbPath, buffer);
    }
    /**
     * Log a policy decision
     */
    logAction(platform, actionType, fingerprint, decision, textPreview) {
        if (!this.db)
            return;
        this.db.run(`
      INSERT INTO actions_log (platform, action_type, fingerprint, allow, risk_score, reason_codes_json, text_preview)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
            platform,
            actionType,
            fingerprint,
            decision.allow ? 1 : 0,
            decision.risk_score,
            JSON.stringify(decision.reason_codes),
            textPreview?.substring(0, 200) ?? null,
        ]);
    }
    /**
     * Get today's action count for rate limiting
     */
    getTodayCount(platform, actionType) {
        if (!this.db)
            return 0;
        const today = new Date().toISOString().split('T')[0];
        const result = this.db.exec(`
      SELECT count FROM rate_counters
      WHERE date = ? AND platform = ? AND action_type = ?
    `, [today, platform, actionType]);
        if (result.length > 0 && result[0].values.length > 0) {
            return result[0].values[0][0];
        }
        return 0;
    }
    /**
     * Increment rate counter
     */
    incrementCounter(platform, actionType) {
        if (!this.db)
            return;
        const today = new Date().toISOString().split('T')[0];
        // Try to update existing
        this.db.run(`
      INSERT INTO rate_counters (date, platform, action_type, count)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(date, platform, action_type) DO UPDATE SET count = count + 1
    `, [today, platform, actionType]);
    }
    /**
     * Check if fingerprint exists in dedupe index within N days
     */
    isDuplicate(fingerprint, days = 7) {
        if (!this.db)
            return false;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const result = this.db.exec(`
      SELECT 1 FROM dedupe_index
      WHERE fingerprint = ? AND first_seen > ?
      LIMIT 1
    `, [fingerprint, cutoff.toISOString()]);
        return result.length > 0 && result[0].values.length > 0;
    }
    /**
     * Add fingerprint to dedupe index
     */
    addFingerprint(fingerprint, platform) {
        if (!this.db)
            return;
        this.db.run(`
      INSERT INTO dedupe_index (fingerprint, platform)
      VALUES (?, ?)
      ON CONFLICT(fingerprint) DO UPDATE SET 
        last_seen = datetime('now'),
        count = count + 1
    `, [fingerprint, platform]);
    }
    /**
     * Get recent actions for a platform
     */
    getRecentActions(platform, limit = 10) {
        if (!this.db)
            return [];
        const result = this.db.exec(`
      SELECT id, ts, platform, action_type, fingerprint, allow, risk_score, reason_codes_json, text_preview
      FROM actions_log
      WHERE platform = ?
      ORDER BY ts DESC
      LIMIT ?
    `, [platform, limit]);
        if (result.length === 0)
            return [];
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
                obj[col] = row[i];
            });
            return {
                ...obj,
                allow: obj.allow === 1,
                reason_codes: JSON.parse(obj.reason_codes_json || '[]'),
            };
        });
    }
    /**
     * Clean up old entries (called periodically)
     */
    cleanup(retentionDays = 30) {
        if (!this.db)
            return;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);
        const cutoffStr = cutoff.toISOString();
        this.db.run('DELETE FROM actions_log WHERE ts < ?', [cutoffStr]);
        this.db.run('DELETE FROM dedupe_index WHERE first_seen < ?', [cutoffStr]);
        this.db.run('DELETE FROM rate_counters WHERE date < ?', [cutoff.toISOString().split('T')[0]]);
    }
    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }
}
let mockStore = null;
export function createMockStore() {
    mockStore = {
        counters: new Map(),
        fingerprints: new Map(),
        actions: [],
    };
    return mockStore;
}
export function getMockStore() {
    return mockStore;
}
export function clearMockStore() {
    mockStore = null;
}
/**
 * Create an in-memory store interface for testing (no SQLite)
 */
export function createInMemoryStore() {
    const counters = new Map();
    const fingerprints = new Map();
    const actions = [];
    return {
        getTodayCount: (platform, actionType) => {
            return counters.get(`${platform}:${actionType}`) ?? 0;
        },
        isDuplicate: (fingerprint, _days = 7) => {
            return fingerprints.has(fingerprint);
        },
        incrementCounter: (platform, actionType) => {
            const key = `${platform}:${actionType}`;
            counters.set(key, (counters.get(key) ?? 0) + 1);
        },
        addFingerprint: (fingerprint, _platform) => {
            fingerprints.set(fingerprint, new Date());
        },
        logAction: (platform, actionType, fingerprint, decision, textPreview) => {
            actions.push({ platform, actionType, fingerprint, decision, textPreview });
        },
        // Expose internals for testing
        _counters: counters,
        _fingerprints: fingerprints,
        _actions: actions,
    };
}
//# sourceMappingURL=sqlite.js.map