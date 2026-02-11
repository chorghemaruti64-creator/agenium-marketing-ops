/**
 * Distribution Agent
 * Publishes approved content to platforms with preflight validation
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  loadAgentConfig,
  isStopAll,
  isPublishEnabled,
  today,
  ensureDir,
  writeFile,
  readFile,
  listFiles,
  startHealthServer,
  generateTraceId,
  generateFingerprint,
} from '../../shared/agent/utils.js';
import { logAgentAction, logError, logCircuitBreaker } from '../../shared/moltbook/ledger.js';
import {
  postToPlatform,
  getConfiguredPlatforms,
  type PlatformAction,
  type ConnectorConfig,
  type Platform,
} from '../../shared/platforms/index.js';
import { runPreflight, getValidPlatforms } from '../../shared/platforms/preflight.js';

const AGENT_NAME = 'distribution';

interface ContentDraft {
  id: string;
  platform: string;
  type: string;
  topic: string;
  title?: string;
  content: string;
  hashtags: string[];
  createdAt: string;
  status: 'draft' | 'approved' | 'published' | 'failed';
  publishedAt?: string;
  postUrl?: string;
  error?: string;
}

interface PostBudget {
  posts: number;
  replies: number;
}

/**
 * Get post budget from environment
 */
function getPostBudget(): PostBudget {
  return {
    posts: parseInt(process.env.MAX_LIVE_POSTS_PER_PLATFORM || '1', 10),
    replies: parseInt(process.env.MAX_LIVE_REPLIES_PER_PLATFORM || '2', 10),
  };
}

/**
 * Track posts per platform to enforce budget
 */
const postCounts: Map<string, { posts: number; replies: number }> = new Map();

function canPost(platform: string, type: string, budget: PostBudget): boolean {
  const counts = postCounts.get(platform) || { posts: 0, replies: 0 };
  
  if (type === 'reply' || type === 'comment') {
    return counts.replies < budget.replies;
  }
  return counts.posts < budget.posts;
}

function recordPost(platform: string, type: string): void {
  const counts = postCounts.get(platform) || { posts: 0, replies: 0 };
  
  if (type === 'reply' || type === 'comment') {
    counts.replies++;
  } else {
    counts.posts++;
  }
  
  postCounts.set(platform, counts);
}

async function run(): Promise<void> {
  const config = loadAgentConfig(AGENT_NAME);
  const traceId = generateTraceId();
  const budget = getPostBudget();

  console.log(`[${AGENT_NAME}] Starting...`);
  console.log(`[${AGENT_NAME}] DRY_RUN: ${config.dryRun}`);
  console.log(`[${AGENT_NAME}] PUBLISH_ENABLED: ${isPublishEnabled()}`);
  console.log(`[${AGENT_NAME}] Post budget: ${budget.posts} posts, ${budget.replies} replies per platform`);

  if (isStopAll(config.configDir)) {
    console.log(`[${AGENT_NAME}] STOP_ALL active, exiting`);
    process.exit(0);
  }

  if (!isPublishEnabled()) {
    console.log(`[${AGENT_NAME}] PUBLISH_ENABLED=false, skipping publishing`);
    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      fingerprint: `dist-skip-${today()}`,
      traceId,
      status: 'skipped',
      summary: 'Publishing disabled via PUBLISH_ENABLED=false',
      data: {},
    });
    return;
  }

  try {
    const date = today();
    const draftsDir = path.join(config.workspaceDir, 'content', 'drafts', date);
    const postsDir = path.join(config.workspaceDir, 'distribution', 'posts', date);

    // Build connector config
    const connectorConfig: ConnectorConfig = {
      credentials: config.credentials,
      moltbookDir: config.moltbookDir,
      storeDb: config.storeDb,
      dryRun: config.dryRun,
    };

    // Run preflight checks
    console.log(`[${AGENT_NAME}] Running preflight checks...`);
    const storeDir = path.dirname(config.storeDb);
    const preflightResults = await runPreflight(
      config.credentials,
      config.moltbookDir,
      storeDir
    );

    const validPlatforms = getValidPlatforms(preflightResults);
    console.log(`[${AGENT_NAME}] Valid platforms: ${validPlatforms.join(', ') || 'none'}`);

    // Log preflight results
    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      fingerprint: `preflight-${date}`,
      traceId,
      status: validPlatforms.length > 0 ? 'success' : 'failed',
      summary: `Preflight: ${validPlatforms.length} platforms ready`,
      data: {
        valid: validPlatforms,
        failed: Array.from(preflightResults.entries())
          .filter(([_, r]) => !r.valid)
          .map(([p, r]) => ({ platform: p, reason: r.reason, error: r.error })),
      },
    });

    if (validPlatforms.length === 0) {
      console.log(`[${AGENT_NAME}] No valid platforms, nothing to publish`);
      return;
    }

    // Find draft files
    const draftFiles = listFiles(draftsDir, /\.json$/);
    if (draftFiles.length === 0) {
      console.log(`[${AGENT_NAME}] No drafts found for ${date}`);
      return;
    }

    ensureDir(postsDir);
    let published = 0;
    let skipped = 0;
    let failed = 0;
    const permalinks: Array<{ platform: string; url: string }> = [];

    for (const draftFile of draftFiles) {
      const draftPath = path.join(draftsDir, draftFile);
      const draftContent = readFile(draftPath);
      if (!draftContent) continue;

      const draft: ContentDraft = JSON.parse(draftContent);
      const platform = draft.platform as Platform;

      // Skip already processed
      if (draft.status === 'published' || draft.status === 'failed') {
        skipped++;
        continue;
      }

      // Skip if platform not valid
      if (!validPlatforms.includes(platform)) {
        console.log(`[${AGENT_NAME}] Skipping ${draft.id}: ${platform} not validated`);
        skipped++;
        continue;
      }

      // Check budget
      if (!canPost(platform, draft.type, budget)) {
        console.log(`[${AGENT_NAME}] Skipping ${draft.id}: budget exhausted for ${platform}`);
        skipped++;
        continue;
      }

      // Auto-approve drafts (no human approval needed per spec)
      draft.status = 'approved';

      // Build platform action
      const action: PlatformAction = {
        platform,
        actionType: mapDraftTypeToPlatformAction(draft.type),
        content: draft.content,
        title: draft.title,
        fingerprint: generateFingerprint(draft.content, platform),
        traceId,
      };

      console.log(`[${AGENT_NAME}] Publishing ${draft.id} to ${platform}...`);

      // Execute via platform connector (policy + Moltbook wiring included)
      const result = await postToPlatform(action, connectorConfig);

      if (result.success) {
        draft.status = 'published';
        draft.publishedAt = result.timestamp;
        draft.postUrl = result.postUrl;
        published++;
        recordPost(platform, draft.type);
        
        if (result.postUrl) {
          permalinks.push({ platform, url: result.postUrl });
        }
        
        console.log(`[${AGENT_NAME}] ✓ Published: ${result.postUrl || result.postId}`);
      } else {
        draft.status = 'failed';
        draft.error = result.error;
        failed++;
        console.log(`[${AGENT_NAME}] ✗ Failed: ${result.error}`);
      }

      // Update draft file
      writeFile(draftPath, JSON.stringify(draft, null, 2));

      // Write post record
      const postPath = path.join(postsDir, `${draft.id}.json`);
      writeFile(postPath, JSON.stringify({
        ...draft,
        result,
      }, null, 2));
    }

    // Log summary
    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      actionType: 'distribute',
      fingerprint: `distribute-${date}-${Date.now()}`,
      traceId,
      status: failed > 0 && published === 0 ? 'failed' : 'success',
      summary: `Distribution: ${published} published, ${skipped} skipped, ${failed} failed`,
      data: { 
        published, 
        skipped, 
        failed, 
        date,
        permalinks,
        budget,
      },
      links: permalinks.map(p => p.url),
    });

    console.log(`[${AGENT_NAME}] Done: ${published} published, ${skipped} skipped, ${failed} failed`);
    
    if (permalinks.length > 0) {
      console.log(`[${AGENT_NAME}] Permalinks:`);
      for (const { platform, url } of permalinks) {
        console.log(`  - ${platform}: ${url}`);
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${AGENT_NAME}] Error:`, error);

    await logError(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      fingerprint: `error-${Date.now()}`,
      traceId,
      status: 'error',
      summary: `Distribution agent error: ${error}`,
      data: { error },
    });

    process.exit(1);
  }
}

function mapDraftTypeToPlatformAction(type: string): 'post' | 'reply' | 'comment' | 'discussion' {
  const mapping: Record<string, 'post' | 'reply' | 'comment' | 'discussion'> = {
    announcement: 'post',
    thread: 'post',
    summary: 'post',
    embed: 'post',
    casual: 'post',
    discussion: 'discussion',
    post: 'post',
    reply: 'reply',
    comment: 'comment',
  };
  return mapping[type] || 'post';
}

// Main
const config = loadAgentConfig(AGENT_NAME);

if (config.runOnce) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  startHealthServer(3003, AGENT_NAME);
  run();
  setInterval(run, 30 * 60 * 1000); // Run every 30 min
}
