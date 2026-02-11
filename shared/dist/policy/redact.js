/**
 * Secret Redaction Module
 * Detects and redacts sensitive information from content
 */
// Patterns for detecting secrets
const SECRET_PATTERNS = [
    // API Keys and Tokens
    {
        name: 'github_token',
        pattern: /\b(ghp_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59})\b/g,
        replacement: '[GITHUB_TOKEN]'
    },
    {
        name: 'openai_key',
        pattern: /\b(sk-[a-zA-Z0-9]{48})\b/g,
        replacement: '[OPENAI_KEY]'
    },
    {
        name: 'anthropic_key',
        pattern: /\b(sk-ant-[a-zA-Z0-9-]{95})\b/g,
        replacement: '[ANTHROPIC_KEY]'
    },
    {
        name: 'aws_key',
        pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
        replacement: '[AWS_KEY]'
    },
    {
        name: 'aws_secret',
        pattern: /\b([a-zA-Z0-9+/]{40})\b/g,
        replacement: '[AWS_SECRET]'
    },
    {
        name: 'telegram_token',
        pattern: /\b(\d{8,10}:[a-zA-Z0-9_-]{35})\b/g,
        replacement: '[TELEGRAM_TOKEN]'
    },
    {
        name: 'discord_token',
        pattern: /\b([MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27})\b/g,
        replacement: '[DISCORD_TOKEN]'
    },
    {
        name: 'slack_token',
        pattern: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*)\b/g,
        replacement: '[SLACK_TOKEN]'
    },
    // Private Keys
    {
        name: 'private_key',
        pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
        replacement: '[PRIVATE_KEY]'
    },
    {
        name: 'ssh_key',
        pattern: /\b(ssh-(rsa|ed25519|ecdsa) AAAA[0-9A-Za-z+/]+[=]{0,3})\b/g,
        replacement: '[SSH_KEY]'
    },
    // Passwords and secrets in common formats
    {
        name: 'password_field',
        pattern: /(password|passwd|pwd|secret|token|api_key|apikey|auth)[\s]*[:=][\s]*["']?([^\s"'\n]{8,})["']?/gi,
        replacement: '$1=[REDACTED]'
    },
    {
        name: 'bearer_token',
        pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/gi,
        replacement: 'Bearer [REDACTED]'
    },
    // Connection strings
    {
        name: 'connection_string',
        pattern: /(mongodb|postgres|mysql|redis|amqp):\/\/[^\s]+/gi,
        replacement: '[CONNECTION_STRING]'
    },
    // Internal IPs
    {
        name: 'internal_ip',
        pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
        replacement: '[INTERNAL_IP]'
    },
    // JWT tokens
    {
        name: 'jwt',
        pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
        replacement: '[JWT_TOKEN]'
    },
    // Hex secrets (32+ chars)
    {
        name: 'hex_secret',
        pattern: /\b([a-f0-9]{32,})\b/gi,
        replacement: '[HEX_SECRET]'
    },
];
/**
 * Redact sensitive information from text
 */
export function redactSecrets(text) {
    let redacted = text;
    const secretTypes = [];
    for (const { name, pattern, replacement } of SECRET_PATTERNS) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            secretTypes.push(name);
            // Reset again after test
            pattern.lastIndex = 0;
            redacted = redacted.replace(pattern, replacement);
        }
    }
    return {
        redacted,
        hasSecrets: secretTypes.length > 0,
        secretTypes,
    };
}
/**
 * Check if text contains secrets without redacting
 */
export function containsSecrets(text) {
    for (const { pattern } of SECRET_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=redact.js.map