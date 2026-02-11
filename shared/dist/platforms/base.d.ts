/**
 * Base platform connector with policy + Moltbook wiring
 */
import type { Platform, PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
export interface ExecuteFn {
    (action: PlatformAction, config: ConnectorConfig): Promise<PlatformResult>;
}
/**
 * Wraps a platform-specific execute function with policy + Moltbook
 */
export declare function executeWithPolicy(action: PlatformAction, config: ConnectorConfig, executeFn: ExecuteFn): Promise<PlatformResult>;
/**
 * Check if circuit breaker is tripped
 * For now, uses file-based circuit breaker (can be enhanced with SQLite)
 */
export declare function isCircuitOpen(storeDb: string, platform: Platform): Promise<boolean>;
//# sourceMappingURL=base.d.ts.map