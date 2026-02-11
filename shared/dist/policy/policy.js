/**
 * Policy Engine Core
 * Evaluates every platform action before publishing
 */
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { DEFAULT_CONFIG, } from './types.js';
import { redactSecrets } from './redact.js';
import { runSafetyChecks, checkBrandCompliance, checkEvidenceRequirement, allowedDuringQuietHours, } from './rules.js';
import { calculateRiskScore, isRiskTooHigh } from './risk.js';
/**
 * Normalize text for fingerprinting
 * - lowercase
 * - remove extra whitespace
 * - remove special characters
 */
function normalizeText(text) {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
}
/**
 * Generate action fingerprint
 * SHA256 of: platform + action_type + normalized(redacted_text) + sorted(links)
 */
export function generateFingerprint(platform, actionType, redactedText, links) {
    const normalized = normalizeText(redactedText);
    const sortedLinks = [...links].sort().join('|');
    const input = `${platform}:${actionType}:${normalized}:${sortedLinks}`;
    return createHash('sha256').update(input).digest('hex');
}
/**
 * Check if current time is in quiet hours (Europe/Berlin)
 */
function isQuietHours(time, config) {
    // Convert to Europe/Berlin timezone
    const berlinTime = new Date(time.toLocaleString('en-US', { timeZone: config.quietHours.timezone }));
    const hour = berlinTime.getHours();
    const { start, end } = config.quietHours;
    // Handle overnight range (e.g., 01:00 to 07:00)
    if (start < end) {
        return hour >= start && hour < end;
    }
    else {
        return hour >= start || hour < end;
    }
}
/**
 * Get rate limit for platform/action combination
 */
function getRateLimit(platform, actionType, config) {
    const limits = config.rateLimits[platform];
    switch (actionType) {
        case 'post':
            return limits.postsPerDay ?? 3;
        case 'reply':
            return limits.repliesPerDay ?? 10;
        case 'comment':
            return limits.commentsPerDay ?? 10;
        case 'submit':
            return limits.submissionsPerDay ?? limits.postsPerDay ?? 1;
        case 'discussion':
            return limits.discussionsPerDay ?? 2;
        case 'issue':
            return limits.issuesPerDay ?? 2;
        case 'dm':
            return limits.dmsPerDay ?? 5;
        default:
            return 10;
    }
}
/**
 * Get enforced limits for platform/action
 */
function getEnforcedLimits(platform, actionType, config) {
    const maxPerDay = getRateLimit(platform, actionType, config);
    return {
        maxPerDay,
        maxPerHour: Math.max(1, Math.ceil(maxPerDay / 8)), // Spread across 8 active hours
        cooldownSeconds: Math.floor(86400 / maxPerDay), // Seconds between posts
    };
}
/**
 * Check kill switches
 */
function checkKillSwitches(config) {
    // File kill switch
    if (existsSync(config.killSwitchPath)) {
        return 'STOP_ALL';
    }
    // Env kill switch
    if (process.env.PUBLISH_ENABLED === 'false') {
        return 'PUBLISH_DISABLED';
    }
    return null;
}
/**
 * Main policy evaluation function
 */
export function evaluate(action, config = DEFAULT_CONFIG, store, auditFn) {
    const reasonCodes = [];
    let allow = true;
    let nextAllowedAt = null;
    let requiredBackoff;
    // 1. Redact secrets first
    const redactionResult = redactSecrets(action.text);
    const redactedText = redactionResult.redacted;
    // Generate fingerprint
    const fingerprint = generateFingerprint(action.platform, action.action_type, redactedText, action.links);
    // Get enforced limits
    const enforcedLimits = getEnforcedLimits(action.platform, action.action_type, config);
    // 2. Check kill switches (highest priority)
    const killSwitch = checkKillSwitches(config);
    if (killSwitch) {
        reasonCodes.push(killSwitch);
        allow = false;
    }
    // 3. Check for leaked secrets
    if (allow && redactionResult.hasSecrets) {
        reasonCodes.push('SECRET_LEAKED');
        allow = false;
    }
    // 4. Run safety checks (hard blocks)
    if (allow) {
        const safetyViolations = runSafetyChecks(action);
        if (safetyViolations.length > 0) {
            reasonCodes.push(...safetyViolations);
            allow = false;
        }
    }
    // 5. Check brand compliance
    if (allow) {
        const brandIssue = checkBrandCompliance(action);
        if (brandIssue) {
            reasonCodes.push(brandIssue);
            allow = false;
        }
    }
    // 6. Check evidence requirements
    if (allow) {
        const evidenceIssue = checkEvidenceRequirement(action);
        if (evidenceIssue) {
            reasonCodes.push(evidenceIssue);
            allow = false;
        }
    }
    // 7. Check quiet hours
    if (allow && isQuietHours(action.time, config)) {
        if (!allowedDuringQuietHours(action.action_type)) {
            reasonCodes.push('QUIET_HOURS');
            allow = false;
            // Calculate next allowed time (end of quiet hours)
            const nextDay = new Date(action.time);
            nextDay.setHours(config.quietHours.end, 0, 0, 0);
            if (nextDay <= action.time) {
                nextDay.setDate(nextDay.getDate() + 1);
            }
            nextAllowedAt = nextDay;
        }
    }
    // 8. Check rate limits (if store available)
    if (allow && store) {
        const currentCount = store.getTodayCount(action.platform, action.action_type);
        if (currentCount >= enforcedLimits.maxPerDay) {
            reasonCodes.push('RATE_LIMIT_EXCEEDED');
            allow = false;
            // Next allowed is tomorrow
            const tomorrow = new Date(action.time);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            nextAllowedAt = tomorrow;
            requiredBackoff = Math.floor((tomorrow.getTime() - action.time.getTime()) / 1000);
        }
    }
    // 9. Check dedupe (if store available)
    if (allow && store) {
        if (store.isDuplicate(fingerprint, config.dedupeDays)) {
            reasonCodes.push('DUPLICATE_CONTENT');
            allow = false;
        }
    }
    // 10. Calculate risk score
    const riskBreakdown = calculateRiskScore(action);
    // 11. Check risk threshold
    if (allow && isRiskTooHigh(riskBreakdown.total, config.riskThreshold)) {
        reasonCodes.push('RISK_TOO_HIGH');
        allow = false;
    }
    // If allowed, add success code
    if (allow) {
        reasonCodes.push('ALLOWED');
    }
    // Build decision
    const decision = {
        allow,
        reason_codes: reasonCodes,
        risk_score: riskBreakdown.total,
        enforced_limits: enforcedLimits,
        redacted_text: redactedText,
        action_fingerprint: fingerprint,
        next_allowed_at: nextAllowedAt,
        required_backoff: requiredBackoff,
    };
    // Log to store and audit
    if (store) {
        store.logAction(action.platform, action.action_type, fingerprint, decision, redactedText.substring(0, 200));
        if (allow) {
            store.incrementCounter(action.platform, action.action_type);
            store.addFingerprint(fingerprint, action.platform);
        }
    }
    if (auditFn) {
        auditFn.audit(action, decision);
    }
    return decision;
}
/**
 * Create a policy evaluator with injected dependencies
 */
export function createPolicyEvaluator(config = DEFAULT_CONFIG, store, auditFn) {
    return (action) => {
        return evaluate(action, config, store, auditFn);
    };
}
//# sourceMappingURL=policy.js.map