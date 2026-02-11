/**
 * Moltbook Audit Module
 * Writes JSON events and daily markdown summaries
 */

import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { PlatformAction, PolicyDecision } from '../policy/types.js';

export interface AuditEvent {
  timestamp: string;
  fingerprint: string;
  platform: string;
  action_type: string;
  decision: 'allow' | 'deny';
  risk_score: number;
  reason_codes: string[];
  text_preview: string;
  links: string[];
  metadata: Record<string, any>;
  evidence_count: number;
}

const MOLTBOOK_PATH = process.env.MOLTBOOK_PATH || '/opt/marketing-ops/moltbook';

/**
 * Ensure directory exists
 */
function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current timestamp in ISO format
 */
function getNow(): string {
  return new Date().toISOString();
}

/**
 * Create audit event from action and decision
 */
export function createAuditEvent(
  action: PlatformAction,
  decision: PolicyDecision
): AuditEvent {
  return {
    timestamp: getNow(),
    fingerprint: decision.action_fingerprint,
    platform: action.platform,
    action_type: action.action_type,
    decision: decision.allow ? 'allow' : 'deny',
    risk_score: decision.risk_score,
    reason_codes: decision.reason_codes,
    text_preview: decision.redacted_text.substring(0, 200),
    links: action.links,
    metadata: action.metadata,
    evidence_count: action.evidence?.length ?? 0,
  };
}

/**
 * Write JSON event to moltbook/events/YYYY-MM-DD/<fingerprint>.json
 */
export function writeEvent(event: AuditEvent): string {
  const today = getToday();
  const eventsDir = join(MOLTBOOK_PATH, 'events', today);
  ensureDir(eventsDir);
  
  const filename = `${event.fingerprint.substring(0, 16)}_${Date.now()}.json`;
  const filepath = join(eventsDir, filename);
  
  writeFileSync(filepath, JSON.stringify(event, null, 2));
  
  return filepath;
}

/**
 * Append one-line entry to daily markdown
 */
export function appendDailySummary(event: AuditEvent): void {
  const today = getToday();
  const dailyDir = join(MOLTBOOK_PATH, 'daily');
  ensureDir(dailyDir);
  
  const filepath = join(dailyDir, `${today}.md`);
  
  // Create header if file doesn't exist
  if (!existsSync(filepath)) {
    const header = `# Moltbook Daily Log: ${today}\n\n| Time | Platform | Action | Decision | Risk | Reason |\n|------|----------|--------|----------|------|--------|\n`;
    writeFileSync(filepath, header);
  }
  
  // Format time as HH:MM:SS
  const time = event.timestamp.split('T')[1].split('.')[0];
  
  // Append entry
  const emoji = event.decision === 'allow' ? '✅' : '❌';
  const reasons = event.reason_codes.join(', ') || '-';
  const line = `| ${time} | ${event.platform} | ${event.action_type} | ${emoji} ${event.decision} | ${event.risk_score} | ${reasons} |\n`;
  
  appendFileSync(filepath, line);
}

/**
 * Write full audit trail for an action
 * Called by policy engine on every decision
 */
export function audit(action: PlatformAction, decision: PolicyDecision): AuditEvent {
  const event = createAuditEvent(action, decision);
  
  try {
    writeEvent(event);
    appendDailySummary(event);
  } catch (error) {
    // Log error but don't fail - audit is best-effort
    console.error('[Moltbook] Audit write failed:', error);
  }
  
  return event;
}

/**
 * Create a mock audit function for testing (doesn't write to disk)
 */
export function createMockAudit(): {
  audit: typeof audit;
  events: AuditEvent[];
} {
  const events: AuditEvent[] = [];
  
  return {
    audit: (action: PlatformAction, decision: PolicyDecision): AuditEvent => {
      const event = createAuditEvent(action, decision);
      events.push(event);
      return event;
    },
    events,
  };
}
