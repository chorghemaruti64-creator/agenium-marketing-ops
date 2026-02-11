/**
 * Risk Scoring Module
 * Calculates risk score for content based on various factors
 */
import { PlatformAction } from './types.js';
export interface RiskBreakdown {
    base: number;
    secretsDetected: number;
    externalLinks: number;
    lowQuality: number;
    total: number;
}
/**
 * Count external links in content
 */
export declare function countExternalLinks(links: string[]): number;
/**
 * Check if content is low quality (short post/submit)
 */
export declare function isLowQuality(action: PlatformAction): boolean;
/**
 * Check for risky keywords
 */
export declare function hasRiskyKeywords(text: string): boolean;
/**
 * Calculate risk score for an action
 *
 * Scoring:
 * - Base: 10
 * - Secrets detected: +40
 * - External links > 3: +20
 * - Low quality (short post): +20
 * - Risky keywords: +15
 */
export declare function calculateRiskScore(action: PlatformAction): RiskBreakdown;
/**
 * Check if risk score exceeds threshold
 */
export declare function isRiskTooHigh(score: number, threshold?: number): boolean;
//# sourceMappingURL=risk.d.ts.map