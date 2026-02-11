# Phase 4: Marketing Agent Swarm

## Overview

8 autonomous agents implemented as Docker containers with full Policy Engine + Moltbook integration.

## Agents

| Agent | Port | Function | Output |
|-------|------|----------|--------|
| orchestrator | 3000 | Pipeline coordinator | reports/*.json |
| strategy | 3001 | Daily brief generator | briefs/*.md |
| content | 3002 | Draft generator | content/drafts/*/*.json |
| distribution | 3003 | Auto-publisher | distribution/posts/*.json |
| community | 3004 | Interaction monitor | community/tasks/*.json |
| partnerships | 3005 | Lead generator | partnerships/leads/*.json |
| analytics | 3006 | KPI reporter | analytics/daily/*.md |
| proof | 3007 | Proof pack generator | proofs/*.json |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR                                │
│                    (Pipeline Coordinator)                           │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  STRATEGY   │         │   CONTENT   │         │ DISTRIBUTION│
│ Daily Brief │ ──────▶ │   Drafts    │ ──────▶ │  Publish    │
└─────────────┘         └─────────────┘         └─────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │ POLICY ENGINE   │
                                              │ + MOLTBOOK      │
                                              └─────────────────┘
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  COMMUNITY  │         │PARTNERSHIPS │         │  ANALYTICS  │
│   Monitor   │         │   Leads     │         │    KPIs     │
└─────────────┘         └─────────────┘         └─────────────┘
                                │
                                ▼
                        ┌─────────────┐
                        │    PROOF    │
                        │  Verifier   │
                        └─────────────┘
```

## Platform Connectors

| Platform | Connector | API Type | Status |
|----------|-----------|----------|--------|
| GitHub | github.ts | GraphQL (Discussions) | ✅ Ready |
| Telegram | telegram.ts | Bot API | ✅ Ready |
| X (Twitter) | x.ts | OAuth 1.0a + v2 API | ✅ Ready |
| Reddit | reddit.ts | OAuth2 Password Grant | ✅ Ready |
| Discord | discord.ts | Webhook | ✅ Ready |
| HN | hn.ts | Draft only (no API) | ⚠️ Manual |

## Safety Features

### Policy Engine Integration
- Every publish action runs through `evaluate()`
- Risk scoring with threshold (70)
- Rate limit enforcement
- Duplicate detection
- Secret redaction

### Moltbook Logging
- `POLICY_DECISION` - every evaluation
- `PLATFORM_ATTEMPT` - before publish
- `PLATFORM_RESULT` - after publish
- `AGENT_ACTION` - internal operations
- `ERROR` - failures

### Kill Switches
1. **File**: `/opt/marketing-ops/config/STOP_ALL`
2. **Env**: `PUBLISH_ENABLED=false`
3. **Circuit Breaker**: 5 failures → 24h disable

## Docker Compose

```yaml
services:
  orchestrator:
    command: ["npx", "tsx", "agents/orchestrator/index.ts"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]

volumes:
  workspace:    # /opt/marketing-ops/workspace
  moltbook:     # /opt/marketing-ops/moltbook
  logs:         # /opt/marketing-ops/logs
```

## Environment Variables

```bash
# Mode
RUN_ONCE=true|false     # Single run vs daemon
DRY_RUN=true|false      # Simulate posts
PUBLISH_ENABLED=true|false  # Master switch

# Paths
WORKSPACE_DIR=/workspace
MOLTBOOK_DIR=/moltbook
CONFIG_DIR=/config
STORE_DB=/workspace/store.db

# Platform Credentials (optional)
GITHUB_TOKEN=...
TELEGRAM_BOT_TOKEN=...
X_API_KEY=...
REDDIT_CLIENT_ID=...
DISCORD_WEBHOOK_URL=...
```

## Usage

### Run Once (Manual)
```bash
./bin/run-once.sh --dry-run    # Simulate
./bin/run-once.sh --live       # Real posts
```

### Docker
```bash
docker compose build
docker compose up -d
docker compose logs -f
```

### Check Status
```bash
./bin/moltbook-status.sh       # Today's events
./bin/status.sh                # System status
```

## Generated Files

```
workspace/
├── briefs/2026-02-11.md           # Daily strategy
├── content/drafts/2026-02-11/     # 4+ drafts
├── distribution/posts/2026-02-11/ # Published posts
├── community/tasks/               # Interaction tasks
├── partnerships/leads/            # Partner leads
├── analytics/daily/               # KPI reports
└── proofs/                        # Verification packs

moltbook/
└── events/2026-02-11/             # Audit trail
```

## Content Templates

All content includes Agenium ecosystem references:
- agent:// protocol
- DNS-based discovery
- Marketplace features
- #Agenium #A2A #AgentProtocol hashtags

## Git Commits

- `592d707` - Phase 1: Server hardening
- `d0968be` - Phase 2: Policy Engine
- `{phase3}` - Phase 3: Moltbook wiring
- `2ced002` - Phase 4: Agents + Docker

## Next Steps (Phase 5+)

1. **Platform Integration Testing** - Configure real credentials
2. **Scheduling** - systemd timers for periodic runs
3. **Monitoring** - Prometheus metrics endpoint
4. **Live Deployment** - Deploy to production server
