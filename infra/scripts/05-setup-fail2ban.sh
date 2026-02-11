#!/bin/bash
# Phase 1: Configure fail2ban for SSH protection
set -euo pipefail

echo "=== Configuring Fail2ban ==="

# Create local jail config
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h
EOF

echo "✓ Fail2ban config written"

# Restart fail2ban
systemctl enable fail2ban
systemctl restart fail2ban

# Show status
fail2ban-client status
fail2ban-client status sshd

echo ""
echo "=== Fail2ban Configured ==="
echo "- SSH jail: ENABLED"
echo "- Max retries: 3"
echo "- Ban time: 24 hours"
