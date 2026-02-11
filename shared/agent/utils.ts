/**
 * Shared agent utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID, createHash } from 'crypto';
import type { PlatformCredentials } from '../platforms/types.js';

export interface AgentConfig {
  agentName: string;
  workspaceDir: string;
  moltbookDir: string;
  configDir: string;
  logsDir: string;
  storeDb: string;
  credentials: PlatformCredentials;
  dryRun: boolean;
  runOnce: boolean;
}

/**
 * Load agent configuration from environment
 */
export function loadAgentConfig(agentName: string): AgentConfig {
  return {
    agentName,
    workspaceDir: process.env.WORKSPACE_DIR || '/workspace',
    moltbookDir: process.env.MOLTBOOK_DIR || '/moltbook',
    configDir: process.env.CONFIG_DIR || '/config',
    logsDir: process.env.LOGS_DIR || '/logs',
    storeDb: process.env.STORE_DB || '/workspace/store.db',
    credentials: loadCredentials(),
    dryRun: process.env.DRY_RUN === 'true',
    runOnce: process.env.RUN_ONCE === 'true',
  };
}

/**
 * Load platform credentials from environment
 */
function loadCredentials(): PlatformCredentials {
  return {
    github: process.env.GITHUB_TOKEN ? {
      token: process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER || '',
      repo: process.env.GITHUB_REPO || '',
    } : undefined,

    telegram: process.env.TELEGRAM_BOT_TOKEN ? {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      channelId: process.env.TELEGRAM_CHANNEL_ID || '',
    } : undefined,

    x: process.env.X_API_KEY ? {
      apiKey: process.env.X_API_KEY,
      apiSecret: process.env.X_API_SECRET || '',
      accessToken: process.env.X_ACCESS_TOKEN || '',
      accessSecret: process.env.X_ACCESS_SECRET || '',
    } : undefined,

    reddit: process.env.REDDIT_CLIENT_ID ? {
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET || '',
      username: process.env.REDDIT_USERNAME || '',
      password: process.env.REDDIT_PASSWORD || '',
      subreddit: process.env.REDDIT_SUBREDDIT || '',
    } : undefined,

    hn: process.env.HN_USERNAME ? {
      username: process.env.HN_USERNAME,
      password: process.env.HN_PASSWORD || '',
    } : undefined,

    discord: process.env.DISCORD_WEBHOOK_URL ? {
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    } : undefined,
  };
}

/**
 * Check if STOP_ALL kill switch is active
 */
export function isStopAll(configDir: string): boolean {
  const stopFile = path.join(configDir, 'STOP_ALL');
  return fs.existsSync(stopFile);
}

/**
 * Check PUBLISH_ENABLED env
 */
export function isPublishEnabled(): boolean {
  return process.env.PUBLISH_ENABLED !== 'false';
}

/**
 * Generate a trace ID for correlating events
 */
export function generateTraceId(): string {
  return `trace-${randomUUID().split('-')[0]}`;
}

/**
 * Generate a fingerprint for content deduplication
 */
export function generateFingerprint(content: string, platform: string): string {
  return createHash('sha256')
    .update(`${platform}:${content}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ensure directory exists
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write file with parent directory creation
 */
export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Read file or return null
 */
export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * List files in directory matching pattern
 */
export function listFiles(dir: string, pattern?: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  if (pattern) {
    return files.filter(f => pattern.test(f));
  }
  return files;
}

/**
 * Simple health check server
 */
export async function startHealthServer(port: number, agentName: string): Promise<void> {
  const http = await import('http');
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        agent: agentName,
        timestamp: new Date().toISOString(),
      }));
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  server.listen(port, () => {
    console.log(`[${agentName}] Health server on port ${port}`);
  });
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
