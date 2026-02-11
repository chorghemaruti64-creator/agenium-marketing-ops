/**
 * Shared agent utilities
 */
import type { PlatformCredentials } from '../platforms/types.js';
export interface AgentConfig {
    agentName: string;
    workspaceDir: string;
    moltbookDir: string;
    configDir: string;
    logsDir: string;
    storeDb: string;
    credentials: PlatformCredentials;
    dryRun: boolean;
    runOnce: boolean;
}
/**
 * Load agent configuration from environment
 */
export declare function loadAgentConfig(agentName: string): AgentConfig;
/**
 * Check if STOP_ALL kill switch is active
 */
export declare function isStopAll(configDir: string): boolean;
/**
 * Check PUBLISH_ENABLED env
 */
export declare function isPublishEnabled(): boolean;
/**
 * Generate a trace ID for correlating events
 */
export declare function generateTraceId(): string;
/**
 * Generate a fingerprint for content deduplication
 */
export declare function generateFingerprint(content: string, platform: string): string;
/**
 * Get today's date in YYYY-MM-DD format
 */
export declare function today(): string;
/**
 * Ensure directory exists
 */
export declare function ensureDir(dir: string): void;
/**
 * Write file with parent directory creation
 */
export declare function writeFile(filePath: string, content: string): void;
/**
 * Read file or return null
 */
export declare function readFile(filePath: string): string | null;
/**
 * List files in directory matching pattern
 */
export declare function listFiles(dir: string, pattern?: RegExp): string[];
/**
 * Simple health check server
 */
export declare function startHealthServer(port: number, agentName: string): Promise<void>;
/**
 * Sleep helper
 */
export declare function sleep(ms: number): Promise<void>;
//# sourceMappingURL=utils.d.ts.map