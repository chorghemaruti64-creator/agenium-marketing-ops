/**
 * Reddit platform connector
 * Uses OAuth2 password grant (script app)
 */
import { executeWithPolicy, isCircuitOpen } from './base.js';
// Token cache (in-memory, per-process)
let tokenCache = null;
/**
 * Get OAuth2 access token
 */
async function getAccessToken(creds) {
    // Check cache
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) {
        return tokenCache.accessToken;
    }
    const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'AgeniumMarketing/1.0',
        },
        body: new URLSearchParams({
            grant_type: 'password',
            username: creds.username,
            password: creds.password,
        }),
    });
    const data = await response.json();
    if (data.error || !data.access_token) {
        throw new Error(data.error || 'Failed to get Reddit token');
    }
    tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    };
    return tokenCache.accessToken;
}
async function executeReddit(action, config) {
    const creds = config.credentials.reddit;
    if (!creds) {
        return {
            success: false,
            platform: 'reddit',
            actionType: action.actionType,
            error: 'No Reddit credentials configured',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const accessToken = await getAccessToken(creds);
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'AgeniumMarketing/1.0',
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (action.actionType === 'post') {
        return submitPost(action, creds.subreddit, headers);
    }
    else if (action.actionType === 'comment' && action.parentId) {
        return submitComment(action, headers);
    }
    else {
        return {
            success: false,
            platform: 'reddit',
            actionType: action.actionType,
            error: `Unsupported action type: ${action.actionType}`,
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
}
/**
 * Submit a new post to subreddit
 */
async function submitPost(action, subreddit, headers) {
    const body = new URLSearchParams({
        sr: subreddit,
        kind: 'self', // Text post
        title: action.title || action.content.slice(0, 100),
        text: action.content,
        api_type: 'json',
    });
    const response = await fetch('https://oauth.reddit.com/api/submit', {
        method: 'POST',
        headers,
        body,
    });
    const data = await response.json();
    if (data.json?.errors?.length) {
        return {
            success: false,
            platform: 'reddit',
            actionType: 'post',
            error: data.json.errors.map(e => e.join(': ')).join('; '),
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const post = data.json?.data;
    if (!post) {
        return {
            success: false,
            platform: 'reddit',
            actionType: 'post',
            error: 'No post data returned',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    return {
        success: true,
        platform: 'reddit',
        actionType: 'post',
        postId: post.id,
        postUrl: post.url || `https://reddit.com${post.url}`,
        retryable: false,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Submit a comment
 */
async function submitComment(action, headers) {
    const body = new URLSearchParams({
        thing_id: action.parentId,
        text: action.content,
        api_type: 'json',
    });
    const response = await fetch('https://oauth.reddit.com/api/comment', {
        method: 'POST',
        headers,
        body,
    });
    const data = await response.json();
    if (data.json?.errors?.length) {
        return {
            success: false,
            platform: 'reddit',
            actionType: 'comment',
            error: data.json.errors.map(e => e.join(': ')).join('; '),
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const comment = data.json?.data?.things?.[0]?.data;
    if (!comment) {
        return {
            success: false,
            platform: 'reddit',
            actionType: 'comment',
            error: 'No comment data returned',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    return {
        success: true,
        platform: 'reddit',
        actionType: 'comment',
        postId: comment.id,
        postUrl: `https://reddit.com${comment.permalink}`,
        retryable: false,
        timestamp: new Date().toISOString(),
    };
}
export async function postToReddit(action, config) {
    if (await isCircuitOpen(config.storeDb, 'reddit')) {
        return {
            success: false,
            platform: 'reddit',
            actionType: action.actionType,
            error: 'Circuit breaker open - platform temporarily disabled',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    return executeWithPolicy(action, config, executeReddit);
}
//# sourceMappingURL=reddit.js.map