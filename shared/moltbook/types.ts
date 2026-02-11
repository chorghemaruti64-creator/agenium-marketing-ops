/**
 * Moltbook Event Types
 * Schema for the event ledger
 */

import { randomUUID } from 'crypto';

export type EventType =
  | 'POLICY_DECISION'
  | 'PLATFORM_ATTEMPT'
  | 'PLATFORM_RESULT'
  | 'RETRY_SCHEDULED'
  | 'CIRCUIT_BREAKER_OPENED'
  | 'CIRCUIT_BREAKER_CLOSED'
  | 'ARTIFACT_CREATED'
  | 'PIPELINE_RUN_START'
  | 'PIPELINE_RUN_END'
  | 'AGENT_ACTION'
  | 'ERROR';

export type SourceAgent =
  | 'orchestrator'
  | 'strategy'
  | 'content'
  | 'distribution'
  | 'community'
  | 'partnerships'
  | 'analytics'
  | 'proof'
  | string; // Allow dynamic agent names like 'distribution:telegram'

export type EventStatus = 'ok' | 'blocked' | 'failed' | 'retrying' | 'success' | 'started' | 'skipped' | 'partial' | 'allowed' | 'error';

export type Platform = 'github' | 'telegram' | 'x' | 'reddit' | 'hn' | 'discord' | 'internal';

export type ActionType = 'post' | 'reply' | 'comment' | 'dm' | 'submit' | 'issue' | 'discussion' | 'brief' | 'generate' | 'distribute' | 'monitor' | 'leads' | 'report' | 'proof' | 'pipeline';

export interface MoltEvent {
  event_id: string;           // UUID
  ts: string;                 // ISO timestamp
  source_agent: SourceAgent;
  event_type: EventType;
  platform?: Platform;
  action_type?: ActionType;
  fingerprint?: string;
  trace_id?: string;          // UUID for request tracing
  status: EventStatus;
  summary: string;            // Human-readable short description
  data: Record<string, any>;  // Sanitized JSON payload
  links?: string[];           // Permalinks if posted
}

export interface PolicyDecisionData {
  allow: boolean;
  reason_codes: string[];
  risk_score: number;
  redacted_text: string;
  enforced_limits?: {
    maxPerDay: number;
    maxPerHour: number;
    cooldownSeconds: number;
  };
}

export interface PlatformAttemptData {
  endpoint?: string;
  method?: string;
  payload_hash?: string;
  retry_count?: number;
}

export interface PlatformResultData {
  success: boolean;
  http_status?: number;
  response_id?: string;
  permalink?: string;
  error_message?: string;
  latency_ms?: number;
}

export interface RetryScheduledData {
  attempt: number;
  max_attempts: number;
  backoff_seconds: number;
  scheduled_at: string;
  reason: string;
}

export interface CircuitBreakerData {
  platform: Platform;
  failures: number;
  threshold: number;
  cooldown_until?: string;
  reason?: string;
}

export interface ArtifactData {
  path: string;
  sha256: string;
  kind: 'content_draft' | 'screenshot' | 'log' | 'outreach_list' | 'report' | 'other';
  size_bytes: number;
  metadata?: Record<string, any>;
}

export interface PipelineRunData {
  run_id: string;
  pipeline_name: string;
  triggered_by: 'schedule' | 'manual' | 'webhook';
  config?: Record<string, any>;
  // For END events:
  duration_ms?: number;
  events_count?: number;
  success_count?: number;
  failure_count?: number;
}

/**
 * Create a new MoltEvent with required fields
 */
export function createEvent(
  source_agent: SourceAgent,
  event_type: EventType,
  status: EventStatus,
  summary: string,
  data: Record<string, any>,
  options?: {
    platform?: Platform;
    action_type?: ActionType;
    fingerprint?: string;
    trace_id?: string;
    links?: string[];
  }
): MoltEvent {
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

/**
 * Summary statistics for a time period
 */
export interface PeriodSummary {
  period: string;             // YYYY-MM-DD or YYYY-WW
  period_type: 'daily' | 'weekly';
  total_events: number;
  by_status: Record<EventStatus, number>;
  by_platform: Record<string, number>;
  by_event_type: Record<string, number>;
  by_agent: Record<string, number>;
  top_deny_reasons: Array<{ reason: string; count: number }>;
  top_posts: Array<{ fingerprint: string; platform: string; summary: string; links?: string[] }>;
  failures: Array<{ ts: string; platform: string; error: string }>;
  circuit_breaker_changes: Array<{ ts: string; platform: string; action: 'opened' | 'closed' }>;
  artifacts_created: number;
  pipeline_runs: number;
}
