/**
 * Moltbook Summarize
 * Daily and weekly rollup generation
 */

import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MoltEvent, PeriodSummary, EventStatus } from './types.js';
import { 
  readEventsByDate, 
  readEventsByDateRange,
  countBy,
  getTopDenyReasons,
  getSuccessfulPosts,
  getCircuitBreakerChanges,
  getFailedEvents,
  getArtifacts,
  getPipelineRuns,
} from './reader.js';

// Read path at runtime, not module load time
function getMoltbookPath(): string {
  return process.env.MOLTBOOK_PATH || '/opt/marketing-ops/moltbook';
}

/**
 * Ensure directory exists
 */
function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

/**
 * Get week number from date
 */
function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

/**
 * Get all dates in a week
 */
function getWeekDates(year: number, week: number): string[] {
  const dates: string[] = [];
  const firstDayOfYear = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7 - firstDayOfYear.getDay();
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(year, 0, 1 + daysOffset + i);
    if (date.getFullYear() === year) {
      dates.push(date.toISOString().split('T')[0]);
    }
  }
  
  return dates;
}

/**
 * Generate summary statistics from events
 */
export function generateSummary(events: MoltEvent[], period: string, periodType: 'daily' | 'weekly'): PeriodSummary {
  const byStatus: Record<EventStatus, number> = { 
    ok: 0, blocked: 0, failed: 0, retrying: 0, 
    success: 0, started: 0, skipped: 0, partial: 0, allowed: 0, error: 0 
  };
  const byPlatform: Record<string, number> = {};
  const byEventType: Record<string, number> = {};
  const byAgent: Record<string, number> = {};
  
  for (const event of events) {
    byStatus[event.status] = (byStatus[event.status] || 0) + 1;
    
    if (event.platform) {
      byPlatform[event.platform] = (byPlatform[event.platform] || 0) + 1;
    }
    
    byEventType[event.event_type] = (byEventType[event.event_type] || 0) + 1;
    byAgent[event.source_agent] = (byAgent[event.source_agent] || 0) + 1;
  }
  
  // Get top deny reasons
  const topDenyReasons = getTopDenyReasons(events);
  
  // Get successful posts
  const successfulPosts = events.filter(e => 
    e.event_type === 'PLATFORM_RESULT' && 
    e.data.success === true
  ).map(e => ({
    fingerprint: e.fingerprint || 'unknown',
    platform: e.platform || 'unknown',
    summary: e.summary,
    links: e.links,
  }));
  
  // Get failures
  const failures = events.filter(e => e.status === 'failed').map(e => ({
    ts: e.ts,
    platform: e.platform || 'unknown',
    error: e.data.error_message || e.summary,
  }));
  
  // Get circuit breaker changes
  const cbChanges = events.filter(e => 
    e.event_type === 'CIRCUIT_BREAKER_OPENED' || 
    e.event_type === 'CIRCUIT_BREAKER_CLOSED'
  ).map(e => ({
    ts: e.ts,
    platform: e.platform || 'unknown',
    action: e.event_type === 'CIRCUIT_BREAKER_OPENED' ? 'opened' : 'closed' as 'opened' | 'closed',
  }));
  
  // Count artifacts and pipeline runs
  const artifactsCreated = events.filter(e => e.event_type === 'ARTIFACT_CREATED').length;
  const pipelineRuns = events.filter(e => e.event_type === 'PIPELINE_RUN_END').length;
  
  return {
    period,
    period_type: periodType,
    total_events: events.length,
    by_status: byStatus,
    by_platform: byPlatform,
    by_event_type: byEventType,
    by_agent: byAgent,
    top_deny_reasons: topDenyReasons,
    top_posts: successfulPosts.slice(0, 10),
    failures: failures.slice(0, 20),
    circuit_breaker_changes: cbChanges,
    artifacts_created: artifactsCreated,
    pipeline_runs: pipelineRuns,
  };
}

/**
 * Format summary as markdown
 */
export function formatSummaryAsMarkdown(summary: PeriodSummary): string {
  const lines: string[] = [];
  
  lines.push(`# Moltbook ${summary.period_type === 'daily' ? 'Daily' : 'Weekly'} Summary: ${summary.period}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(`- **Total Events:** ${summary.total_events}`);
  lines.push(`- **Pipeline Runs:** ${summary.pipeline_runs}`);
  lines.push(`- **Artifacts Created:** ${summary.artifacts_created}`);
  lines.push('');
  
  // Status breakdown
  lines.push('## By Status');
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  for (const [status, count] of Object.entries(summary.by_status)) {
    const emoji = status === 'ok' ? '✅' : status === 'blocked' ? '🚫' : status === 'failed' ? '❌' : '🔄';
    lines.push(`| ${emoji} ${status} | ${count} |`);
  }
  lines.push('');
  
  // Platform breakdown
  if (Object.keys(summary.by_platform).length > 0) {
    lines.push('## By Platform');
    lines.push('');
    lines.push('| Platform | Events |');
    lines.push('|----------|--------|');
    for (const [platform, count] of Object.entries(summary.by_platform).sort((a, b) => b[1] - a[1])) {
      lines.push(`| ${platform} | ${count} |`);
    }
    lines.push('');
  }
  
  // Event type breakdown
  lines.push('## By Event Type');
  lines.push('');
  lines.push('| Event Type | Count |');
  lines.push('|------------|-------|');
  for (const [type, count] of Object.entries(summary.by_event_type).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${type} | ${count} |`);
  }
  lines.push('');
  
  // Top deny reasons
  if (summary.top_deny_reasons.length > 0) {
    lines.push('## Top Deny Reasons');
    lines.push('');
    lines.push('| Reason | Count |');
    lines.push('|--------|-------|');
    for (const { reason, count } of summary.top_deny_reasons.slice(0, 10)) {
      lines.push(`| ${reason} | ${count} |`);
    }
    lines.push('');
  }
  
  // Successful posts
  if (summary.top_posts.length > 0) {
    lines.push('## Successful Posts');
    lines.push('');
    for (const post of summary.top_posts.slice(0, 10)) {
      lines.push(`- **${post.platform}**: ${post.summary}`);
      if (post.links && post.links.length > 0) {
        lines.push(`  - Links: ${post.links.join(', ')}`);
      }
    }
    lines.push('');
  }
  
  // Failures
  if (summary.failures.length > 0) {
    lines.push('## Failures');
    lines.push('');
    lines.push('| Time | Platform | Error |');
    lines.push('|------|----------|-------|');
    for (const failure of summary.failures.slice(0, 10)) {
      const time = failure.ts.split('T')[1].split('.')[0];
      lines.push(`| ${time} | ${failure.platform} | ${failure.error.substring(0, 50)} |`);
    }
    lines.push('');
  }
  
  // Circuit breaker changes
  if (summary.circuit_breaker_changes.length > 0) {
    lines.push('## Circuit Breaker Changes');
    lines.push('');
    for (const change of summary.circuit_breaker_changes) {
      const time = change.ts.split('T')[1].split('.')[0];
      const emoji = change.action === 'opened' ? '🔴' : '🟢';
      lines.push(`- ${emoji} ${time}: ${change.platform} ${change.action.toUpperCase()}`);
    }
    lines.push('');
  }
  
  // Agent activity
  lines.push('## Agent Activity');
  lines.push('');
  lines.push('| Agent | Events |');
  lines.push('|-------|--------|');
  for (const [agent, count] of Object.entries(summary.by_agent).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${agent} | ${count} |`);
  }
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Generate and write daily summary
 */
export function generateDailySummary(date?: string): PeriodSummary {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const events = readEventsByDate(targetDate);
  const summary = generateSummary(events, targetDate, 'daily');
  
  // Write markdown
  const dailyDir = join(getMoltbookPath(), 'daily');
  ensureDir(dailyDir);
  
  const markdown = formatSummaryAsMarkdown(summary);
  writeFileSync(join(dailyDir, `${targetDate}.md`), markdown);
  
  // Also write JSON
  writeFileSync(join(dailyDir, `${targetDate}.json`), JSON.stringify(summary, null, 2));
  
  return summary;
}

/**
 * Generate and write weekly summary
 */
export function generateWeeklySummary(year?: number, week?: number): PeriodSummary {
  const now = new Date();
  const targetYear = year || now.getFullYear();
  const targetWeek = week || getWeekNumber(now);
  
  const weekStr = `${targetYear}-W${targetWeek.toString().padStart(2, '0')}`;
  const dates = getWeekDates(targetYear, targetWeek);
  
  // Collect all events for the week
  const allEvents: MoltEvent[] = [];
  for (const date of dates) {
    allEvents.push(...readEventsByDate(date));
  }
  
  const summary = generateSummary(allEvents, weekStr, 'weekly');
  
  // Write markdown
  const weeklyDir = join(getMoltbookPath(), 'weekly');
  ensureDir(weeklyDir);
  
  const markdown = formatSummaryAsMarkdown(summary);
  writeFileSync(join(weeklyDir, `${weekStr}.md`), markdown);
  
  // Also write JSON
  writeFileSync(join(weeklyDir, `${weekStr}.json`), JSON.stringify(summary, null, 2));
  
  return summary;
}

/**
 * Generate summaries for missing dates
 */
export function backfillSummaries(startDate: string, endDate: string): void {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Generate daily summaries
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const summaryPath = join(getMoltbookPath(), 'daily', `${dateStr}.md`);
    
    if (!existsSync(summaryPath)) {
      try {
        generateDailySummary(dateStr);
        console.log(`Generated daily summary for ${dateStr}`);
      } catch (error) {
        console.error(`Failed to generate summary for ${dateStr}:`, error);
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
}
