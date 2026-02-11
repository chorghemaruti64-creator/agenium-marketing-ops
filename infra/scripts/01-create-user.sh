#!/bin/bash
# Phase 1: Create non-root user with key-only SSH
set -euo pipefail

USERNAME="ops"
SSH_DIR="/home/$USERNAME/.ssh"

echo "=== Creating user: $USERNAME ==="

# Create user if not exists
if ! id "$USERNAME" &>/dev/null; then
    useradd -m -s /bin/bash "$USERNAME"
    echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$USERNAME
    chmod 440 /etc/sudoers.d/$USERNAME
    echo "✓ User $USERNAME created with sudo access"
else
    echo "→ User $USERNAME already exists"
fi

# Setup SSH directory
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"
chown -R "$USERNAME:$USERNAME" "$SSH_DIR"

echo ""
echo "=== IMPORTANT ==="
echo "Add your SSH public key to: $SSH_DIR/authorized_keys"
echo "Example: echo 'ssh-ed25519 AAAA...' >> $SSH_DIR/authorized_keys"
echo ""
