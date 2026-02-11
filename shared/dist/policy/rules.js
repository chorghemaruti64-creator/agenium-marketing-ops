/**
 * Content Safety Rules
 * Hard-coded rules for content moderation
 */
// Prohibited content patterns
const HATE_PATTERNS = [
    /\b(kill|murder|exterminate)\s+(all\s+)?(jews|muslims|christians|blacks|whites|asians|gays|trans)\b/i,
    /\b(n[i1]gg[e3]rs?|f[a4]gg[o0]ts?|k[i1]k[e3]s?|sp[i1]cs?|ch[i1]nks?|tr[a4]nn(y|ies))\b/i,
    /\bdeath\s+to\s+(all\s+)?(jews|muslims|christians|gays|trans|blacks|whites)\b/i,
    /\b(gas|lynch|hang)\s+the\s+(jews|muslims|blacks|gays)\b/i,
];
const SEXUAL_PATTERNS = [
    /\b(porn|xxx|nsfw|nude|naked|sex\s*tape)\b/i,
    /\b(onlyfans|fansly)\s*(link|content)\b/i,
    /\bexplicit\s+(sexual|content)\b/i,
];
const DOXXING_PATTERNS = [
    /\bhome\s+address[:\s]+\d+/i,
    /\bphone[:\s]+[\d\-\(\)\s]{10,}/i,
    /\bssn[:\s]+\d{3}[\-\s]?\d{2}[\-\s]?\d{4}/i,
    /\bsocial\s+security[:\s]+\d/i,
    /\bpersonal\s+(info|information|details)\s+of\s+@?\w+/i,
];
const ILLEGAL_PATTERNS = [
    /\bhow\s+to\s+(make|build)\s+(a\s+)?(bomb|explosive|weapon)/i,
    /\b(synthesize|cook|make)\s+(meth|cocaine|heroin|fentanyl)/i,
    /\bhack\s+(into|someone'?s?)\s+(bank|account)/i,
    /\bbuy\s+(drugs|weapons|guns)\s+(online|darknet)/i,
    /\bsteal\s+(from|identity)/i,
];
const POLITICAL_TARGETING_PATTERNS = [
    /\bvote\s+(for|against)\s+[A-Z][a-z]+\s+[A-Z]/i, // Vote for/against Person Name
    /\b(democrats?|republicans?|liberals?|conservatives?)\s+(are|is)\s+(evil|stupid|destroying)/i,
    /\b(trump|biden|maga|antifa)\s+(supporters?|voters?)\s+(should|must|need\s+to)/i,
    /\bpolitical\s+campaign\s+(message|ad|content)/i,
];
// Brand keywords that must appear in posts/submissions
const BRAND_KEYWORDS = [
    'agenium',
    'agent://',
    'dns registry',
    'marketplace',
    'a2a protocol',
    'agent-to-agent',
];
// Numeric claim patterns
const NUMERIC_CLAIM_PATTERNS = [
    /\d[\d,]*\s*(req|requests?)\/s/i, // 10,000 req/s
    /p\d{2,3}\s*(latency\s*of|of|:)?\s*\d+\s*m?s/i, // p95 latency of 5ms, p99: 10ms
    /\d+(\.\d+)?%\s*(coverage|uptime|availability|accuracy)/i, // 99.9% uptime
    /(coverage|uptime|availability|accuracy)[:\s]+\d+(\.\d+)?%/i, // coverage: 85%
    /\d+x\s*(faster|better|improvement)/i,
    /(achieved|reached|hit)\s+\d/i,
];
/**
 * Check for hate/harassment content
 */
export function checkHateHarassment(text) {
    return HATE_PATTERNS.some(p => p.test(text));
}
/**
 * Check for sexual content
 */
export function checkSexualContent(text) {
    return SEXUAL_PATTERNS.some(p => p.test(text));
}
/**
 * Check for doxxing attempts
 */
export function checkDoxxing(text) {
    return DOXXING_PATTERNS.some(p => p.test(text));
}
/**
 * Check for illegal instructions
 */
export function checkIllegalInstructions(text) {
    return ILLEGAL_PATTERNS.some(p => p.test(text));
}
/**
 * Check for political targeting
 */
export function checkPoliticalTargeting(text) {
    return POLITICAL_TARGETING_PATTERNS.some(p => p.test(text));
}
/**
 * Check if content has brand mentions (required for posts/submissions)
 */
export function hasBrandMention(text) {
    const lowerText = text.toLowerCase();
    return BRAND_KEYWORDS.some(keyword => lowerText.includes(keyword));
}
/**
 * Check if content has numeric claims that need evidence
 */
export function hasNumericClaims(text) {
    return NUMERIC_CLAIM_PATTERNS.some(p => p.test(text));
}
/**
 * Check if action type requires brand mention
 */
export function requiresBrandMention(actionType) {
    return ['post', 'submit', 'discussion', 'issue'].includes(actionType);
}
/**
 * Check if action type is allowed during quiet hours
 */
export function allowedDuringQuietHours(actionType) {
    return ['reply', 'comment'].includes(actionType);
}
/**
 * Run all safety checks on content
 * Returns list of violated rules
 */
export function runSafetyChecks(action) {
    const violations = [];
    const text = action.text;
    if (checkHateHarassment(text)) {
        violations.push('HATE_HARASSMENT');
    }
    if (checkSexualContent(text)) {
        violations.push('SEXUAL_CONTENT');
    }
    if (checkDoxxing(text)) {
        violations.push('DOXXING');
    }
    if (checkIllegalInstructions(text)) {
        violations.push('ILLEGAL_INSTRUCTIONS');
    }
    if (checkPoliticalTargeting(text)) {
        violations.push('POLITICAL_TARGETING');
    }
    return violations;
}
/**
 * Check brand compliance
 */
export function checkBrandCompliance(action) {
    if (requiresBrandMention(action.action_type) && !hasBrandMention(action.text)) {
        return 'BRAND_MISSING';
    }
    return null;
}
/**
 * Check evidence requirements for numeric claims
 */
export function checkEvidenceRequirement(action) {
    if (hasNumericClaims(action.text)) {
        if (!action.evidence || action.evidence.length === 0) {
            return 'NO_EVIDENCE_FOR_CLAIM';
        }
    }
    return null;
}
//# sourceMappingURL=rules.js.map