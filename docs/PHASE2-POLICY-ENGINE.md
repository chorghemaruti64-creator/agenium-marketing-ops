# Phase 2: Policy Engine (Autonomous Publishing)

## Overview

The Policy Engine is a mandatory gating layer that ALL marketing agents must pass before any external action. It replaces human approval with automated, deterministic rules.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT (wants to post)                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      POLICY ENGINE                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
│  │   KILL    │  │  SAFETY   │  │   BRAND   │  │  QUIET   │ │
│  │ SWITCHES  │  │   RULES   │  │   RULES   │  │  HOURS   │ │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬─────┘ │
│        │              │              │              │       │
│  ┌─────┴──────────────┴──────────────┴──────────────┴────┐ │
│  │                    EVALUATOR                           │ │
│  │  → Redact secrets                                      │ │
│  │  → Check all rules                                     │ │
│  │  → Calculate risk score                                │ │
│  │  → Generate fingerprint                                │ │
│  └───────────────────────┬───────────────────────────────┘ │
│                          │                                  │
│  ┌───────────┐  ┌────────┴────────┐  ┌───────────────────┐ │
│  │  DEDUPE   │  │  RATE LIMITS    │  │   RISK SCORING    │ │
│  │  (7 days) │  │  (per platform) │  │   (threshold 70)  │ │
│  └───────────┘  └─────────────────┘  └───────────────────┘ │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │      PolicyDecision           │
              │  • allow: boolean             │
              │  • reason_codes: string[]     │
              │  • risk_score: 0-100          │
              │  • redacted_text: string      │
              │  • action_fingerprint: sha256 │
              │  • next_allowed_at: Date?     │
              └───────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `shared/policy/types.ts` | Core types (Platform, ActionType, PolicyDecision, etc.) |
| `shared/policy/redact.ts` | Secret detection and redaction |
| `shared/policy/rules.ts` | Content safety, brand, evidence rules |
| `shared/policy/risk.ts` | Risk scoring algorithm |
| `shared/policy/policy.ts` | Main evaluator |
| `shared/policy/demo.ts` | 10 sample actions demo |
| `shared/store/schema.sql` | SQLite schema |
| `shared/store/sqlite.ts` | Store implementation |
| `shared/moltbook/audit.ts` | Audit trail logging |

## Mandatory Rules

### 1. Kill Switches (Highest Priority)
- **File kill switch**: `/opt/marketing-ops/config/STOP_ALL` exists → DENY ALL
- **Env kill switch**: `PUBLISH_ENABLED=false` → DENY ALL

### 2. Safety Hard Blocks
- Hate/harassment
- Sexual content
- Doxxing (addresses, SSNs, phone numbers)
- Illegal instructions
- Political persuasion targeting

### 3. Secret Detection
Automatically detects and redacts:
- GitHub tokens (`ghp_*`)
- API keys (OpenAI, Anthropic, AWS, etc.)
- Private keys (RSA, SSH)
- Connection strings
- Internal IPs (10.x.x.x, 192.168.x.x, etc.)
- JWT tokens

### 4. Brand Requirements
Posts/submissions MUST mention at least one of:
- "Agenium"
- "agent://"
- "DNS registry"
- "Marketplace"

Replies/comments are exempt.

### 5. Evidence for Claims
Numeric claims (req/s, p99, uptime %, etc.) MUST include `evidence[]`:
```typescript
evidence: [
  { type: 'log', source: 'benchmark.log', value: '10000 rps', timestamp: '...' }
]
```

### 6. Quiet Hours
- 01:00-07:00 Europe/Berlin
- Posts/submissions/DMs → DENIED
- Replies/comments → ALLOWED

### 7. Rate Limits (per day)

| Platform | Posts | Replies | Comments | Other |
|----------|-------|---------|----------|-------|
| X/Twitter | 3 | 10 | - | - |
| Reddit | 2 | - | 10 | - |
| HN | 1 submission | - | 5 | - |
| Telegram | 3 | 20 | - | - |
| GitHub | 2 discussions | - | 5 | 2 issues |
| Discord | 20 messages | - | - | - |

### 8. Dedupe
Same content (by fingerprint) cannot be posted within 7 days.

### 9. Risk Scoring

| Factor | Points |
|--------|--------|
| Base | 10 |
| Secrets detected | +40 |
| External links > 3 | +20 |
| Short text (<50 chars) | +20 |
| Risky keywords | +15 |

**Threshold: 70** → If risk ≥ 70, DENY with `RISK_TOO_HIGH`

## Usage

```typescript
import { evaluate, DEFAULT_CONFIG } from '@marketing-ops/shared';
import { createInMemoryStore } from '@marketing-ops/shared/store/sqlite';

const store = createInMemoryStore();

const decision = evaluate({
  platform: 'x',
  action_type: 'post',
  text: 'Check out Agenium v2.0!',
  links: ['https://github.com/agenium'],
  metadata: { campaign: 'launch' },
  time: new Date(),
}, DEFAULT_CONFIG, store);

if (decision.allow) {
  // Proceed with publishing
  console.log('Approved:', decision.redacted_text);
} else {
  // Log denial
  console.log('Denied:', decision.reason_codes);
}
```

## Testing

```bash
cd shared

# Run unit tests
npm test

# Run demo (10 sample actions)
npm run demo
```

## Demo Output

```
╔════════════════════════════════════════════════════════════════╗
║           POLICY ENGINE DEMO - 10 Sample Actions               ║
╚════════════════════════════════════════════════════════════════╝

✅ PASS | 1. Valid Agenium announcement
       Decision: 🟢 ALLOW
       Reasons: ALLOWED
       Risk Score: 10/100

✅ PASS | 2. Missing brand mention (should deny)
       Decision: 🔴 DENY
       Reasons: BRAND_MISSING

✅ PASS | 3. Contains secret (should deny)
       Decision: 🔴 DENY
       Reasons: SECRET_LEAKED

✅ PASS | 4. Quiet hours post (should deny)
       Decision: 🔴 DENY
       Reasons: QUIET_HOURS

...

═══════════════════════════════════════════════════════════════════
Results: 10/10 passed, 0/10 failed
═══════════════════════════════════════════════════════════════════
```

## Moltbook Audit Trail

Every decision (allow or deny) is logged to:
- `moltbook/events/YYYY-MM-DD/<fingerprint>.json` - Full JSON record
- `moltbook/daily/YYYY-MM-DD.md` - Markdown summary table

## Next Phase

Proceed to [Phase 3: Moltbook Wiring](./PHASE3-MOLTBOOK.md)
