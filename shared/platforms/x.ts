/**
 * X (Twitter) platform connector
 * Uses Twitter API v2 with OAuth 1.0a
 */

import crypto from 'crypto';
import type { PlatformAction, PlatformResult, ConnectorConfig } from './types.js';
import { executeWithPolicy, isCircuitOpen } from './base.js';

interface OAuthCreds {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Generate OAuth 1.0a signature
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  creds: OAuthCreds
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(creds.apiSecret)}&${encodeURIComponent(creds.accessSecret)}`;
  return crypto
    .createHmac('sha1', signingKey)
    .update(signatureBase)
    .digest('base64');
}

/**
 * Build OAuth 1.0a Authorization header
 */
function buildOAuthHeader(
  method: string,
  url: string,
  creds: OAuthCreds,
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...extraParams };
  const signature = generateOAuthSignature(method, url, allParams, creds);
  oauthParams.oauth_signature = signature;

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

async function executeX(
  action: PlatformAction,
  config: ConnectorConfig
): Promise<PlatformResult> {
  const creds = config.credentials.x;
  if (!creds) {
    return {
      success: false,
      platform: 'x',
      actionType: action.actionType,
      error: 'No X (Twitter) credentials configured',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  // Validate content length (280 chars for X)
  if (action.content.length > 280) {
    return {
      success: false,
      platform: 'x',
      actionType: action.actionType,
      error: `Content too long: ${action.content.length}/280 characters`,
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  const url = 'https://api.twitter.com/2/tweets';
  const body: Record<string, unknown> = {
    text: action.content,
  };

  // If replying to a tweet
  if (action.parentId) {
    body.reply = { in_reply_to_tweet_id: action.parentId };
  }

  const authHeader = buildOAuthHeader('POST', url, creds);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json() as {
    data?: { id: string; text: string };
    errors?: { message: string; code: number }[];
    detail?: string;
  };

  if (!response.ok || data.errors) {
    const error = data.errors?.[0]?.message || data.detail || `HTTP ${response.status}`;
    return {
      success: false,
      platform: 'x',
      actionType: action.actionType,
      error,
      retryable: response.status === 429 || response.status >= 500,
      timestamp: new Date().toISOString(),
    };
  }

  if (!data.data) {
    return {
      success: false,
      platform: 'x',
      actionType: action.actionType,
      error: 'No tweet data returned',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    success: true,
    platform: 'x',
    actionType: action.actionType,
    postId: data.data.id,
    postUrl: `https://x.com/i/status/${data.data.id}`,
    retryable: false,
    timestamp: new Date().toISOString(),
  };
}

export async function postToX(
  action: PlatformAction,
  config: ConnectorConfig
): Promise<PlatformResult> {
  if (await isCircuitOpen(config.storeDb, 'x')) {
    return {
      success: false,
      platform: 'x',
      actionType: action.actionType,
      error: 'Circuit breaker open - platform temporarily disabled',
      retryable: false,
      timestamp: new Date().toISOString(),
    };
  }

  return executeWithPolicy(action, config, executeX);
}
