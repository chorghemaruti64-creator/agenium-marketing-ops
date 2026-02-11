#!/bin/bash
# PHASE 1: Complete server setup
# Run as root on target server
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════╗"
echo "║  MARKETING-OPS PHASE 1: Server Hardening   ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "✗ This script must be run as root"
   exit 1
fi

echo "Step 1/7: Creating ops user..."
bash "$SCRIPT_DIR/01-create-user.sh"
echo ""

echo "Step 2/7: Installing dependencies..."
bash "$SCRIPT_DIR/03-install-deps.sh"
echo ""

echo "Step 3/7: Setting up firewall..."
bash "$SCRIPT_DIR/04-setup-firewall.sh"
echo ""

echo "Step 4/7: Configuring fail2ban..."
bash "$SCRIPT_DIR/05-setup-fail2ban.sh"
echo ""

echo "Step 5/7: Creating workspace..."
bash "$SCRIPT_DIR/06-setup-workspace.sh"
echo ""

echo "Step 6/7: Setting up log rotation..."
bash "$SCRIPT_DIR/07-setup-logrotate.sh"
echo ""

echo "Step 7/7: Hardening SSH..."
echo ""
echo "⚠️  IMPORTANT: Before running SSH hardening:"
echo "   1. Add your SSH key to /home/ops/.ssh/authorized_keys"
echo "   2. Test SSH login as 'ops' user in another terminal"
echo "   3. Only then run: bash $SCRIPT_DIR/02-harden-ssh.sh"
echo ""

echo "╔════════════════════════════════════════════╗"
echo "║  PHASE 1 COMPLETE (except SSH hardening)   ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Summary:"
echo "  ✓ User 'ops' created with sudo"
echo "  ✓ Docker + Compose installed"
echo "  ✓ UFW firewall enabled (SSH only)"
echo "  ✓ Fail2ban protecting SSH"
echo "  ✓ Workspace at /opt/marketing-ops"
echo "  ✓ Log rotation configured"
echo ""
echo "Next steps:"
echo "  1. Add SSH key: echo 'your-key' >> /home/ops/.ssh/authorized_keys"
echo "  2. Test: ssh ops@<server-ip>"
echo "  3. Harden SSH: bash $SCRIPT_DIR/02-harden-ssh.sh"
echo "  4. Proceed to Phase 2"
