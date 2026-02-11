/**
 * Content Agent
 * Generates marketing content drafts based on strategy briefs
 */

import * as path from 'path';
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
  generateFingerprint,
} from '../../shared/agent/utils.js';
import { logAgentAction, logError } from '../../shared/moltbook/ledger.js';
import { generateHNDraft } from '../../shared/platforms/hn.js';

const AGENT_NAME = 'content';

interface ContentDraft {
  id: string;
  platform: string;
  type: string;
  topic: string;
  title?: string;
  content: string;
  hashtags: string[];
  createdAt: string;
  status: 'draft' | 'approved' | 'published';
}

// Content templates per platform
const TEMPLATES = {
  telegram: {
    announcement: (topic: string) => `🚀 *${topic}*

The Agenium ecosystem continues to grow! Here's what's new:

• Enhanced agent:// protocol support
• Improved DNS resolution speed
• New marketplace features

Join the future of agent-to-agent communication.

🔗 Learn more: https://agenium.cloud

#Agenium #A2A #AgentProtocol`,

    summary: (topic: string) => `📊 *Weekly Recap: ${topic}*

This week in Agenium:
✅ Agent registrations up
✅ Protocol stability improved
✅ Community growing

What would you like to see next? 👇`,
  },

  x: {
    thread: (topic: string) => `🧵 Thread: ${topic}

1/ The agent:// protocol is revolutionizing how AI agents communicate.

Instead of fragmented APIs, agents can now discover and talk to each other directly.

Here's how it works 👇`,

    announcement: (topic: string) => `Big news from Agenium! 🎉

${topic}

The future of agent-to-agent communication is here.

agent:// | DNS | Marketplace

#Agenium #AI #Agents`,
  },

  discord: {
    embed: (topic: string) => `**${topic}**

Hey everyone! Quick update from the Agenium team:

We've been working hard on improving the agent:// protocol and DNS system. Here's what's new:

• Faster agent discovery
• Better error handling
• New documentation

Questions? Drop them below! 💬`,

    casual: (topic: string) => `gm frens! ☀️

${topic}

What are you building with Agenium this weekend? 👀`,
  },

  github: {
    discussion: (topic: string) => `# ${topic}

## Overview
This discussion covers recent developments in the Agenium ecosystem.

## Key Points
- The agent:// protocol enables decentralized agent discovery
- DNS-based resolution provides human-readable agent addresses
- The marketplace allows agents to acquire domains

## Resources
- [Protocol Spec](https://docs.agenium.cloud/protocol)
- [DNS System](https://docs.agenium.cloud/dns)
- [API Reference](https://docs.agenium.cloud/api)

## Discussion
What features would you like to see next? Share your thoughts below!`,
  },

  reddit: {
    post: (topic: string) => `${topic}

I've been exploring the Agenium ecosystem and wanted to share some thoughts.

**What is Agenium?**
- A protocol for agent-to-agent communication (agent://)
- DNS-based agent discovery
- Decentralized marketplace for agent domains

**Why it matters:**
As AI agents become more prevalent, they need ways to communicate directly. Agenium provides the infrastructure for this.

**Getting started:**
Check out the docs at agenium.cloud

What do you think? Would love to hear your thoughts on agent-to-agent protocols.`,
  },

  hn: {
    post: (topic: string) => generateHNDraft(
      `Exploring ${topic}\n\nThe agent:// protocol enables direct agent-to-agent communication using DNS-based discovery. This is similar to how HTTP works for web browsers, but designed specifically for AI agents.\n\nKey features:\n- Human-readable agent addresses (agent://myagent.agenium.cloud)\n- Decentralized discovery via DNS\n- Secure communication with mTLS\n\nCurious what the HN community thinks about the future of agent communication protocols.`,
      `Show HN: ${topic} - A Protocol for Agent-to-Agent Communication`
    ),
  },
};

/**
 * Generate content drafts from brief
 */
function generateDrafts(briefPath: string): ContentDraft[] {
  const briefContent = readFile(briefPath);
  if (!briefContent) return [];

  // Parse content calendar from brief
  const calendarMatch = briefContent.match(/\| Time \| Platform \| Topic \| Type \|[\s\S]*?(?=\n\n|$)/);
  if (!calendarMatch) return [];

  const lines = calendarMatch[0].split('\n').slice(2); // Skip header rows
  const drafts: ContentDraft[] = [];

  for (const line of lines) {
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length < 4) continue;

    const [, platform, topic, type] = parts;
    const platformTemplates = TEMPLATES[platform as keyof typeof TEMPLATES];
    if (!platformTemplates) continue;

    const templateFn = platformTemplates[type as keyof typeof platformTemplates];
    if (!templateFn) continue;

    const content = templateFn(topic);
    const id = `${platform}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    drafts.push({
      id,
      platform,
      type,
      topic,
      title: type === 'discussion' || type === 'post' ? `${topic}` : undefined,
      content,
      hashtags: extractHashtags(content),
      createdAt: new Date().toISOString(),
      status: 'draft',
    });
  }

  return drafts;
}

function extractHashtags(content: string): string[] {
  return (content.match(/#\w+/g) || []);
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
    // Find today's brief
    const date = today();
    const briefPath = path.join(config.workspaceDir, 'briefs', `${date}.md`);

    if (!readFile(briefPath)) {
      console.log(`[${AGENT_NAME}] No brief found for ${date}, waiting for strategy agent`);
      return;
    }

    // Check if drafts already exist for today
    const draftsDir = path.join(config.workspaceDir, 'content', 'drafts', date);
    const existingDrafts = listFiles(draftsDir, /\.json$/);

    if (existingDrafts.length > 0) {
      console.log(`[${AGENT_NAME}] Drafts already exist for ${date} (${existingDrafts.length} files)`);
      return;
    }

    // Generate drafts
    const drafts = generateDrafts(briefPath);

    if (drafts.length === 0) {
      console.log(`[${AGENT_NAME}] No content slots found in brief`);
      return;
    }

    // Write drafts
    ensureDir(draftsDir);
    for (const draft of drafts) {
      const draftPath = path.join(draftsDir, `${draft.id}.json`);
      writeFile(draftPath, JSON.stringify(draft, null, 2));

      // Also write markdown version for readability
      const mdPath = path.join(draftsDir, `${draft.id}.md`);
      writeFile(mdPath, formatDraftMarkdown(draft));
    }

    console.log(`[${AGENT_NAME}] Generated ${drafts.length} drafts`);

    // Log to Moltbook
    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      actionType: 'generate',
      fingerprint: `drafts-${date}`,
      traceId,
      status: 'success',
      summary: `Generated ${drafts.length} content drafts for ${date}`,
      data: {
        count: drafts.length,
        platforms: [...new Set(drafts.map(d => d.platform))],
        draftsDir,
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
      summary: `Content agent error: ${error}`,
      data: { error },
    });

    process.exit(1);
  }
}

function formatDraftMarkdown(draft: ContentDraft): string {
  return `# Draft: ${draft.id}

**Platform:** ${draft.platform}
**Type:** ${draft.type}
**Topic:** ${draft.topic}
**Created:** ${draft.createdAt}
**Status:** ${draft.status}

---

${draft.title ? `## ${draft.title}\n\n` : ''}${draft.content}

---

**Hashtags:** ${draft.hashtags.join(' ')}
`;
}

// Main
const config = loadAgentConfig(AGENT_NAME);

if (config.runOnce) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
} else {
  startHealthServer(3002, AGENT_NAME);
  run();
  setInterval(run, 60 * 60 * 1000); // Run hourly
}
