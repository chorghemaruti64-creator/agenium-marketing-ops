/**
 * Policy Engine Types
 * Core types for the autonomous marketing policy system
 */
export const DEFAULT_RATE_LIMITS = {
    x: { postsPerDay: 3, repliesPerDay: 10, commentsPerDay: 10 },
    reddit: { postsPerDay: 2, repliesPerDay: 10, commentsPerDay: 10 },
    hn: { submissionsPerDay: 1, commentsPerDay: 5, postsPerDay: 1, repliesPerDay: 5 },
    telegram: { postsPerDay: 3, repliesPerDay: 20, commentsPerDay: 20 },
    github: { discussionsPerDay: 2, commentsPerDay: 5, issuesPerDay: 2, postsPerDay: 2, repliesPerDay: 5 },
    discord: { messagesPerDay: 20, postsPerDay: 20, repliesPerDay: 20, commentsPerDay: 20 },
};
export const DEFAULT_CONFIG = {
    rateLimits: DEFAULT_RATE_LIMITS,
    quietHours: {
        start: 1, // 01:00
        end: 7, // 07:00
        timezone: 'Europe/Berlin',
    },
    riskThreshold: 70,
    dedupeDays: 7,
    killSwitchPath: '/opt/marketing-ops/config/STOP_ALL',
};
//# sourceMappingURL=types.js.map