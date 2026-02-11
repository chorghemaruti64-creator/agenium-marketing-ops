#!/bin/bash
# Marketing-Ops Status Script
set -euo pipefail

BASE_DIR="/opt/marketing-ops"
CONFIG_DIR="$BASE_DIR/config"

echo "╔════════════════════════════════════════════╗"
echo "║       MARKETING-OPS STATUS                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Kill switches
echo "=== KILL SWITCHES ==="
if [[ -f "$CONFIG_DIR/STOP_ALL" ]]; then
    echo "🔴 STOP_ALL: ACTIVE (publishing halted)"
else
    echo "🟢 STOP_ALL: Not set"
fi

if [[ -f "$CONFIG_DIR/.env" ]]; then
    PUBLISH_ENABLED=$(grep -E "^PUBLISH_ENABLED=" "$CONFIG_DIR/.env" 2>/dev/null | cut -d= -f2 || echo "true")
    if [[ "$PUBLISH_ENABLED" == "false" ]]; then
        echo "🔴 PUBLISH_ENABLED: false (publishing disabled)"
    else
        echo "🟢 PUBLISH_ENABLED: true"
    fi
else
    echo "⚠️  No .env file found"
fi
echo ""

# Docker containers
echo "=== CONTAINERS ==="
if command -v docker &>/dev/null; then
    docker compose -f "$BASE_DIR/docker-compose.yml" ps 2>/dev/null || echo "No containers running"
else
    echo "Docker not available"
fi
echo ""

# Circuit breakers
echo "=== CIRCUIT BREAKERS ==="
CB_FILE="$BASE_DIR/shared/store/circuit_breakers.json"
if [[ -f "$CB_FILE" ]]; then
    jq -r 'to_entries[] | "  \(.key): \(.value.state) (failures: \(.value.failures))"' "$CB_FILE" 2>/dev/null || echo "  No breakers tripped"
else
    echo "  No circuit breaker data"
fi
echo ""

# Rate limits (today)
echo "=== TODAY'S USAGE ==="
DB_FILE="$BASE_DIR/shared/store/marketing.db"
TODAY=$(date +%Y-%m-%d)
if [[ -f "$DB_FILE" ]]; then
    sqlite3 "$DB_FILE" "SELECT platform, COUNT(*) as count FROM posts WHERE date(created_at)='$TODAY' GROUP BY platform;" 2>/dev/null || echo "  No posts today"
else
    echo "  No database yet"
fi
echo ""

# Recent activity
echo "=== LAST 5 ACTIONS ==="
EVENTS_DIR="$BASE_DIR/moltbook/events"
if [[ -d "$EVENTS_DIR" ]]; then
    ls -t "$EVENTS_DIR"/*.json 2>/dev/null | head -5 | while read -r f; do
        jq -r '"\(.timestamp) | \(.action) | \(.platform // "system")"' "$f" 2>/dev/null
    done || echo "  No events recorded"
else
    echo "  No events directory"
fi
echo ""

# System health
echo "=== SYSTEM ==="
echo "  Uptime: $(uptime -p)"
echo "  Disk: $(df -h /opt 2>/dev/null | tail -1 | awk '{print $5 " used"}')"
echo "  Memory: $(free -h | grep Mem | awk '{print $3 "/" $2}')"
echo ""

echo "╔════════════════════════════════════════════╗"
echo "║  Status check complete                     ║"
echo "╚════════════════════════════════════════════╝"
