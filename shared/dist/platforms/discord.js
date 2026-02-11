/**
 * Discord platform connector (webhook-based)
 */
import { executeWithPolicy, isCircuitOpen } from './base.js';
async function executeDiscord(action, config) {
    const creds = config.credentials.discord;
    if (!creds) {
        return {
            success: false,
            platform: 'discord',
            actionType: action.actionType,
            error: 'No Discord webhook configured',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const { webhookUrl } = creds;
    const body = {
        content: action.content,
    };
    // Add embed if title provided
    if (action.title) {
        body.embeds = [{
                title: action.title,
                description: action.content,
                color: 0x5865F2, // Discord blurple
            }];
        delete body.content; // Use embed instead
    }
    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    // Discord webhooks return 204 No Content on success
    if (!response.ok) {
        const errorText = await response.text();
        return {
            success: false,
            platform: 'discord',
            actionType: action.actionType,
            error: `Discord error: ${response.status} - ${errorText}`,
            retryable: response.status >= 500 || response.status === 429,
            timestamp: new Date().toISOString(),
        };
    }
    return {
        success: true,
        platform: 'discord',
        actionType: action.actionType,
        postId: `webhook-${Date.now()}`,
        postUrl: webhookUrl.split('/').slice(0, -2).join('/'), // Base channel URL
        retryable: false,
        timestamp: new Date().toISOString(),
    };
}
export async function postToDiscord(action, config) {
    // Check circuit breaker
    if (await isCircuitOpen(config.storeDb, 'discord')) {
        return {
            success: false,
            platform: 'discord',
            actionType: action.actionType,
            error: 'Circuit breaker open - platform temporarily disabled',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    return executeWithPolicy(action, config, executeDiscord);
}
//# sourceMappingURL=discord.js.map