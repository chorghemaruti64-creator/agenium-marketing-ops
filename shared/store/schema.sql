-- Marketing-Ops SQLite Schema
-- Stores action history, rate counters, and dedupe index

-- Actions log: every policy decision
CREATE TABLE IF NOT EXISTS actions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL DEFAULT (datetime('now')),
    platform TEXT NOT NULL,
    action_type TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    allow INTEGER NOT NULL,
    risk_score INTEGER NOT NULL,
    reason_codes_json TEXT NOT NULL,
    text_preview TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_actions_log_ts ON actions_log(ts);
CREATE INDEX IF NOT EXISTS idx_actions_log_platform ON actions_log(platform);
CREATE INDEX IF NOT EXISTS idx_actions_log_fingerprint ON actions_log(fingerprint);

-- Rate counters: daily counts per platform/action_type
CREATE TABLE IF NOT EXISTS rate_counters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    platform TEXT NOT NULL,
    action_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, platform, action_type)
);

CREATE INDEX IF NOT EXISTS idx_rate_counters_date ON rate_counters(date);

-- Dedupe index: prevent duplicate content
CREATE TABLE IF NOT EXISTS dedupe_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fingerprint TEXT NOT NULL UNIQUE,
    first_seen TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    platform TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_dedupe_fingerprint ON dedupe_index(fingerprint);
CREATE INDEX IF NOT EXISTS idx_dedupe_first_seen ON dedupe_index(first_seen);

-- Circuit breakers: platform-level failure tracking
CREATE TABLE IF NOT EXISTS circuit_breakers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'closed', -- closed, open, half-open
    failures INTEGER NOT NULL DEFAULT 0,
    last_failure TEXT,
    opened_at TEXT,
    cooldown_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_circuit_breakers_platform ON circuit_breakers(platform);
