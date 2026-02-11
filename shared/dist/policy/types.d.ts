/**
 * Policy Engine Types
 * Core types for the autonomous marketing policy system
 */
export type Platform = 'github' | 'telegram' | 'x' | 'reddit' | 'hn' | 'discord';
export type ActionType = 'post' | 'reply' | 'comment' | 'dm' | 'submit' | 'issue' | 'discussion';
export interface Evidence {
    type: 'metric' | 'log' | 'screenshot' | 'link';
    source: string;
    value: string;
    timestamp: string;
}
export interface ContentMetadata {
    campaign?: string;
    language?: string;
    tags?: string[];
    targetThread?: string;
    account?: string;
}
export interface PlatformAction {
    platform: Platform;
    action_type: ActionType;
    text: string;
    links: string[];
    metadata: ContentMetadata;
    time: Date;
    evidence?: Evidence[];
}
export interface EnforcedLimits {
    maxPerDay: number;
    maxPerHour: number;
    cooldownSeconds: number;
}
export type ReasonCode = 'ALLOWED' | 'HATE_HARASSMENT' | 'SEXUAL_CONTENT' | 'DOXXING' | 'ILLEGAL_INSTRUCTIONS' | 'POLITICAL_TARGETING' | 'SECRET_LEAKED' | 'NO_EVIDENCE_FOR_CLAIM' | 'BRAND_MISSING' | 'QUIET_HOURS' | 'RATE_LIMIT_EXCEEDED' | 'DUPLICATE_CONTENT' | 'RISK_TOO_HIGH' | 'STOP_ALL' | 'PUBLISH_DISABLED' | 'LOW_QUALITY_SPAM';
export interface PolicyDecision {
    allow: boolean;
    reason_codes: ReasonCode[];
    risk_score: number;
    enforced_limits: EnforcedLimits;
    redacted_text: string;
    action_fingerprint: string;
    next_allowed_at: Date | null;
    required_backoff?: number;
}
export interface RateLimitConfig {
    postsPerDay: number;
    repliesPerDay: number;
    commentsPerDay: number;
    discussionsPerDay?: number;
    issuesPerDay?: number;
    submissionsPerDay?: number;
    dmsPerDay?: number;
    messagesPerDay?: number;
}
export interface PolicyConfig {
    rateLimits: Record<Platform, RateLimitConfig>;
    quietHours: {
        start: number;
        end: number;
        timezone: string;
    };
    riskThreshold: number;
    dedupeDays: number;
    killSwitchPath: string;
}
export declare const DEFAULT_RATE_LIMITS: Record<Platform, RateLimitConfig>;
export declare const DEFAULT_CONFIG: PolicyConfig;
//# sourceMappingURL=types.d.ts.map