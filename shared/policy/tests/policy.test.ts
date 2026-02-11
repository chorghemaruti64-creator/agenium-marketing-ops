/**
 * Policy Engine Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { evaluate, generateFingerprint } from '../policy.js';
import { PlatformAction, DEFAULT_CONFIG, PolicyConfig } from '../types.js';
import { redactSecrets, containsSecrets } from '../redact.js';
import {
  checkHateHarassment,
  checkSexualContent,
  checkDoxxing,
  checkIllegalInstructions,
  hasBrandMention,
  hasNumericClaims,
} from '../rules.js';
import { calculateRiskScore, isRiskTooHigh } from '../risk.js';
import { createInMemoryStore } from '../../store/sqlite.js';

// Helper to create test action
function createAction(overrides: Partial<PlatformAction> = {}): PlatformAction {
  return {
    platform: 'x',
    action_type: 'post',
    text: 'Test post about Agenium and the agent:// protocol.',
    links: [],
    metadata: {},
    time: new Date('2024-02-15T12:00:00+01:00'),
    ...overrides,
  };
}

// Use the shared in-memory store
const createMockStore = createInMemoryStore;

describe('Redaction Module', () => {
  it('should detect GitHub tokens', () => {
    expect(containsSecrets('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe(true);
  });
  
  it('should detect internal IPs', () => {
    expect(containsSecrets('Connect to 192.168.1.100')).toBe(true);
    expect(containsSecrets('Server at 10.0.0.1')).toBe(true);
  });
  
  it('should redact secrets', () => {
    const result = redactSecrets('Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    expect(result.hasSecrets).toBe(true);
    expect(result.redacted).not.toContain('ghp_');
  });
  
  it('should not flag clean text', () => {
    expect(containsSecrets('Hello world, check out Agenium!')).toBe(false);
  });
});

describe('Safety Rules', () => {
  it('should detect hate speech', () => {
    expect(checkHateHarassment('Death to all enemies')).toBe(false); // generic
    expect(checkHateHarassment('kill all jews')).toBe(true);
  });
  
  it('should detect doxxing', () => {
    expect(checkDoxxing('home address: 123 Main St')).toBe(true);
    expect(checkDoxxing('SSN: 123-45-6789')).toBe(true);
  });
  
  it('should detect illegal instructions', () => {
    expect(checkIllegalInstructions('how to make a bomb')).toBe(true);
    expect(checkIllegalInstructions('how to make a cake')).toBe(false);
  });
});

describe('Brand Rules', () => {
  it('should detect brand mentions', () => {
    expect(hasBrandMention('Check out Agenium!')).toBe(true);
    expect(hasBrandMention('Using the agent:// protocol')).toBe(true);
    expect(hasBrandMention('Check out the DNS registry')).toBe(true);
    expect(hasBrandMention('Visit the Marketplace')).toBe(true);
  });
  
  it('should reject missing brand', () => {
    expect(hasBrandMention('Cool new protocol!')).toBe(false);
  });
});

describe('Numeric Claims', () => {
  it('should detect performance claims', () => {
    expect(hasNumericClaims('10,000 req/s')).toBe(true);
    expect(hasNumericClaims('p95 latency of 5ms')).toBe(true);
    expect(hasNumericClaims('99.9% uptime')).toBe(true);
    expect(hasNumericClaims('coverage: 85%')).toBe(true);
  });
  
  it('should not flag regular numbers', () => {
    expect(hasNumericClaims('Version 2.0 released')).toBe(false);
  });
});

describe('Risk Scoring', () => {
  it('should calculate base risk', () => {
    const action = createAction();
    const risk = calculateRiskScore(action);
    expect(risk.base).toBeGreaterThanOrEqual(10);
  });
  
  it('should add risk for many external links', () => {
    const action = createAction({
      links: ['https://a.com', 'https://b.com', 'https://c.com', 'https://d.com', 'https://e.com'],
    });
    const risk = calculateRiskScore(action);
    expect(risk.externalLinks).toBe(20);
  });
  
  it('should add risk for short content', () => {
    const action = createAction({
      text: 'Short', // less than 50 chars
      action_type: 'post',
    });
    const risk = calculateRiskScore(action);
    expect(risk.lowQuality).toBe(20);
  });
  
  it('should identify high risk', () => {
    expect(isRiskTooHigh(70)).toBe(true);
    expect(isRiskTooHigh(69)).toBe(false);
  });
});

describe('Fingerprint Generation', () => {
  it('should generate consistent fingerprints', () => {
    const fp1 = generateFingerprint('x', 'post', 'Hello world', ['https://a.com']);
    const fp2 = generateFingerprint('x', 'post', 'Hello world', ['https://a.com']);
    expect(fp1).toBe(fp2);
  });
  
  it('should generate different fingerprints for different content', () => {
    const fp1 = generateFingerprint('x', 'post', 'Hello world', []);
    const fp2 = generateFingerprint('x', 'post', 'Goodbye world', []);
    expect(fp1).not.toBe(fp2);
  });
  
  it('should normalize whitespace', () => {
    const fp1 = generateFingerprint('x', 'post', 'Hello   world', []);
    const fp2 = generateFingerprint('x', 'post', 'Hello world', []);
    expect(fp1).toBe(fp2);
  });
});

describe('Policy Evaluation', () => {
  let store: ReturnType<typeof createInMemoryStore>;
  
  beforeEach(() => {
    store = createInMemoryStore();
  });
  
  it('should allow valid content', () => {
    const action = createAction();
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(true);
    expect(decision.reason_codes).toContain('ALLOWED');
  });
  
  it('should deny content with secrets', () => {
    const action = createAction({
      text: 'Check out Agenium! Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(false);
    expect(decision.reason_codes).toContain('SECRET_LEAKED');
  });
  
  it('should deny posts without brand mention', () => {
    const action = createAction({
      text: 'Check out this cool protocol!',
      action_type: 'post',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(false);
    expect(decision.reason_codes).toContain('BRAND_MISSING');
  });
  
  it('should allow replies without brand mention', () => {
    const action = createAction({
      text: 'Thanks for the feedback!',
      action_type: 'reply',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(true);
  });
  
  it('should deny during quiet hours for posts', () => {
    const action = createAction({
      time: new Date('2024-02-15T03:00:00+01:00'), // 3am Berlin
      action_type: 'post',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(false);
    expect(decision.reason_codes).toContain('QUIET_HOURS');
  });
  
  it('should allow during quiet hours for replies', () => {
    const action = createAction({
      time: new Date('2024-02-15T03:00:00+01:00'), // 3am Berlin
      action_type: 'reply',
      text: 'Thanks for reaching out!',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(true);
  });
  
  it('should deny claims without evidence', () => {
    const action = createAction({
      text: 'Agenium achieves 10,000 req/s!',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(false);
    expect(decision.reason_codes).toContain('NO_EVIDENCE_FOR_CLAIM');
  });
  
  it('should allow claims with evidence', () => {
    const action = createAction({
      text: 'Agenium achieves 10,000 req/s! See benchmarks.',
      evidence: [{ type: 'log', source: 'bench.log', value: '10000', timestamp: '2024-01-01' }],
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.allow).toBe(true);
  });
  
  it('should enforce rate limits', () => {
    // First 3 should pass (different content each time to avoid dedupe)
    for (let i = 0; i < 3; i++) {
      const action = createAction({ 
        platform: 'x', 
        action_type: 'post',
        text: `Agenium update number ${i + 1} - check out agent:// protocol!`
      });
      const decision = evaluate(action, DEFAULT_CONFIG, store);
      expect(decision.allow).toBe(true);
    }
    
    // 4th should fail
    const action = createAction({ 
      platform: 'x', 
      action_type: 'post',
      text: 'Agenium update number 4 - check out agent:// protocol!'
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    expect(decision.allow).toBe(false);
    expect(decision.reason_codes).toContain('RATE_LIMIT_EXCEEDED');
  });
  
  it('should detect duplicates', () => {
    const action = createAction();
    
    // First should pass
    const decision1 = evaluate(action, DEFAULT_CONFIG, store);
    expect(decision1.allow).toBe(true);
    
    // Same content should fail as duplicate
    const decision2 = evaluate(action, DEFAULT_CONFIG, store);
    expect(decision2.allow).toBe(false);
    expect(decision2.reason_codes).toContain('DUPLICATE_CONTENT');
  });
  
  it('should always produce redacted text', () => {
    const action = createAction({
      text: 'Secret: ghp_abcdefghijklmnopqrstuvwxyz1234567890 in Agenium',
    });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.redacted_text).not.toContain('ghp_');
    // Should contain redacted marker
    expect(decision.redacted_text.includes('[') && decision.redacted_text.includes(']')).toBe(true);
  });
  
  it('should calculate enforced limits', () => {
    const action = createAction({ platform: 'x', action_type: 'post' });
    const decision = evaluate(action, DEFAULT_CONFIG, store);
    
    expect(decision.enforced_limits.maxPerDay).toBe(3);
    expect(decision.enforced_limits.maxPerHour).toBeGreaterThan(0);
    expect(decision.enforced_limits.cooldownSeconds).toBeGreaterThan(0);
  });
});
