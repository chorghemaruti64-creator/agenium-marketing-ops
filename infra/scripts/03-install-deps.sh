#!/bin/bash
# Phase 1: Install required packages
set -euo pipefail

echo "=== Installing Dependencies ==="

# Update package lists
apt-get update

# Install base packages
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    jq \
    ufw \
    fail2ban \
    logrotate \
    sqlite3 \
    python3 \
    python3-pip \
    python3-venv

echo "✓ Base packages installed"

# Install Docker if not present
if ! command -v docker &>/dev/null; then
    echo "→ Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "✓ Docker installed"
else
    echo "→ Docker already installed"
fi

# Add ops user to docker group
if id "ops" &>/dev/null; then
    usermod -aG docker ops
    echo "✓ User 'ops' added to docker group"
fi

# Install Docker Compose plugin if not present
if ! docker compose version &>/dev/null; then
    echo "→ Installing Docker Compose plugin..."
    apt-get install -y docker-compose-plugin
    echo "✓ Docker Compose installed"
else
    echo "→ Docker Compose already installed"
fi

# Verify installations
echo ""
echo "=== Installed Versions ==="
docker --version
docker compose version
git --version
jq --version
ufw --version
fail2ban-client --version 2>/dev/null || echo "fail2ban installed"
sqlite3 --version
python3 --version

echo ""
echo "✓ All dependencies installed successfully"
