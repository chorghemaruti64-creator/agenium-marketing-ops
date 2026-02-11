# Marketing Agent Swarm

Autonomous marketing automation for the Agenium ecosystem.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR                           │
│         Coordinates all agents, manages schedules           │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ STRATEGY  │  │  CONTENT  │  │ ANALYTICS │
│           │  │           │  │           │
│ • KPIs    │  │ • Posts   │  │ • Metrics │
│ • Goals   │  │ • Threads │  │ • Reports │
│ • Plans   │  │ • Replies │  │ • Trends  │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │
      ▼              ▼              ▼
┌─────────────────────────────────────────┐
│            POLICY ENGINE                │
│  • Content safety    • Brand rules      │
│  • Rate limits       • Risk scoring     │
│  • Quiet hours       • Kill switches    │
└─────────────────────┬───────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│           DISTRIBUTION                   │
│  GitHub │ Twitter │ Reddit │ Telegram   │
│  Discord │ HN │ ...                     │
└─────────────────────┬───────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐
│ COMMUNITY │  │PARTNERSHIPS│ │  PROOF/QA │
│           │  │           │  │           │
│ • Replies │  │ • Outreach│  │ • Verify  │
│ • Engage  │  │ • Collabs │  │ • Test    │
└───────────┘  └───────────┘  └───────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│              MOLTBOOK                    │
│  Every action logged with full context  │
└─────────────────────────────────────────┘
```

## Agents

| Agent | Purpose | Frequency |
|-------|---------|-----------|
| **orchestrator** | Coordinates pipeline, manages state | Always running |
| **strategy** | Defines KPIs, content calendar | Daily |
| **content** | Generates posts, threads, replies | On demand |
| **distribution** | Publishes to platforms | After content |
| **community** | Monitors and replies to comments | Every 2 hours |
| **partnerships** | Outreach to potential partners | Weekly (Monday) |
| **analytics** | Tracks metrics, generates reports | Daily |
| **proof** | QA/verification before publishing | Before each post |

## Safety Features

### Kill Switches (No Approval Needed)

1. **File kill switch**: Create `/opt/marketing-ops/config/STOP_ALL`
2. **Env kill switch**: Set `PUBLISH_ENABLED=false`
3. **Circuit breaker**: Auto-disables platform after N failures

### Policy Engine

- Content safety rules (hard blocks)
- Brand alignment checks
- Rate limits per platform
- Quiet hours (01:00-07:00 Europe/Berlin)
- Risk scoring with automatic blocking

### Moltbook (Audit Trail)

Every action logged:
- What was posted
- Where (platform, URL)
- When (timestamp)
- Policy decision & risk score
- KPI impact

## Quick Start

```bash
# Phase 1: Server setup
./infra/scripts/phase1-deploy.sh

# Phase 2-6: See docs/

# Check status
/opt/marketing-ops/bin/status.sh
```

## Configuration

Copy `config/.env.example` to `config/.env` and fill in:
- Platform API tokens
- Rate limits
- Policy settings

## Deployment Phases

1. ✅ **Server Hardening** - User, SSH, firewall, workspace
2. 🔲 **Policy Engine** - Safety rules, rate limits, risk scoring
3. 🔲 **Moltbook Wiring** - Audit logging
4. 🔲 **Agent Implementation** - Docker services
5. 🔲 **Platform Integrations** - API connectors
6. 🔲 **Scheduling** - Systemd timers, reliability
7. 🔲 **Dry Run + Live** - Testing and launch

## License

Internal use only - Agenium ecosystem.
