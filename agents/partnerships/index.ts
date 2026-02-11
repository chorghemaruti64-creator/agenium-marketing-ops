/**
 * Partnerships Agent
 * Generates partnership leads and outreach messages
 */

import * as path from 'path';
import {
  loadAgentConfig,
  isStopAll,
  today,
  ensureDir,
  writeFile,
  readFile,
  startHealthServer,
  generateTraceId,
} from '../../shared/agent/utils.js';
import { logAgentAction, logError } from '../../shared/moltbook/ledger.js';

const AGENT_NAME = 'partnerships';

interface PartnershipLead {
  id: string;
  name: string;
  type: 'infrastructure' | 'tooling' | 'community' | 'content' | 'integration';
  description: string;
  website?: string;
  contactMethod: 'twitter' | 'email' | 'discord' | 'other';
  priority: 'high' | 'medium' | 'low';
  status: 'identified' | 'outreach-drafted' | 'contacted' | 'responded' | 'partnership';
  outreachDraft?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Target partnership categories
const PARTNERSHIP_CATEGORIES = {
  infrastructure: {
    description: 'Cloud providers, hosting services, infrastructure platforms',
    examples: ['Fly.io', 'Railway', 'Render', 'DigitalOcean'],
    value: 'Infrastructure credits, co-marketing, featured integrations',
  },
  tooling: {
    description: 'Developer tools, SDKs, frameworks',
    examples: ['LangChain', 'LlamaIndex', 'Vercel AI SDK', 'AutoGPT'],
    value: 'Native integrations, joint documentation, SDK support',
  },
  community: {
    description: 'AI communities, Discord servers, forums',
    examples: ['AI Discord communities', 'Reddit AI subs', 'HN circles'],
    value: 'Cross-promotion, community events, shared resources',
  },
  content: {
    description: 'Content creators, educators, influencers',
    examples: ['AI YouTubers', 'Tech bloggers', 'Newsletter authors'],
    value: 'Coverage, tutorials, educational content',
  },
  integration: {
    description: 'Platforms that could integrate agent:// protocol',
    examples: ['OpenAI', 'Anthropic', 'Hugging Face', 'Replicate'],
    value: 'Protocol adoption, ecosystem growth, standard establishment',
  },
};

// Outreach templates
const OUTREACH_TEMPLATES = {
  infrastructure: (name: string) => `Hi ${name} team!

I'm reaching out from Agenium about a potential collaboration.

We're building the agent:// protocol - a DNS-based system for agent-to-agent communication. Think of it as the addressing layer for AI agents, similar to how HTTP/DNS works for the web.

We believe there's a strong alignment with ${name}'s infrastructure offering. Some ideas:
- Featured integration in our docs
- Co-marketing to our growing developer community
- Technical collaboration on agent hosting best practices

Would love to explore how we might work together. Happy to share more details or jump on a quick call.

Best,
Agenium Team`,

  tooling: (name: string) => `Hey ${name} team!

Love what you're building! Quick outreach from Agenium.

We're working on the agent:// protocol - essentially a DNS layer for AI agents. It enables agents to discover and communicate with each other using human-readable addresses.

I think there's an interesting integration opportunity with ${name}:
- Native agent:// support in your SDK
- Example implementations for your users
- Joint documentation and tutorials

Interested in exploring this? Would be great to chat!

Cheers,
Agenium Team`,

  community: (name: string) => `Hey!

Reaching out from Agenium about a potential community collaboration.

We're building infrastructure for agent-to-agent communication (the agent:// protocol). Our community is growing and we'd love to explore cross-promotion opportunities with ${name}.

Some ideas:
- Shared AMAs or events
- Cross-posting relevant content
- Collaborative projects

Let me know if this sounds interesting!`,

  content: (name: string) => `Hi!

I'm a fan of your content and wanted to reach out from Agenium.

We're building the agent:// protocol - a way for AI agents to discover and communicate with each other. It's a new paradigm in the AI agent space.

Would you be interested in covering this? We can provide:
- Exclusive early access
- Technical interviews
- Demo environments

Let me know if you'd like to learn more!

Best,
Agenium Team`,

  integration: (name: string) => `Hello ${name} team,

I'm reaching out from Agenium regarding a potential protocol integration.

We've developed the agent:// protocol - a DNS-based addressing system for AI agents that enables decentralized discovery and communication. We believe it could be valuable for ${name}'s agent ecosystem.

Key benefits:
- Human-readable agent addresses (agent://myagent.example)
- Decentralized discovery via standard DNS
- Secure communication with mTLS
- Open protocol, no vendor lock-in

We'd love to discuss how agent:// could integrate with your platform. Would you have time for a brief call?

Best regards,
Agenium Team`,
};

/**
 * Generate sample partnership leads
 */
function generateLeads(): PartnershipLead[] {
  const leads: PartnershipLead[] = [];
  const now = new Date().toISOString();

  // One lead per category as examples
  const sampleLeads = [
    { name: 'Railway', type: 'infrastructure' as const, priority: 'high' as const },
    { name: 'LangChain', type: 'tooling' as const, priority: 'high' as const },
    { name: 'AI Twitter Community', type: 'community' as const, priority: 'medium' as const },
    { name: 'AI Newsletter', type: 'content' as const, priority: 'medium' as const },
  ];

  for (const sample of sampleLeads) {
    const category = PARTNERSHIP_CATEGORIES[sample.type];
    const templateFn = OUTREACH_TEMPLATES[sample.type];

    leads.push({
      id: `lead-${sample.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      name: sample.name,
      type: sample.type,
      description: category.description,
      contactMethod: sample.type === 'community' ? 'discord' : 'twitter',
      priority: sample.priority,
      status: 'outreach-drafted',
      outreachDraft: templateFn(sample.name),
      notes: `Value proposition: ${category.value}`,
      createdAt: now,
      updatedAt: now,
    });
  }

  return leads;
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
    const leadsDir = path.join(config.workspaceDir, 'partnerships', 'leads');
    const outreachDir = path.join(config.workspaceDir, 'partnerships', 'outreach', date);

    ensureDir(leadsDir);
    ensureDir(outreachDir);

    // Check if leads already generated today
    const reportPath = path.join(outreachDir, 'daily-report.md');
    if (readFile(reportPath)) {
      console.log(`[${AGENT_NAME}] Leads already generated for ${date}`);
      return;
    }

    // Generate leads
    const leads = generateLeads();

    // Write lead files
    for (const lead of leads) {
      const leadPath = path.join(leadsDir, `${lead.id}.json`);
      writeFile(leadPath, JSON.stringify(lead, null, 2));

      // Write outreach draft as markdown
      if (lead.outreachDraft) {
        const outreachPath = path.join(outreachDir, `${lead.name.toLowerCase().replace(/\s+/g, '-')}.md`);
        writeFile(outreachPath, `# Outreach: ${lead.name}

**Type:** ${lead.type}
**Priority:** ${lead.priority}
**Contact Method:** ${lead.contactMethod}
**Status:** ${lead.status}

---

${lead.outreachDraft}

---

**Notes:** ${lead.notes || 'None'}
**Generated:** ${lead.createdAt}
`);
      }
    }

    // Generate daily report
    const report = `# Partnership Leads Report - ${date}

## Summary
- **New Leads:** ${leads.length}
- **High Priority:** ${leads.filter(l => l.priority === 'high').length}
- **Outreach Drafted:** ${leads.filter(l => l.status === 'outreach-drafted').length}

## Leads by Category

${Object.entries(PARTNERSHIP_CATEGORIES).map(([key, cat]) => `### ${key.charAt(0).toUpperCase() + key.slice(1)}
${cat.description}
**Examples:** ${cat.examples.join(', ')}
**Value:** ${cat.value}
`).join('\n')}

## Today's Leads

| Name | Type | Priority | Status |
|------|------|----------|--------|
${leads.map(l => `| ${l.name} | ${l.type} | ${l.priority} | ${l.status} |`).join('\n')}

---
Generated by ${AGENT_NAME} at ${new Date().toISOString()}
`;

    writeFile(reportPath, report);

    console.log(`[${AGENT_NAME}] Generated ${leads.length} leads`);

    await logAgentAction(config.moltbookDir, {
      sourceAgent: AGENT_NAME,
      platform: 'internal',
      actionType: 'leads',
      fingerprint: `partnerships-${date}`,
      traceId,
      status: 'success',
      summary: `Generated ${leads.length} partnership leads for ${date}`,
      data: {
        count: leads.length,
        highPriority: leads.filter(l => l.priority === 'high').length,
        leadsDir,
        outreachDir,
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
      summary: `Partnerships agent error: ${error}`,
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
  startHealthServer(3005, AGENT_NAME);
  run();
  setInterval(run, 24 * 60 * 60 * 1000); // Run daily
}
