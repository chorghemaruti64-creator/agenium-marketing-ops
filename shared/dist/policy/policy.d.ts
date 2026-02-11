/**
 * Policy Engine Core
 * Evaluates every platform action before publishing
 */
import { PlatformAction, PolicyDecision, PolicyConfig, Platform, ActionType } from './types.js';
export interface PolicyStore {
    getTodayCount(platform: Platform, actionType: ActionType): number;
    isDuplicate(fingerprint: string, days: number): boolean;
    incrementCounter(platform: Platform, actionType: ActionType): void;
    addFingerprint(fingerprint: string, platform: Platform): void;
    logAction(platform: Platform, actionType: ActionType, fingerprint: string, decision: PolicyDecision, textPreview?: string): void;
}
export interface PolicyAudit {
    audit(action: PlatformAction, decision: PolicyDecision): void;
}
/**
 * Generate action fingerprint
 * SHA256 of: platform + action_type + normalized(redacted_text) + sorted(links)
 */
export declare function generateFingerprint(platform: string, actionType: string, redactedText: string, links: string[]): string;
/**
 * Main policy evaluation function
 */
export declare function evaluate(action: PlatformAction, config?: PolicyConfig, store?: PolicyStore, auditFn?: PolicyAudit): PolicyDecision;
/**
 * Create a policy evaluator with injected dependencies
 */
export declare function createPolicyEvaluator(config?: PolicyConfig, store?: PolicyStore, auditFn?: PolicyAudit): (action: PlatformAction) => PolicyDecision;
//# sourceMappingURL=policy.d.ts.map