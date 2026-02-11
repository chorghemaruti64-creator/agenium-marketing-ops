/**
 * Platform Credential Preflight Validation
 * Tests credentials before attempting posts
 */
import type { Platform, PlatformCredentials } from './types.js';
export interface PreflightResult {
    platform: Platform;
    valid: boolean;
    error?: string;
    reason?: 'UNSUPPORTED_AUTH' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'NETWORK_ERROR';
}
/**
 * Run preflight checks for all platforms
 */
export declare function runPreflight(credentials: PlatformCredentials, moltbookDir: string, storeDir: string): Promise<Map<Platform, PreflightResult>>;
/**
 * Get platforms that passed preflight
 */
export declare function getValidPlatforms(results: Map<Platform, PreflightResult>): Platform[];
//# sourceMappingURL=preflight.d.ts.map