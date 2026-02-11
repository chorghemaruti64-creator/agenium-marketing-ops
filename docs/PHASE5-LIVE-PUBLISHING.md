# Phase 5: Live Publishing + Scheduling

## Overview

Autonomous publishing enabled with preflight credential validation and systemd scheduling.

## PART A: Live Publishing Config

### config/.env
```bash
PUBLISH_ENABLED=true
DRY_RUN=false

# Post budgets
MAX_LIVE_POSTS_PER_PLATFORM=1
MAX_LIVE_REPLIES_PER_PLATFORM=2

# Per-platform enable flags
ENABLE_GITHUB=true
ENABLE_TELEGRAM=true
ENABLE_X=true
ENABLE_REDDIT=true
ENABLE_DISCORD=true
ENABLE_HN=false  # No API
```

## PART B: Credential Preflight Validation

### Validation Methods

| Platform | Method | API Endpoint |
|----------|--------|--------------|
| GitHub | Token validation | `GET /user` |
| Telegram | Bot check | `getMe` |
| X | Credentials check | Length validation |
| Reddit | OAuth2 token | `/api/v1/access_token` |
| Discord | Webhook GET | Webhook URL |
| HN | Always fails | No API |

### Failure Handling

1. Circuit breaker opened (24h cooldown)
2. Moltbook event logged: `CIRCUIT_BREAKER_OPENED`
3. Platform skipped for this run
4. Lock file created: `circuit_{platform}.lock`

### Reason Codes

- `UNSUPPORTED_AUTH` - Missing credentials
- `AUTH_FAILED` - Invalid credentials
- `RATE_LIMITED` - Rate limit hit
- `NETWORK_ERROR` - Connection issues

## PART C: Distribution Agent Flow

```
1. Load config + credentials
2. Check kill switches (STOP_ALL, PUBLISH_ENABLED)
3. Run preflight for all platforms
4. Get valid platforms list
5. For each draft:
   a. Check if platform valid
   b. Check post budget
   c. Auto-approve (no human gate)
   d. Call platform connector
   e. Policy Engine evaluation
   f. Post (if allowed)
   g. Log PLATFORM_RESULT
6. Report summary with permalinks
```

## PART D: Systemd Scheduling

### Timers (Europe/Berlin)

| Timer | Schedule | Description |
|-------|----------|-------------|
| marketing-orchestrator.timer | Daily 09:00 | Full pipeline |
| marketing-community.timer | Every 2h | Community monitor |
| marketing-partnerships.timer | Mon 10:00 | Weekly leads |

### Installation

```bash
# Install and enable
sudo ./bin/enable-schedule.sh

# Check status
systemctl list-timers | grep marketing

# Disable
sudo ./bin/disable-schedule.sh
```

### Service Files

```
/etc/systemd/system/
├── marketing-orchestrator.service
├── marketing-orchestrator.timer
├── marketing-community.service
├── marketing-community.timer
├── marketing-partnerships.service
└── marketing-partnerships.timer
```

## Management Scripts

### pause-publishing.sh
Creates `/config/STOP_ALL` kill switch:
```bash
./bin/pause-publishing.sh "Reason for pause"
```

### resume-publishing.sh
Removes STOP_ALL:
```bash
./bin/resume-publishing.sh
```

### enable-schedule.sh
```bash
sudo ./bin/enable-schedule.sh
```

### disable-schedule.sh
```bash
sudo ./bin/disable-schedule.sh
```

All scripts log to Moltbook.

## Test Results

### Run Summary (no credentials)
```
Platforms checked: 6
Platforms valid: 0
Circuit breakers opened: 6 (all UNSUPPORTED_AUTH)
```

### Moltbook Event Counts
```
Total events: 12

By event_type:
  11 AGENT_ACTION
   1 ERROR

By status:
   6 blocked (circuit breakers)
   4 success
   1 failed
   1 error
```

### Circuit Breaker Events
```
github: UNSUPPORTED_AUTH - No credentials
telegram: UNSUPPORTED_AUTH - No credentials
x: UNSUPPORTED_AUTH - No credentials
reddit: UNSUPPORTED_AUTH - No credentials
discord: UNSUPPORTED_AUTH - No credentials
hn: UNSUPPORTED_AUTH - Disabled
```

## Git Commits

- `592d707` - Phase 1: Server hardening
- `d0968be` - Phase 2: Policy Engine
- `{phase3}` - Phase 3: Moltbook wiring
- `2ced002` - Phase 4: Agents + Docker
- `352eaab` - Phase 5: Live publishing + scheduling

## Deployment Checklist

To enable live posting on production:

1. **Configure credentials** in `/opt/marketing-ops/config/.env`
2. **Remove STOP_ALL** if exists: `./bin/resume-publishing.sh`
3. **Test preflight**: Run distribution agent once
4. **Enable scheduling**: `sudo ./bin/enable-schedule.sh`
5. **Monitor**: Check Moltbook events and logs

## Platform Credentials Required

```bash
# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=username
GITHUB_REPO=repo-name

# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_CHANNEL_ID=-100...

# X (Twitter)
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...

# Reddit
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=...
REDDIT_PASSWORD=...
REDDIT_SUBREDDIT=...

# Discord
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```
