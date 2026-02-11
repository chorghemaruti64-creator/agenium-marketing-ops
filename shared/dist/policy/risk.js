/**
 * Risk Scoring Module
 * Calculates risk score for content based on various factors
 */
import { containsSecrets } from './redact.js';
// Prohibited keywords that add to risk even if not hard-blocked
const RISKY_KEYWORDS = [
    // Financial risk
    /\b(guaranteed|100%|risk.?free|get\s+rich)\b/i,
    /\b(invest|trading|crypto)\s+(now|today|opportunity)/i,
    // Spam patterns
    /\b(click\s+here|act\s+now|limited\s+time|don'?t\s+miss)\b/i,
    /\b(free\s+money|earn\s+\$\d+|make\s+money\s+fast)\b/i,
    // Aggressive marketing
    /\b(best|#1|number\s+one)\s+(in\s+the\s+world|ever)\b/i,
    /\b(revolutionary|game.?changing|disruptive)\b/i,
    // Urgency tactics
    /\b(hurry|urgent|last\s+chance|expires?\s+(soon|today))\b/i,
];
/**
 * Count external links in content
 */
export function countExternalLinks(links) {
    return links.filter(link => {
        try {
            const url = new URL(link);
            // Exclude common safe domains
            const safeDomains = ['github.com', 'agenium.io', 'docs.agenium.io'];
            return !safeDomains.some(d => url.hostname.endsWith(d));
        }
        catch {
            return true; // Malformed URLs count as external
        }
    }).length;
}
/**
 * Check if content is low quality (short post/submit)
 */
export function isLowQuality(action) {
    const minLength = 50;
    const isContentAction = ['post', 'submit', 'discussion'].includes(action.action_type);
    return isContentAction && action.text.length < minLength;
}
/**
 * Check for risky keywords
 */
export function hasRiskyKeywords(text) {
    return RISKY_KEYWORDS.some(p => p.test(text));
}
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
export function calculateRiskScore(action) {
    let base = 10;
    let secretsDetected = 0;
    let externalLinks = 0;
    let lowQuality = 0;
    // Check for secrets
    if (containsSecrets(action.text)) {
        secretsDetected = 40;
    }
    // Check external links
    const extLinkCount = countExternalLinks(action.links);
    if (extLinkCount > 3) {
        externalLinks = 20;
    }
    // Check for low quality content
    if (isLowQuality(action)) {
        lowQuality = 20;
    }
    // Add risky keywords bonus
    if (hasRiskyKeywords(action.text)) {
        base += 15;
    }
    const total = base + secretsDetected + externalLinks + lowQuality;
    return {
        base,
        secretsDetected,
        externalLinks,
        lowQuality,
        total: Math.min(total, 100), // Cap at 100
    };
}
/**
 * Check if risk score exceeds threshold
 */
export function isRiskTooHigh(score, threshold = 70) {
    return score >= threshold;
}
//# sourceMappingURL=risk.js.map