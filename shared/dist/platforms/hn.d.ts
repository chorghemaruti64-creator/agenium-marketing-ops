/**
 * Hacker News platform connector
 *
 * NOTE: HN has no official API for posting. This is a best-effort implementation
 * that will always return "not supported" since automating HN posts would violate
 * their terms of service. The connector exists for logging/auditing purposes.
 *
 * Manual posting is recommended, with the agent generating draft content.
 */
import type { PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
export declare function postToHN(action: PlatformAction, config: ConnectorConfig): Promise<PlatformResult>;
/**
 * Generate HN-specific draft content
 * This formats content optimally for manual HN submission
 */
export declare function generateHNDraft(content: string, title?: string): string;
//# sourceMappingURL=hn.d.ts.map