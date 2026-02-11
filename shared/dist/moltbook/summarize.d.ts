/**
 * Moltbook Summarize
 * Daily and weekly rollup generation
 */
import { MoltEvent, PeriodSummary } from './types.js';
/**
 * Generate summary statistics from events
 */
export declare function generateSummary(events: MoltEvent[], period: string, periodType: 'daily' | 'weekly'): PeriodSummary;
/**
 * Format summary as markdown
 */
export declare function formatSummaryAsMarkdown(summary: PeriodSummary): string;
/**
 * Generate and write daily summary
 */
export declare function generateDailySummary(date?: string): PeriodSummary;
/**
 * Generate and write weekly summary
 */
export declare function generateWeeklySummary(year?: number, week?: number): PeriodSummary;
/**
 * Generate summaries for missing dates
 */
export declare function backfillSummaries(startDate: string, endDate: string): void;
//# sourceMappingURL=summarize.d.ts.map