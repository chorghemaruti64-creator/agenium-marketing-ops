# Phase 1: Server Hardening + Workspace

## Overview

This phase prepares the server with:
- Non-root user (`ops`) with key-only SSH
- Docker + Docker Compose
- UFW firewall (SSH only by default)
- Fail2ban SSH protection
- Workspace directory structure
- Log rotation

## Prerequisites

- Ubuntu 22.04+ server
- Root or sudo access
- SSH public key ready

## Quick Deploy

```bash
# On the server as root:
cd /tmp
git clone <repo-url> marketing-ops
cd marketing-ops/infra/scripts
chmod +x *.sh

# Run main setup (excludes SSH hardening for safety)
./phase1-deploy.sh

# Add your SSH key
echo 'ssh-ed25519 AAAA...' >> /home/ops/.ssh/authorized_keys

# Test login in another terminal:
# ssh ops@<server-ip>

# Once confirmed working, harden SSH:
./02-harden-ssh.sh
```

## Directory Structure

```
/opt/marketing-ops/
├── bin/                 # Utility scripts
│   └── status.sh        # System status checker
├── config/              # Configuration (chmod 700)
│   ├── .env             # Secrets (chmod 600)
│   └── STOP_ALL         # Kill switch (create to halt)
├── logs/                # Application logs
├── moltbook/            # Audit trail
│   ├── daily/           # Daily summaries
│   └── events/          # Individual action logs
├── services/            # Agent code
│   ├── orchestrator/
│   ├── strategy/
│   ├── content/
│   ├── distribution/
│   ├── community/
│   ├── partnerships/
│   ├── analytics/
│   └── proof/
├── shared/              # Shared libraries
│   ├── policy/          # Policy engine
│   ├── platforms/       # Platform connectors
│   ├── moltbook/        # Logging lib
│   ├── metrics/         # Prometheus metrics
│   └── store/           # SQLite database
└── workspace/           # Temp/working files
```

## Security Features

### User Isolation
- `ops` user for all operations
- No root login via SSH
- Key-only authentication

### Firewall (UFW)
```bash
# Default rules
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  # SSH

# If webhooks needed later:
ufw allow 80/tcp
ufw allow 443/tcp
```

### Fail2ban
- Protects SSH from brute force
- 3 failed attempts = 24 hour ban
- Auto-unban after cooldown

### Log Rotation
- Daily rotation
- 14 days retention
- Compressed after 1 day

## Verification

After deployment, run:

```bash
# As ops user
/opt/marketing-ops/bin/status.sh

# Check services
docker ps
ufw status
fail2ban-client status sshd
```

## Rollback

If something goes wrong:

```bash
# SSH config backup location
ls /etc/ssh/sshd_config.backup.*

# Restore if needed
cp /etc/ssh/sshd_config.backup.XXXXXX /etc/ssh/sshd_config
systemctl reload sshd
```

## Next Phase

Proceed to [Phase 2: Policy Engine](./PHASE2-POLICY-ENGINE.md)
