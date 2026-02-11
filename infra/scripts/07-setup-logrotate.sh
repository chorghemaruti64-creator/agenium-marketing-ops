#!/bin/bash
# Phase 1: Configure log rotation for marketing-ops
set -euo pipefail

echo "=== Configuring Log Rotation ==="

cat > /etc/logrotate.d/marketing-ops << 'EOF'
/opt/marketing-ops/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 640 ops ops
    sharedscripts
    postrotate
        # Signal containers to reopen logs if needed
        docker compose -f /opt/marketing-ops/docker-compose.yml kill -s USR1 2>/dev/null || true
    endscript
}

/opt/marketing-ops/logs/**/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 640 ops ops
}
EOF

echo "✓ Logrotate config written to /etc/logrotate.d/marketing-ops"

# Test config
logrotate -d /etc/logrotate.d/marketing-ops 2>&1 | head -20

echo ""
echo "=== Log Rotation Configured ==="
echo "- Rotation: Daily"
echo "- Keep: 14 days"
echo "- Compression: Enabled"
