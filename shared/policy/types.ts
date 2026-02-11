/**
 * Policy Engine Types
 * Core types for the autonomous marketing policy system
 */

export type Platform = 'github' | 'telegram' | 'x' | 'reddit' | 'hn' | 'discord';

export type ActionType = 
  | 'post' 
  | 'reply' 
  | 'comment' 
  | 'dm' 
  | 'submit' 
  | 'issue' 
  | 'discussion';

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

export type ReasonCode =
  | 'ALLOWED'
  | 'HATE_HARASSMENT'
  | 'SEXUAL_CONTENT'
  | 'DOXXING'
  | 'ILLEGAL_INSTRUCTIONS'
  | 'POLITICAL_TARGETING'
  | 'SECRET_LEAKED'
  | 'NO_EVIDENCE_FOR_CLAIM'
  | 'BRAND_MISSING'
  | 'QUIET_HOURS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'DUPLICATE_CONTENT'
  | 'RISK_TOO_HIGH'
  | 'STOP_ALL'
  | 'PUBLISH_DISABLED'
  | 'LOW_QUALITY_SPAM';

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
    start: number; // hour in 24h format
    end: number;
    timezone: string;
  };
  riskThreshold: number;
  dedupeDays: number;
  killSwitchPath: string;
}

export const DEFAULT_RATE_LIMITS: Record<Platform, RateLimitConfig> = {
  x: { postsPerDay: 3, repliesPerDay: 10, commentsPerDay: 10 },
  reddit: { postsPerDay: 2, repliesPerDay: 10, commentsPerDay: 10 },
  hn: { submissionsPerDay: 1, commentsPerDay: 5, postsPerDay: 1, repliesPerDay: 5 },
  telegram: { postsPerDay: 3, repliesPerDay: 20, commentsPerDay: 20 },
  github: { discussionsPerDay: 2, commentsPerDay: 5, issuesPerDay: 2, postsPerDay: 2, repliesPerDay: 5 },
  discord: { messagesPerDay: 20, postsPerDay: 20, repliesPerDay: 20, commentsPerDay: 20 },
};

export const DEFAULT_CONFIG: PolicyConfig = {
  rateLimits: DEFAULT_RATE_LIMITS,
  quietHours: {
    start: 1,  // 01:00
    end: 7,    // 07:00
    timezone: 'Europe/Berlin',
  },
  riskThreshold: 70,
  dedupeDays: 7,
  killSwitchPath: '/opt/marketing-ops/config/STOP_ALL',
};
