#!/usr/bin/env npx ts-node
/**
 * Policy Engine Demo
 * Runs 10 sample actions and shows decisions
 */

import { evaluate, generateFingerprint } from './policy.js';
import { PlatformAction, DEFAULT_CONFIG } from './types.js';
import { createMockAudit } from '../moltbook/audit.js';
import { createInMemoryStore } from '../store/sqlite.js';

// Create in-memory store for demo
const mockStore = createInMemoryStore();

// Sample actions to test
const sampleActions: Array<{ name: string; action: PlatformAction; expectAllow: boolean }> = [
  {
    name: '1. Valid Agenium announcement',
    action: {
      platform: 'x',
      action_type: 'post',
      text: 'Excited to announce Agenium v0.2.0 is live! The agent:// protocol now supports federation. Check out the DNS registry for available agents.',
      links: ['https://github.com/agenium/agenium'],
      metadata: { campaign: 'launch', language: 'en' },
      time: new Date('2024-02-15T10:00:00+01:00'), // 10am Berlin
    },
    expectAllow: true,
  },
  {
    name: '2. Missing brand mention (should deny)',
    action: {
      platform: 'reddit',
      action_type: 'post',
      text: 'Check out this cool new protocol for agent communication!',
      links: [],
      metadata: { campaign: 'awareness' },
      time: new Date('2024-02-15T14:00:00+01:00'),
    },
    expectAllow: false, // BRAND_MISSING
  },
  {
    name: '3. Contains secret (should deny)',
    action: {
      platform: 'telegram',
      action_type: 'post',
      text: 'Testing Agenium with token ghp_abcdefghij1234567890abcdefghij1234567890 works great!',
      links: [],
      metadata: {},
      time: new Date('2024-02-15T12:00:00+01:00'),
    },
    expectAllow: false, // SECRET_LEAKED
  },
  {
    name: '4. Quiet hours post (should deny)',
    action: {
      platform: 'x',
      action_type: 'post',
      text: 'Late night Agenium update! The marketplace is growing.',
      links: [],
      metadata: {},
      time: new Date('2024-02-15T03:00:00+01:00'), // 3am Berlin
    },
    expectAllow: false, // QUIET_HOURS
  },
  {
    name: '5. Quiet hours reply (should allow)',
    action: {
      platform: 'x',
      action_type: 'reply',
      text: 'Thanks for the feedback! We are working on it.',
      links: [],
      metadata: { targetThread: '123456' },
      time: new Date('2024-02-15T03:00:00+01:00'), // 3am Berlin
    },
    expectAllow: true, // Replies allowed during quiet hours
  },
  {
    name: '6. Numeric claim without evidence (should deny)',
    action: {
      platform: 'hn',
      action_type: 'submit',
      text: 'Agenium achieves 10,000 req/s with p95 latency of 5ms - fastest agent protocol ever!',
      links: ['https://agenium.io'],
      metadata: {},
      time: new Date('2024-02-15T15:00:00+01:00'),
    },
    expectAllow: false, // NO_EVIDENCE_FOR_CLAIM
  },
  {
    name: '7. Numeric claim WITH evidence (should allow)',
    action: {
      platform: 'github',
      action_type: 'discussion',
      text: 'Agenium benchmark results: 10,000 req/s with p95 of 5ms. See attached logs.',
      links: ['https://github.com/agenium/benchmarks'],
      metadata: {},
      time: new Date('2024-02-15T11:00:00+01:00'),
      evidence: [
        { type: 'log', source: 'benchmark.log', value: '10000 rps', timestamp: '2024-02-14T10:00:00Z' },
      ],
    },
    expectAllow: true,
  },
  {
    name: '8. Hate speech (should deny)',
    action: {
      platform: 'discord',
      action_type: 'post',
      text: 'Agenium helps you target and eliminate n1ggers from your network.',
      links: [],
      metadata: {},
      time: new Date('2024-02-15T12:00:00+01:00'),
    },
    expectAllow: false, // HATE_HARASSMENT
  },
  {
    name: '9. Contains internal IP (should deny)',
    action: {
      platform: 'reddit',
      action_type: 'post',
      text: 'Agenium is running on server 192.168.1.100 - check it out at the marketplace!',
      links: [],
      metadata: {},
      time: new Date('2024-02-15T10:00:00+01:00'),
    },
    expectAllow: false, // SECRET_LEAKED (internal IP)
  },
  {
    name: '10. Valid community reply',
    action: {
      platform: 'reddit',
      action_type: 'comment',
      text: 'Great question! Agenium uses mTLS for all agent communication. The DNS registry handles discovery.',
      links: [],
      metadata: { targetThread: 'abc123' },
      time: new Date('2024-02-15T16:00:00+01:00'),
    },
    expectAllow: true,
  },
];

// Run demo
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║           POLICY ENGINE DEMO - 10 Sample Actions               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const mockAudit = createMockAudit();
let passed = 0;
let failed = 0;

for (const { name, action, expectAllow } of sampleActions) {
  const decision = evaluate(action, DEFAULT_CONFIG, mockStore, mockAudit);
  
  const match = decision.allow === expectAllow;
  const status = match ? '✅ PASS' : '❌ FAIL';
  
  if (match) passed++;
  else failed++;
  
  console.log(`${status} | ${name}`);
  console.log(`       Decision: ${decision.allow ? '🟢 ALLOW' : '🔴 DENY'}`);
  console.log(`       Reasons: ${decision.reason_codes.join(', ')}`);
  console.log(`       Risk Score: ${decision.risk_score}/100`);
  console.log(`       Fingerprint: ${decision.action_fingerprint.substring(0, 16)}...`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Results: ${passed}/10 passed, ${failed}/10 failed`);
console.log('═══════════════════════════════════════════════════════════════════');

// Exit with error if any tests failed
process.exit(failed > 0 ? 1 : 0);
