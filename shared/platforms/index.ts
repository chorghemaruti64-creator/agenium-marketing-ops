/**
 * Platform connectors index
 */

export * from './types.js';
export * from './base.js';
export { postToGitHub } from './github.js';
export { postToTelegram } from './telegram.js';
export { postToX } from './x.js';
export { postToReddit } from './reddit.js';
export { postToHN, generateHNDraft } from './hn.js';
export { postToDiscord } from './discord.js';

import type { Platform, PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
import { postToGitHub } from './github.js';
import { postToTelegram } from './telegram.js';
import { postToX } from './x.js';
import { postToReddit } from './reddit.js';
import { postToHN } from './hn.js';
import { postToDiscord } from './discord.js';

/**
 * Unified platform dispatcher
 */
export async function postToPlatform(
  action: PlatformAction,
  config: ConnectorConfig
): Promise<PlatformResult> {
  const handlers: Record<Platform, typeof postToGitHub> = {
    github: postToGitHub,
    telegram: postToTelegram,
    x: postToX,
    reddit: postToReddit,
    hn: postToHN,
    discord: postToDiscord,
  };

  const handler = handlers[action.platform];
  if (!handler) {
    return {
      success: false,
      platform: action.platform,
      actionType: action.actionType,
      error: `Unknown platform: ${action.platform}`,
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  return handler(action, config);
}

/**
 * Check which platforms have credentials configured
 */
export function getConfiguredPlatforms(config: ConnectorConfig): Platform[] {
  const platforms: Platform[] = [];
  const { credentials } = config;

  if (credentials.github?.token) platforms.push('github');
  if (credentials.telegram?.botToken) platforms.push('telegram');
  if (credentials.x?.apiKey) platforms.push('x');
  if (credentials.reddit?.clientId) platforms.push('reddit');
  if (credentials.hn?.username) platforms.push('hn');
  if (credentials.discord?.webhookUrl) platforms.push('discord');

  return platforms;
}
