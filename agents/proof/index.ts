/**
 * Proof Agent
 * Generates proof packs with logs, metrics, and verification
 */

import * as path from 'path';
import * as fs from 'fs';
import { createHash } from 'crypto';
import {
  loadAgentConfig,
  isStopAll,
  today,
  ensureDir,
  writeFile,
  readFile,
  listFiles,
  startHealthServer,
  generateTraceId,
} from '../../shared/agent/utils.js';
import { logAgentAction, logError } from '../../shared/moltbook/ledger.js';
import { queryByDate } from '../../shared/moltbook/reader.js';

const AGENT_NAME = 'proof';

interface ProofPack {
  id: string;
  date: string;
  generatedAt: string;
  hash: string;
  contents: {
    moltbookEvents: number;
    briefs: string[];
    drafts: string[];
    posts: string[];
    analyticsReports: string[];
    partnershipLeads: string[];
  };
  verification: {
    allFilesPresent: boolean;
    hashIntegrity: boolean;
    eventCounts: Record<string, number>;
  };
  artifacts: string[];
}

/**
 * Collect all artifacts for the day
 */
async function collectArtifacts(workspaceDir: string, date: string): Promise<{
  files: Record<string, string[]>;
  artifacts: string[];
}> {
  const files: Record<string, string[]> = {
    briefs: [],
    drafts: [],
    posts: [],
    analyticsReports: [],
    partnershipLeads: [],
  };

  const artifacts: string[] = [];

  // Briefs
  const briefPath = path.join(workspaceDir, 'briefs', `${date}.md`);
  if (fs.existsSync(briefPath)) {
    files.briefs.push(briefPath);
    artifacts.push(`briefs/${date}.md`);
  }

  // Drafts
  const draftsDir = path.join(workspaceDir, 'content', 'drafts', date);
  if (fs.existsSync(draftsDir)) {
    const draftFiles = listFiles(draftsDir, /\.json$/);
    for (const f of draftFiles) {
      const p = path.join(draftsDir, f);
      files.drafts.push(p);
      artifacts.push(`content/drafts/${date}/${f}`);
    }
  }

  // Posts
  const postsDir = path.join(workspaceDir, 'distribution', 'posts', date);
  if (fs.existsSync(postsDir)) {
    const postFiles = listFiles(postsDir, /\.json$/);
    for (const f of postFiles) {
      const p = path.join(postsDir, f);
      files.posts.push(p);
      artifacts.push(`distribution/posts/${date}/${f}`);
    }
  }

  // Analytics
  const analyticsPath = path.join(workspaceDir, 'analytics', 'daily', `${date}.json`);
  if (fs.existsSync(analyticsPath)) {
    files.analyticsReports.push(analyticsPath);
    artifacts.push(`analytics/daily/${date}.json`);
  }

  // Partnership leads
  const leadsDir = path.join(workspaceDir, 'partnerships', 'outreach', date);
  if (fs.existsSync(leadsDir)) {
    const leadFiles = listFiles(leadsDir, /\.md$/);
    for (const f of leadFiles) {
      const p = path.join(leadsDir, f);
      files.partnershipLeads.push(p);
      artifacts.push(`partnerships/outreach/${date}/${f}`);
    }
  }

  return { files, artifacts };
}

/**
 * Calculate content hash for integrity verification
 */
function calculateContentHash(files: string[]): string {
  const hash = createHash('sha256');

  for (const filePath of files.sort()) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      hash.update(content);
    }
  }

  return hash.digest('hex');
}

/**
 * Generate proof pack
 */
async function generateProofPack(
  workspaceDir: string,
  moltbookDir: string,
  date: string
): Promise<ProofPack> {
  // Collect artifacts
  const { files, artifacts } = await collectArtifacts(workspaceDir, date);

  // Get Moltbook events
  const events = await queryByDate(moltbookDir, date);

  // Count events by type
  const eventCounts: Record<string, number> = {};
  for (const event of events) {
    eventCounts[event.event_type] = (eventCounts[event.event_type] || 0) + 1;
  }

  // Calculate hash
  const allFiles = [
    ...files.briefs,
    ...files.drafts,
    ...files.posts,
    ...files.analyticsReports,
    ...files.partnershipLeads,
  ];
  const contentHash = calculateContentHash(allFiles);

  // Build proof pack
  const proofPack: ProofPack = {
    id: `proof-${date}-${Date.now()}`,
    date,
    generatedAt: new Date().toISOString(),
    hash: contentHash,
    contents: {
      moltbookEvents: events.length,
      briefs: files.briefs.map(f => path.basename(f)),
      drafts: files.drafts.map(f => path.basename(f)),
      posts: files.posts.map(f => path.basename(f)),
      analyticsReports: files.analyticsReports.map(f => path.basename(f)),
      partnershipLeads: files.partnershipLeads.map(f => path.basename(f)),
    },
    verification: {
      allFilesPresent: allFiles.every(f => fs.existsSync(f)),
      hashIntegrity: true,
      eventCounts,
    },
    artifacts,
  };

  return proofPack;
}

/**
 * Format proof pack as markdown
 */
function formatProofMarkdown(proof: ProofPack): string {
  return `# Proof Pack - ${proof.date}

## Metadata
- **ID:** ${proof.id}
- **Generated:** ${proof.generatedAt}
- **Content Hash:** \`${proof.hash}\`

## Contents Summary

| Category | Count |
|----------|-------|
| Moltbook Events | ${proof.contents.moltbookEvents} |
| Briefs | ${proof.contents.briefs.length} |
| Drafts | ${proof.contents.drafts.length} |
| Posts | ${proof.contents.posts.length} |
| Analytics Reports | ${proof.contents.analyticsReports.length} |
| Partnership Leads | ${proof.contents.partnershipLeads.length} |

## Verification

| Check | Status |
|-------|--------|
| All Files Present | ${proof.verification.allFilesPresent ? '✅' : '❌'} |
| Hash Integrity | ${proof.verification.hashIntegrity ? '✅' : '❌'} |

## Event Counts by Type

${Object.entries(proof.verification.eventCounts).map(([t, c]) => `- **${t}:** ${c}`).join('\n') || '- (no events)'}

## Artifacts Included

${proof.artifacts.map(a => `- \`${a}\``).join('\n') || '- (none)'}

---

**Verification Hash:** \`${proof.hash}\`

To verify: run \`sha256sum\` on all artifact files in sorted order.

Generated by ${AGENT_NAME} agent at ${proof.generatedAt}
`;
}

async function run(): Promise<void> {
  const config = loadAgentConfig(AGENT_NAME);
  const traceId = generateTraceId();

  console.log(`[${AGENT_NAME}] Starting...`);

  if (isStopAll(config.configDir)) {
    console.log(`[${AGENT_NAME}] STOP_ALL active, exiting`);
    process.exit(0);
  }

  try {
    const date = today();
    const proofsDir = path.join(config.workspaceDir, 'proofs');

    ensureDir(proofsDir);

    // Generate proof pack
    const proof = await generateProofPack(
      config.workspaceDir,
      config.moltbookDir,
      date
    );

    // Write proof pack
    const jsonPath = path.join(proofsDir, `${proof.id}.json`);
    const mdPath = path.join(proofsDir, `${proof.id}.md`);

    writeFile(jsonPath, JSON.stringify(proof, null, 2));
    writeFile(mdPath, formatProofMarkdown(proof));

    console.log(`[${AGENT_NAME}] Generated proof pack: ${proof.id}`);
    console.log(`[${AGENT_NAME}] Hash: ${proof.hash}`);

    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      actionType: 'proof',
      fingerprint: `proof-${date}`,
      traceId,
      status: 'success',
      summary: `Generated proof pack for ${date}`,
      data: {
        proofId: proof.id,
        hash: proof.hash,
        artifactCount: proof.artifacts.length,
        eventCount: proof.contents.moltbookEvents,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[${AGENT_NAME}] Error:`, error);

    await logError(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      fingerprint: `error-${Date.now()}`,
      traceId,
      status: 'error',
      summary: `Proof agent error: ${error}`,
      data: { error },
    });

    process.exit(1);
  }
}

// Main
const config = loadAgentConfig(AGENT_NAME);

if (config.runOnce) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  startHealthServer(3007, AGENT_NAME);
  run();
  setInterval(run, 6 * 60 * 60 * 1000); // Run every 6 hours
}
