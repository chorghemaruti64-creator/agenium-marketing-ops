/**
 * Content Safety Rules
 * Hard-coded rules for content moderation
 */
import { PlatformAction, ReasonCode, ActionType } from './types.js';
/**
 * Check for hate/harassment content
 */
export declare function checkHateHarassment(text: string): boolean;
/**
 * Check for sexual content
 */
export declare function checkSexualContent(text: string): boolean;
/**
 * Check for doxxing attempts
 */
export declare function checkDoxxing(text: string): boolean;
/**
 * Check for illegal instructions
 */
export declare function checkIllegalInstructions(text: string): boolean;
/**
 * Check for political targeting
 */
export declare function checkPoliticalTargeting(text: string): boolean;
/**
 * Check if content has brand mentions (required for posts/submissions)
 */
export declare function hasBrandMention(text: string): boolean;
/**
 * Check if content has numeric claims that need evidence
 */
export declare function hasNumericClaims(text: string): boolean;
/**
 * Check if action type requires brand mention
 */
export declare function requiresBrandMention(actionType: ActionType): boolean;
/**
 * Check if action type is allowed during quiet hours
 */
export declare function allowedDuringQuietHours(actionType: ActionType): boolean;
/**
 * Run all safety checks on content
 * Returns list of violated rules
 */
export declare function runSafetyChecks(action: PlatformAction): ReasonCode[];
/**
 * Check brand compliance
 */
export declare function checkBrandCompliance(action: PlatformAction): ReasonCode | null;
/**
 * Check evidence requirements for numeric claims
 */
export declare function checkEvidenceRequirement(action: PlatformAction): ReasonCode | null;
//# sourceMappingURL=rules.d.ts.map