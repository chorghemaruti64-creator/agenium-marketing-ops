#!/bin/bash
# Phase 1: Harden SSH - key-only, disable root login
set -euo pipefail

SSHD_CONFIG="/etc/ssh/sshd_config"
BACKUP="/etc/ssh/sshd_config.backup.$(date +%Y%m%d%H%M%S)"

echo "=== Hardening SSH ==="

# Backup original config
cp "$SSHD_CONFIG" "$BACKUP"
echo "✓ Backup saved to: $BACKUP"

# Apply hardening settings
cat > /etc/ssh/sshd_config.d/99-hardening.conf << 'EOF'
# Marketing-Ops SSH Hardening
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
PrintMotd no
AcceptEnv LANG LC_*
Subsystem sftp /usr/lib/openssh/sftp-server
MaxAuthTries 3
LoginGraceTime 20
ClientAliveInterval 300
ClientAliveCountMax 2
EOF

echo "✓ SSH hardening config written to /etc/ssh/sshd_config.d/99-hardening.conf"

# Validate config
if sshd -t; then
    echo "✓ SSH config valid"
    systemctl reload sshd
    echo "✓ SSH reloaded"
else
    echo "✗ SSH config invalid! Restoring backup..."
    cp "$BACKUP" "$SSHD_CONFIG"
    exit 1
fi

echo ""
echo "=== SSH HARDENED ==="
echo "- Root login: DISABLED"
echo "- Password auth: DISABLED"
echo "- Key auth: ENABLED"
echo ""
echo "⚠️  Make sure you have key access before disconnecting!"
