/**
 * Moltbook Unit Tests
 * 
 * IMPORTANT: Set MOLTBOOK_PATH env before importing modules
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Set test path BEFORE importing modules
const TEST_MOLTBOOK_PATH = '/tmp/moltbook-test-' + randomUUID().substring(0, 8);
process.env.MOLTBOOK_PATH = TEST_MOLTBOOK_PATH;

// Now import modules
import {
  MoltEvent,
  createEvent,
} from '../types.js';
import {
  appendEvent,
  appendEventBatch,
  logPolicyDecisionLegacy as logPolicyDecision,
  logPlatformAttemptLegacy as logPlatformAttempt,
  logPlatformResultLegacy as logPlatformResult,
  logRetryScheduled,
  logCircuitBreaker,
  logArtifact,
  logPipelineStart,
  logPipelineEnd,
  getEventFiles,
  checkIntegrity,
} from '../ledger.js';
import {
  readEventsByDate,
  findByFingerprint,
  findByTraceId,
  findByPlatform,
  findByStatus,
  findByEventType,
  getLatestEvents,
  getTopDenyReasons,
  query,
} from '../reader.js';
import {
  generateSummary,
  formatSummaryAsMarkdown,
  generateDailySummary,
} from '../summarize.js';

// Setup/teardown
beforeAll(() => {
  mkdirSync(TEST_MOLTBOOK_PATH, { recursive: true });
});

afterAll(() => {
  rmSync(TEST_MOLTBOOK_PATH, { recursive: true, force: true });
});

describe('MoltEvent Types', () => {
  it('should create event with all required fields', () => {
    const event = createEvent(
      'orchestrator',
      'POLICY_DECISION',
      'ok',
      'Test event',
      { test: true }
    );
    
    expect(event.event_id).toBeDefined();
    expect(event.ts).toBeDefined();
    expect(event.source_agent).toBe('orchestrator');
    expect(event.event_type).toBe('POLICY_DECISION');
    expect(event.status).toBe('ok');
    expect(event.summary).toBe('Test event');
    expect(event.data.test).toBe(true);
  });
  
  it('should create event with optional fields', () => {
    const event = createEvent(
      'distribution',
      'PLATFORM_RESULT',
      'ok',
      'Posted successfully',
      { success: true },
      {
        platform: 'x',
        action_type: 'post',
        fingerprint: 'abc123',
        links: ['https://x.com/status/123'],
      }
    );
    
    expect(event.platform).toBe('x');
    expect(event.action_type).toBe('post');
    expect(event.fingerprint).toBe('abc123');
    expect(event.links).toContain('https://x.com/status/123');
  });
});

describe('Ledger Write Operations', () => {
  it('should append single event', () => {
    const event = createEvent('orchestrator', 'POLICY_DECISION', 'ok', 'Test', {});
    const filepath = appendEvent(event);
    
    expect(existsSync(filepath)).toBe(true);
    
    const content = readFileSync(filepath, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.event_id).toBe(event.event_id);
  });
  
  it('should append event batch', () => {
    const events = [
      createEvent('orchestrator', 'PIPELINE_RUN_START', 'ok', 'Start', {}),
      createEvent('content', 'ARTIFACT_CREATED', 'ok', 'Draft', {}),
      createEvent('orchestrator', 'PIPELINE_RUN_END', 'ok', 'End', {}),
    ];
    
    const filepath = appendEventBatch(events);
    expect(existsSync(filepath)).toBe(true);
    
    const content = readFileSync(filepath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(3);
  });
  
  it('should log policy decision', () => {
    const event = logPolicyDecision(
      'orchestrator',
      'x',
      'post',
      'fingerprint123',
      true,
      ['ALLOWED'],
      10,
      'Test post about Agenium'
    );
    
    expect(event.event_type).toBe('POLICY_DECISION');
    expect(event.status).toBe('ok');
    expect(event.data.allow).toBe(true);
  });
  
  it('should log blocked policy decision', () => {
    const event = logPolicyDecision(
      'orchestrator',
      'reddit',
      'post',
      'fingerprint456',
      false,
      ['BRAND_MISSING', 'QUIET_HOURS'],
      10,
      'Test post'
    );
    
    expect(event.status).toBe('blocked');
    expect(event.data.reason_codes).toContain('BRAND_MISSING');
  });
  
  it('should log platform attempt', () => {
    const event = logPlatformAttempt(
      'distribution',
      'telegram',
      'post',
      'fp123',
      'trace123',
      0
    );
    
    expect(event.event_type).toBe('PLATFORM_ATTEMPT');
    expect(event.trace_id).toBe('trace123');
  });
  
  it('should log platform result success', () => {
    const event = logPlatformResult(
      'distribution',
      'github',
      'discussion',
      'fp123',
      'trace123',
      true,
      {
        httpStatus: 201,
        permalink: 'https://github.com/org/repo/discussions/1',
        latencyMs: 250,
      }
    );
    
    expect(event.event_type).toBe('PLATFORM_RESULT');
    expect(event.status).toBe('ok');
    expect(event.links).toContain('https://github.com/org/repo/discussions/1');
  });
  
  it('should log platform result failure', () => {
    const event = logPlatformResult(
      'distribution',
      'x',
      'post',
      'fp123',
      'trace123',
      false,
      {
        httpStatus: 429,
        errorMessage: 'Rate limited',
      }
    );
    
    expect(event.status).toBe('failed');
    expect(event.data.error_message).toBe('Rate limited');
  });
  
  it('should log retry scheduled', () => {
    const event = logRetryScheduled(
      'distribution',
      'reddit',
      'post',
      'fp123',
      'trace123',
      2,
      5,
      60,
      'Rate limited'
    );
    
    expect(event.event_type).toBe('RETRY_SCHEDULED');
    expect(event.status).toBe('retrying');
    expect(event.data.attempt).toBe(2);
    expect(event.data.backoff_seconds).toBe(60);
  });
  
  it('should log circuit breaker opened', () => {
    const event = logCircuitBreaker(
      'distribution',
      'hn',
      'opened',
      5,
      5,
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      'Too many failures'
    );
    
    expect(event.event_type).toBe('CIRCUIT_BREAKER_OPENED');
    expect(event.status).toBe('blocked');
  });
  
  it('should log circuit breaker closed', () => {
    const event = logCircuitBreaker(
      'distribution',
      'hn',
      'closed',
      0,
      5
    );
    
    expect(event.event_type).toBe('CIRCUIT_BREAKER_CLOSED');
    expect(event.status).toBe('ok');
  });
  
  it('should log artifact', () => {
    const event = logArtifact(
      'content',
      '/opt/marketing-ops/artifacts/draft-123.md',
      'abc123def456',
      'content_draft',
      1024,
      { campaign: 'launch' }
    );
    
    expect(event.event_type).toBe('ARTIFACT_CREATED');
    expect(event.data.kind).toBe('content_draft');
    
    // Check manifest was created
    const today = new Date().toISOString().split('T')[0];
    const manifestPath = join(TEST_MOLTBOOK_PATH, 'artifacts', today, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
  });
  
  it('should log pipeline start and end', () => {
    const runId = randomUUID();
    
    const startEvent = logPipelineStart(
      'orchestrator',
      runId,
      'daily-content',
      'schedule'
    );
    
    expect(startEvent.event_type).toBe('PIPELINE_RUN_START');
    expect(startEvent.trace_id).toBe(runId);
    
    const endEvent = logPipelineEnd(
      'orchestrator',
      runId,
      'daily-content',
      true,
      5000,
      10,
      8,
      2
    );
    
    expect(endEvent.event_type).toBe('PIPELINE_RUN_END');
    expect(endEvent.data.duration_ms).toBe(5000);
  });
});

describe('Ledger Read Operations', () => {
  beforeEach(() => {
    // Create test events
    logPolicyDecision('orchestrator', 'x', 'post', 'fpread1', true, ['ALLOWED'], 10, 'Post 1');
    logPolicyDecision('orchestrator', 'reddit', 'post', 'fpread2', false, ['BRAND_MISSING'], 10, 'Post 2');
    logPlatformResult('distribution', 'x', 'post', 'fpread1', 'traceread1', true, { permalink: 'https://x.com/1' });
    logPlatformResult('distribution', 'telegram', 'post', 'fpread3', 'traceread2', false, { errorMessage: 'Error' });
    logCircuitBreaker('distribution', 'hn', 'opened', 5, 5);
  });
  
  it('should read events by date', () => {
    const today = new Date().toISOString().split('T')[0];
    const events = readEventsByDate(today);
    
    expect(events.length).toBeGreaterThan(0);
  });
  
  it('should find by fingerprint', () => {
    const events = findByFingerprint('fpread1');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(e => e.fingerprint === 'fpread1')).toBe(true);
  });
  
  it('should find by trace ID', () => {
    const events = findByTraceId('traceread1');
    expect(events.length).toBeGreaterThan(0);
  });
  
  it('should find by platform', () => {
    const events = findByPlatform('x');
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(e => e.platform === 'x')).toBe(true);
  });
  
  it('should find by status', () => {
    const blocked = findByStatus('blocked');
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.every(e => e.status === 'blocked')).toBe(true);
  });
  
  it('should find by event type', () => {
    const today = new Date().toISOString().split('T')[0];
    const events = readEventsByDate(today);
    const cbEvents = events.filter(e => e.event_type === 'CIRCUIT_BREAKER_OPENED');
    expect(cbEvents.length).toBeGreaterThanOrEqual(1);
  });
  
  it('should get latest events', () => {
    const events = getLatestEvents(3);
    expect(events.length).toBeLessThanOrEqual(3);
  });
  
  it('should get top deny reasons', () => {
    const today = new Date().toISOString().split('T')[0];
    const events = readEventsByDate(today);
    const reasons = getTopDenyReasons(events);
    
    expect(reasons.some(r => r.reason === 'BRAND_MISSING')).toBe(true);
  });
  
  it('should query with filters', () => {
    const today = new Date().toISOString().split('T')[0];
    
    const results = query({
      date: today,
      status: 'ok',
      eventType: 'POLICY_DECISION',
    });
    
    expect(results.every(e => e.status === 'ok')).toBe(true);
    expect(results.every(e => e.event_type === 'POLICY_DECISION')).toBe(true);
  });
});

describe('Summary Generation', () => {
  beforeEach(() => {
    // Create test events
    logPolicyDecision('orchestrator', 'x', 'post', 'fpsum1', true, ['ALLOWED'], 10, 'Post 1');
    logPolicyDecision('orchestrator', 'reddit', 'post', 'fpsum2', false, ['BRAND_MISSING'], 10, 'Post 2');
    logPolicyDecision('orchestrator', 'x', 'post', 'fpsum3', false, ['QUIET_HOURS'], 10, 'Post 3');
    logPlatformResult('distribution', 'x', 'post', 'fpsum1', 'tracesum1', true, { permalink: 'https://x.com/1' });
    logArtifact('content', '/tmp/draft.md', 'hash123', 'content_draft', 512);
    logPipelineEnd('orchestrator', 'run1', 'daily', true, 5000, 5, 4, 1);
  });
  
  it('should generate summary from events', () => {
    const today = new Date().toISOString().split('T')[0];
    const events = readEventsByDate(today);
    const summary = generateSummary(events, today, 'daily');
    
    expect(summary.total_events).toBeGreaterThan(0);
    expect(summary.by_status.ok).toBeGreaterThan(0);
    expect(summary.by_status.blocked).toBeGreaterThan(0);
  });
  
  it('should format summary as markdown', () => {
    const today = new Date().toISOString().split('T')[0];
    const events = readEventsByDate(today);
    const summary = generateSummary(events, today, 'daily');
    const markdown = formatSummaryAsMarkdown(summary);
    
    expect(markdown).toContain('# Moltbook Daily Summary');
    expect(markdown).toContain('## Overview');
    expect(markdown).toContain('## By Status');
  });
  
  it('should generate and write daily summary', () => {
    const today = new Date().toISOString().split('T')[0];
    const summary = generateDailySummary(today);
    
    expect(summary.period).toBe(today);
    expect(summary.period_type).toBe('daily');
    
    const mdPath = join(TEST_MOLTBOOK_PATH, 'daily', `${today}.md`);
    const jsonPath = join(TEST_MOLTBOOK_PATH, 'daily', `${today}.json`);
    
    expect(existsSync(mdPath)).toBe(true);
    expect(existsSync(jsonPath)).toBe(true);
  });
});

describe('Integrity Checks', () => {
  it('should detect valid files', () => {
    logPolicyDecision('orchestrator', 'x', 'post', 'fpint1', true, ['ALLOWED'], 10, 'Test');
    
    const today = new Date().toISOString().split('T')[0];
    const { valid, partial } = checkIntegrity(today);
    
    expect(valid.length).toBeGreaterThanOrEqual(1);
  });
  
  it('should list event files', () => {
    logPolicyDecision('orchestrator', 'x', 'post', 'fpint2', true, ['ALLOWED'], 10, 'Test 1');
    logPlatformResult('distribution', 'x', 'post', 'fpint2', 'traceint1', true);
    
    const today = new Date().toISOString().split('T')[0];
    const files = getEventFiles(today);
    
    expect(files.length).toBeGreaterThanOrEqual(2);
  });
});
