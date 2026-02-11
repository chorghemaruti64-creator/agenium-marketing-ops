/**
 * Platform Credential Preflight Validation
 * Tests credentials before attempting posts
 */

import type { Platform, PlatformCredentials, ConnectorConfig } from './types.js';
import { logCircuitBreaker, logAgentAction } from '../moltbook/ledger.js';
import * as fs from 'fs';
import * as path from 'path';

export interface PreflightResult {
  platform: Platform;
  valid: boolean;
  error?: string;
  reason?: 'UNSUPPORTED_AUTH' | 'AUTH_FAILED' | 'RATE_LIMITED' | 'NETWORK_ERROR';
}

/**
 * Validate GitHub credentials
 */
async function validateGitHub(creds: NonNullable<PlatformCredentials['github']>): Promise<PreflightResult> {
  if (!creds.token) {
    return { platform: 'github', valid: false, error: 'No token', reason: 'UNSUPPORTED_AUTH' };
  }

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${creds.token}`,
        'Accept': 'application/vnd.github+json',
      },
    });

    if (res.status === 401) {
      return { platform: 'github', valid: false, error: 'Invalid token', reason: 'AUTH_FAILED' };
    }
    if (res.status === 403) {
      return { platform: 'github', valid: false, error: 'Rate limited or forbidden', reason: 'RATE_LIMITED' };
    }
    if (!res.ok) {
      return { platform: 'github', valid: false, error: `HTTP ${res.status}`, reason: 'NETWORK_ERROR' };
    }

    return { platform: 'github', valid: true };
  } catch (err) {
    return { platform: 'github', valid: false, error: String(err), reason: 'NETWORK_ERROR' };
  }
}

/**
 * Validate Telegram credentials
 */
async function validateTelegram(creds: NonNullable<PlatformCredentials['telegram']>): Promise<PreflightResult> {
  if (!creds.botToken) {
    return { platform: 'telegram', valid: false, error: 'No bot token', reason: 'UNSUPPORTED_AUTH' };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${creds.botToken}/getMe`);
    const data = await res.json() as { ok: boolean; description?: string };

    if (!data.ok) {
      return { platform: 'telegram', valid: false, error: data.description || 'Invalid token', reason: 'AUTH_FAILED' };
    }

    return { platform: 'telegram', valid: true };
  } catch (err) {
    return { platform: 'telegram', valid: false, error: String(err), reason: 'NETWORK_ERROR' };
  }
}

/**
 * Validate X (Twitter) credentials
 */
async function validateX(creds: NonNullable<PlatformCredentials['x']>): Promise<PreflightResult> {
  if (!creds.apiKey || !creds.accessToken) {
    return { platform: 'x', valid: false, error: 'Missing API credentials', reason: 'UNSUPPORTED_AUTH' };
  }

  // X API validation requires OAuth signature which is complex
  // For now, just check that credentials are non-empty
  if (creds.apiKey.length < 10 || creds.accessToken.length < 10) {
    return { platform: 'x', valid: false, error: 'Credentials too short', reason: 'UNSUPPORTED_AUTH' };
  }

  return { platform: 'x', valid: true };
}

/**
 * Validate Reddit credentials
 */
async function validateReddit(creds: NonNullable<PlatformCredentials['reddit']>): Promise<PreflightResult> {
  if (!creds.clientId || !creds.clientSecret) {
    return { platform: 'reddit', valid: false, error: 'Missing client credentials', reason: 'UNSUPPORTED_AUTH' };
  }

  try {
    const auth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    const res = await fetch('https://www.reddit.com/api/v1/access_token', {
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

    const data = await res.json() as { access_token?: string; error?: string };

    if (data.error || !data.access_token) {
      return { platform: 'reddit', valid: false, error: data.error || 'Auth failed', reason: 'AUTH_FAILED' };
    }

    return { platform: 'reddit', valid: true };
  } catch (err) {
    return { platform: 'reddit', valid: false, error: String(err), reason: 'NETWORK_ERROR' };
  }
}

/**
 * Validate Discord webhook
 */
async function validateDiscord(creds: NonNullable<PlatformCredentials['discord']>): Promise<PreflightResult> {
  if (!creds.webhookUrl) {
    return { platform: 'discord', valid: false, error: 'No webhook URL', reason: 'UNSUPPORTED_AUTH' };
  }

  try {
    // GET webhook info (doesn't post anything)
    const res = await fetch(creds.webhookUrl);
    
    if (res.status === 401 || res.status === 404) {
      return { platform: 'discord', valid: false, error: 'Invalid webhook', reason: 'AUTH_FAILED' };
    }
    if (!res.ok) {
      return { platform: 'discord', valid: false, error: `HTTP ${res.status}`, reason: 'NETWORK_ERROR' };
    }

    return { platform: 'discord', valid: true };
  } catch (err) {
    return { platform: 'discord', valid: false, error: String(err), reason: 'NETWORK_ERROR' };
  }
}

/**
 * Validate HN credentials (always fails - no API)
 */
async function validateHN(_creds: NonNullable<PlatformCredentials['hn']>): Promise<PreflightResult> {
  return { platform: 'hn', valid: false, error: 'HN has no posting API', reason: 'UNSUPPORTED_AUTH' };
}

/**
 * Run preflight checks for all platforms
 */
export async function runPreflight(
  credentials: PlatformCredentials,
  moltbookDir: string,
  storeDir: string
): Promise<Map<Platform, PreflightResult>> {
  const results = new Map<Platform, PreflightResult>();

  // Check enable flags from environment
  const enableFlags: Record<Platform, boolean> = {
    github: process.env.ENABLE_GITHUB !== 'false',
    telegram: process.env.ENABLE_TELEGRAM !== 'false',
    x: process.env.ENABLE_X !== 'false',
    reddit: process.env.ENABLE_REDDIT !== 'false',
    discord: process.env.ENABLE_DISCORD !== 'false',
    hn: process.env.ENABLE_HN === 'true', // Default false
  };

  // Validate each platform
  if (enableFlags.github && credentials.github) {
    results.set('github', await validateGitHub(credentials.github));
  } else if (!credentials.github) {
    results.set('github', { platform: 'github', valid: false, error: 'No credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  if (enableFlags.telegram && credentials.telegram) {
    results.set('telegram', await validateTelegram(credentials.telegram));
  } else if (!credentials.telegram) {
    results.set('telegram', { platform: 'telegram', valid: false, error: 'No credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  if (enableFlags.x && credentials.x) {
    results.set('x', await validateX(credentials.x));
  } else if (!credentials.x) {
    results.set('x', { platform: 'x', valid: false, error: 'No credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  if (enableFlags.reddit && credentials.reddit) {
    results.set('reddit', await validateReddit(credentials.reddit));
  } else if (!credentials.reddit) {
    results.set('reddit', { platform: 'reddit', valid: false, error: 'No credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  if (enableFlags.discord && credentials.discord) {
    results.set('discord', await validateDiscord(credentials.discord));
  } else if (!credentials.discord) {
    results.set('discord', { platform: 'discord', valid: false, error: 'No credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  if (enableFlags.hn && credentials.hn) {
    results.set('hn', await validateHN(credentials.hn));
  } else {
    results.set('hn', { platform: 'hn', valid: false, error: 'Disabled or no credentials', reason: 'UNSUPPORTED_AUTH' });
  }

  // Open circuit breakers for failed platforms
  for (const [platform, result] of results) {
    if (!result.valid) {
      await openCircuitBreaker(platform, result, moltbookDir, storeDir);
    }
  }

  return results;
}

/**
 * Open circuit breaker for a platform
 */
async function openCircuitBreaker(
  platform: Platform,
  result: PreflightResult,
  moltbookDir: string,
  storeDir: string
): Promise<void> {
  const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours
  const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();

  // Write circuit breaker file
  const circuitFile = path.join(storeDir, `circuit_${platform}.lock`);
  try {
    fs.mkdirSync(path.dirname(circuitFile), { recursive: true });
    fs.writeFileSync(circuitFile, String(Date.now() + cooldownMs));
  } catch {}

  // Log to Moltbook using agent-friendly function
  await logAgentAction(moltbookDir, {
    sourceAgent: 'distribution',
    platform,
    fingerprint: `circuit-${platform}-${Date.now()}`,
    status: 'blocked',
    summary: `Circuit breaker OPENED for ${platform}: ${result.reason}`,
    data: {
      event_type: 'CIRCUIT_BREAKER_OPENED',
      reason: result.reason,
      error: result.error,
      cooldown_until: cooldownUntil,
    },
  });

  console.log(`[preflight] Circuit breaker OPENED for ${platform}: ${result.reason} - ${result.error}`);
}

/**
 * Get platforms that passed preflight
 */
export function getValidPlatforms(results: Map<Platform, PreflightResult>): Platform[] {
  const valid: Platform[] = [];
  for (const [platform, result] of results) {
    if (result.valid) {
      valid.push(platform);
    }
  }
  return valid;
}
