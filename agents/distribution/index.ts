/**
 * Distribution Agent
 * Publishes approved content to platforms
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
import { logAgentAction, logError } from '../../shared/moltbook/ledger.js';
import {
  postToPlatform,
  getConfiguredPlatforms,
  type PlatformAction,
  type ConnectorConfig,
} from '../../shared/platforms/index.js';

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

async function run(): Promise<void> {
  const config = loadAgentConfig(AGENT_NAME);
  const traceId = generateTraceId();

  console.log(`[${AGENT_NAME}] Starting...`);

  if (isStopAll(config.configDir)) {
    console.log(`[${AGENT_NAME}] STOP_ALL active, exiting`);
    process.exit(0);
  }

  if (!isPublishEnabled()) {
    console.log(`[${AGENT_NAME}] PUBLISH_ENABLED=false, skipping publishing`);
    return;
  }

  try {
    const date = today();
    const draftsDir = path.join(config.workspaceDir, 'content', 'drafts', date);
    const postsDir = path.join(config.workspaceDir, 'distribution', 'posts', date);

    // Get configured platforms
    const connectorConfig: ConnectorConfig = {
      credentials: config.credentials,
      moltbookDir: config.moltbookDir,
      storeDb: config.storeDb,
      dryRun: config.dryRun,
    };
    const enabledPlatforms = getConfiguredPlatforms(connectorConfig);

    console.log(`[${AGENT_NAME}] Enabled platforms: ${enabledPlatforms.join(', ') || 'none'}`);

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

    for (const draftFile of draftFiles) {
      const draftPath = path.join(draftsDir, draftFile);
      const draftContent = readFile(draftPath);
      if (!draftContent) continue;

      const draft: ContentDraft = JSON.parse(draftContent);

      // Skip already processed
      if (draft.status === 'published' || draft.status === 'failed') {
        skipped++;
        continue;
      }

      // Skip if platform not configured
      if (!enabledPlatforms.includes(draft.platform as any)) {
        console.log(`[${AGENT_NAME}] Skipping ${draft.id}: ${draft.platform} not configured`);
        skipped++;
        continue;
      }

      // Auto-approve drafts (no human approval needed per spec)
      draft.status = 'approved';

      // Build platform action
      const action: PlatformAction = {
        platform: draft.platform as any,
        actionType: mapDraftTypeToPlatformAction(draft.type),
        content: draft.content,
        title: draft.title,
        fingerprint: generateFingerprint(draft.content, draft.platform),
        traceId,
      };

      console.log(`[${AGENT_NAME}] Publishing ${draft.id} to ${draft.platform}...`);

      // Execute via platform connector (policy + Moltbook wiring included)
      const result = await postToPlatform(action, connectorConfig);

      if (result.success) {
        draft.status = 'published';
        draft.publishedAt = result.timestamp;
        draft.postUrl = result.postUrl;
        published++;
        console.log(`[${AGENT_NAME}] ✓ Published: ${result.postUrl}`);
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
      data: { published, skipped, failed, date },
    });

    console.log(`[${AGENT_NAME}] Done: ${published} published, ${skipped} skipped, ${failed} failed`);
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
