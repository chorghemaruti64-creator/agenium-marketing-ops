#!/bin/bash
# Phase 1: Configure UFW firewall
set -euo pipefail

echo "=== Configuring UFW Firewall ==="

# Reset to defaults
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (critical - do this first!)
ufw allow 22/tcp comment 'SSH'

# Optional: Uncomment if webhooks needed
# ufw allow 80/tcp comment 'HTTP webhooks'
# ufw allow 443/tcp comment 'HTTPS webhooks'

# Enable UFW
echo "y" | ufw enable

# Show status
ufw status verbose

echo ""
echo "=== Firewall Configured ==="
echo "- Incoming: DENY (default)"
echo "- Outgoing: ALLOW (default)"
echo "- SSH (22): ALLOWED"
echo ""
echo "To enable webhooks later:"
echo "  ufw allow 80/tcp"
echo "  ufw allow 443/tcp"
