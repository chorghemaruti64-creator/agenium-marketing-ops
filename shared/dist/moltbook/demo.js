#!/usr/bin/env npx ts-node
/**
 * Moltbook Demo
 * Runs a simulated pipeline producing events and summaries
 */
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { logPolicyDecisionLegacy as logPolicyDecision, logPlatformAttemptLegacy as logPlatformAttempt, logPlatformResultLegacy as logPlatformResult, logRetryScheduled, logCircuitBreaker, logArtifact, logPipelineStart, logPipelineEnd, } from './ledger.js';
import { getLatestEvents, query } from './reader.js';
import { generateDailySummary } from './summarize.js';
// Use temp directory for demo
const DEMO_PATH = '/tmp/moltbook-demo-' + randomUUID().substring(0, 8);
process.env.MOLTBOOK_PATH = DEMO_PATH;
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║              MOLTBOOK DEMO - Event Ledger                      ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`Demo path: ${DEMO_PATH}`);
console.log('');
// Create demo directory
mkdirSync(DEMO_PATH, { recursive: true });
// Simulate a pipeline run
console.log('═══════════════════════════════════════════════════════════════════');
console.log('SIMULATING PIPELINE RUN: daily-marketing');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
const runId = randomUUID();
const startTime = Date.now();
// 1. Pipeline Start
console.log('1️⃣  Pipeline Start');
const startEvent = logPipelineStart('orchestrator', runId, 'daily-marketing', 'schedule', { max_posts: 5 });
printEvent(startEvent);
// 2. Policy Decisions
console.log('2️⃣  Policy Decisions');
const policyDecisions = [
    { platform: 'x', allow: true, reasons: ['ALLOWED'], text: 'Check out Agenium v2.0!' },
    { platform: 'reddit', allow: false, reasons: ['BRAND_MISSING'], text: 'Cool new protocol' },
    { platform: 'telegram', allow: true, reasons: ['ALLOWED'], text: 'Agenium marketplace update' },
    { platform: 'x', allow: false, reasons: ['QUIET_HOURS'], text: 'Late night Agenium post' },
    { platform: 'github', allow: true, reasons: ['ALLOWED'], text: 'New discussion about agent://' },
];
for (const pd of policyDecisions) {
    const fp = randomUUID().substring(0, 16);
    const event = logPolicyDecision('orchestrator', pd.platform, 'post', fp, pd.allow, pd.reasons, pd.allow ? 10 : 25, pd.text, runId);
    printEvent(event);
}
// 3. Platform Attempts & Results
console.log('3️⃣  Platform Attempts & Results');
const attempts = [
    { platform: 'x', success: true, permalink: 'https://x.com/agenium/status/123' },
    { platform: 'telegram', success: true, permalink: 'https://t.me/agenium/456' },
    { platform: 'github', success: false, error: 'Rate limited' },
];
for (const att of attempts) {
    const fp = randomUUID().substring(0, 16);
    const traceId = randomUUID();
    // Attempt
    const attemptEvent = logPlatformAttempt('distribution', att.platform, 'post', fp, traceId);
    printEvent(attemptEvent);
    // Result
    const resultEvent = logPlatformResult('distribution', att.platform, 'post', fp, traceId, att.success, {
        httpStatus: att.success ? 201 : 429,
        permalink: att.permalink,
        errorMessage: att.error,
        latencyMs: Math.floor(Math.random() * 500) + 100,
    });
    printEvent(resultEvent);
}
// 4. Retry Scheduled
console.log('4️⃣  Retry Scheduled');
const retryEvent = logRetryScheduled('distribution', 'github', 'post', randomUUID().substring(0, 16), runId, 1, 3, 60, 'Rate limited');
printEvent(retryEvent);
// 5. Circuit Breaker
console.log('5️⃣  Circuit Breaker Changes');
const cbOpenEvent = logCircuitBreaker('distribution', 'hn', 'opened', 5, 5, undefined, 'Too many failures');
printEvent(cbOpenEvent);
// 6. Artifacts
console.log('6️⃣  Artifacts Created');
const artifactEvent = logArtifact('content', '/opt/marketing-ops/artifacts/draft-launch.md', 'abc123def456789', 'content_draft', 2048, { campaign: 'v2-launch', version: 3 });
printEvent(artifactEvent);
// 7. Pipeline End
console.log('7️⃣  Pipeline End');
const endEvent = logPipelineEnd('orchestrator', runId, 'daily-marketing', true, Date.now() - startTime, 12, 8, 4);
printEvent(endEvent);
// Generate Summary
console.log('');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('GENERATING DAILY SUMMARY');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
const today = new Date().toISOString().split('T')[0];
const summary = generateDailySummary(today);
console.log(`Period: ${summary.period}`);
console.log(`Total Events: ${summary.total_events}`);
console.log('');
console.log('By Status:');
for (const [status, count] of Object.entries(summary.by_status)) {
    const emoji = status === 'ok' ? '✅' : status === 'blocked' ? '🚫' : status === 'failed' ? '❌' : '🔄';
    console.log(`  ${emoji} ${status}: ${count}`);
}
console.log('');
console.log('By Platform:');
for (const [platform, count] of Object.entries(summary.by_platform)) {
    console.log(`  ${platform}: ${count}`);
}
console.log('');
console.log('Top Deny Reasons:');
for (const { reason, count } of summary.top_deny_reasons) {
    console.log(`  ${reason}: ${count}`);
}
console.log('');
// Query Demo
console.log('═══════════════════════════════════════════════════════════════════');
console.log('QUERY DEMO');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log('Query: status=blocked');
const blocked = query({ date: today, status: 'blocked' });
console.log(`Found: ${blocked.length} events`);
for (const e of blocked) {
    console.log(`  - ${e.platform}: ${e.summary}`);
}
console.log('');
console.log('Query: eventType=PLATFORM_RESULT, status=ok');
const successful = query({ date: today, eventType: 'PLATFORM_RESULT', status: 'ok' });
console.log(`Found: ${successful.length} events`);
for (const e of successful) {
    console.log(`  - ${e.platform}: ${e.links?.join(', ') || 'no links'}`);
}
console.log('');
// Sample Event JSON
console.log('═══════════════════════════════════════════════════════════════════');
console.log('SAMPLE EVENT JSON');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
const latest = getLatestEvents(1)[0];
console.log(JSON.stringify(latest, null, 2));
console.log('');
// Cleanup
console.log('═══════════════════════════════════════════════════════════════════');
console.log('DEMO COMPLETE');
console.log('═══════════════════════════════════════════════════════════════════');
console.log('');
console.log(`Generated files in: ${DEMO_PATH}`);
console.log('');
console.log('Summary written to:');
console.log(`  - ${join(DEMO_PATH, 'daily', `${today}.md`)}`);
console.log(`  - ${join(DEMO_PATH, 'daily', `${today}.json`)}`);
console.log('');
// Cleanup temp directory
rmSync(DEMO_PATH, { recursive: true, force: true });
console.log('(Demo directory cleaned up)');
function printEvent(event) {
    const emoji = event.status === 'ok' ? '✅' :
        event.status === 'blocked' ? '🚫' :
            event.status === 'failed' ? '❌' : '🔄';
    const time = event.ts.split('T')[1].split('.')[0];
    console.log(`  ${emoji} ${time} [${event.source_agent}] ${event.event_type} ${event.platform || ''} - ${event.summary.substring(0, 50)}`);
}
//# sourceMappingURL=demo.js.map