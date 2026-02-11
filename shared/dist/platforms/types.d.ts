/**
 * Platform connector types
 */
export type Platform = 'github' | 'telegram' | 'x' | 'reddit' | 'hn' | 'discord';
export interface PlatformCredentials {
    github?: {
        token: string;
        owner: string;
        repo: string;
    };
    telegram?: {
        botToken: string;
        channelId: string;
    };
    x?: {
        apiKey: string;
        apiSecret: string;
        accessToken: string;
        accessSecret: string;
    };
    reddit?: {
        clientId: string;
        clientSecret: string;
        username: string;
        password: string;
        subreddit: string;
    };
    hn?: {
        username: string;
        password: string;
    };
    discord?: {
        webhookUrl: string;
    };
}
export type ActionType = 'post' | 'reply' | 'comment' | 'discussion';
export interface PlatformAction {
    platform: Platform;
    actionType: ActionType;
    content: string;
    title?: string;
    parentId?: string;
    metadata?: Record<string, unknown>;
    fingerprint: string;
    traceId: string;
}
export interface PlatformResult {
    success: boolean;
    platform: Platform;
    actionType: ActionType;
    postId?: string;
    postUrl?: string;
    error?: string;
    retryable: boolean;
    timestamp: string;
}
export interface ConnectorConfig {
    credentials: PlatformCredentials;
    moltbookDir: string;
    storeDb: string;
    dryRun?: boolean;
}
//# sourceMappingURL=types.d.ts.map