/**
 * Secret Redaction Module
 * Detects and redacts sensitive information from content
 */
export interface RedactionResult {
    redacted: string;
    hasSecrets: boolean;
    secretTypes: string[];
}
/**
 * Redact sensitive information from text
 */
export declare function redactSecrets(text: string): RedactionResult;
/**
 * Check if text contains secrets without redacting
 */
export declare function containsSecrets(text: string): boolean;
//# sourceMappingURL=redact.d.ts.map