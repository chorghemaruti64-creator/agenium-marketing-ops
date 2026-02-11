/**
 * Telegram platform connector
 */

import type { PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
import { executeWithPolicy, isCircuitOpen } from './base.js';

async function executeTelegram(
  action: PlatformAction,
  config: ConnectorConfig
): Promise<PlatformResult> {
  const creds = config.credentials.telegram;
  if (!creds) {
    return {
      success: false,
      platform: 'telegram',
      actionType: action.actionType,
      error: 'No Telegram credentials configured',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  const { botToken, channelId } = creds;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: channelId,
    text: action.content,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
  };

  // If replying to a message
  if (action.parentId) {
    body.reply_to_message_id = parseInt(action.parentId, 10);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json() as { ok: boolean; result?: { message_id: number }; description?: string };

  if (!data.ok) {
    return {
      success: false,
      platform: 'telegram',
      actionType: action.actionType,
      error: data.description || 'Unknown Telegram error',
      retryable: response.status >= 500 || response.status === 429,
      timestamp: new Date().toISOString(),
    };
  }

  const messageId = data.result?.message_id;
  return {
    success: true,
    platform: 'telegram',
    actionType: action.actionType,
    postId: String(messageId),
    postUrl: `https://t.me/c/${channelId.replace('-100', '')}/${messageId}`,
    retryable: false,
    timestamp: new Date().toISOString(),
  };
}

export async function postToTelegram(
  action: PlatformAction,
  config: ConnectorConfig
): Promise<PlatformResult> {
  // Check circuit breaker
  if (await isCircuitOpen(config.storeDb, 'telegram')) {
    return {
      success: false,
      platform: 'telegram',
      actionType: action.actionType,
      error: 'Circuit breaker open - platform temporarily disabled',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  return executeWithPolicy(action, config, executeTelegram);
}
