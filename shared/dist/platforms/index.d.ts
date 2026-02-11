/**
 * Platform connectors index
 */
export * from './types.js';
export * from './base.js';
export { postToGitHub } from './github.js';
export { postToTelegram } from './telegram.js';
export { postToX } from './x.js';
export { postToReddit } from './reddit.js';
export { postToHN, generateHNDraft } from './hn.js';
export { postToDiscord } from './discord.js';
export { runPreflight, getValidPlatforms, type PreflightResult } from './preflight.js';
import type { Platform, PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
/**
 * Unified platform dispatcher
 */
export declare function postToPlatform(action: PlatformAction, config: ConnectorConfig): Promise<PlatformResult>;
/**
 * Check which platforms have credentials configured
 */
export declare function getConfiguredPlatforms(config: ConnectorConfig): Platform[];
//# sourceMappingURL=index.d.ts.map