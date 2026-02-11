#!/bin/bash
# Phase 1: Create workspace directories and set permissions
set -euo pipefail

BASE_DIR="/opt/marketing-ops"

echo "=== Creating Workspace ==="

# Create directory structure
mkdir -p "$BASE_DIR"/{workspace,config,logs,moltbook/{daily,events},bin}
mkdir -p "$BASE_DIR"/services/{orchestrator,strategy,content,distribution,community,partnerships,analytics,proof}
mkdir -p "$BASE_DIR"/shared/{policy,platforms,moltbook,metrics,store}

# Set ownership to ops user
chown -R ops:ops "$BASE_DIR"

# Set permissions
chmod 750 "$BASE_DIR"
chmod 700 "$BASE_DIR/config"  # Secrets go here
chmod 755 "$BASE_DIR/bin"

# Create empty config files
touch "$BASE_DIR/config/.env"
chmod 600 "$BASE_DIR/config/.env"

# Create kill switch placeholder (not active)
echo "# Create this file to stop all publishing" > "$BASE_DIR/config/STOP_ALL.example"

echo "✓ Workspace created at $BASE_DIR"

# Show structure
echo ""
echo "=== Directory Structure ==="
find "$BASE_DIR" -type d | head -30

echo ""
echo "=== Permissions ==="
ls -la "$BASE_DIR"
