#!/bin/bash
# Disable marketing agent scheduling
# Stops and disables systemd timers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MOLTBOOK_DIR="${MOLTBOOK_DIR:-/opt/marketing-ops/moltbook}"

echo "⏹️  Disabling Marketing Agent Scheduling"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Stop and disable timers
echo "⏰ Disabling timers..."
systemctl disable --now marketing-orchestrator.timer 2>/dev/null || true
systemctl disable --now marketing-community.timer 2>/dev/null || true
systemctl disable --now marketing-partnerships.timer 2>/dev/null || true

# Log to Moltbook
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
DATE=$(date -u +%Y-%m-%d)
EVENT_DIR="$MOLTBOOK_DIR/events/$DATE"
mkdir -p "$EVENT_DIR"

cat > "$EVENT_DIR/${TIMESTAMP//[:.]/-}_schedule_AGENT_ACTION.jsonl" << EOF
{"event_id":"$(uuidgen)","ts":"$TIMESTAMP","source_agent":"admin","event_type":"AGENT_ACTION","platform":"internal","status":"success","summary":"Scheduling disabled: all marketing timers stopped","data":{"action":"disable_schedule","timers":["marketing-orchestrator.timer","marketing-community.timer","marketing-partnerships.timer"]}}
EOF

echo ""
echo "✅ Scheduling disabled!"
echo ""
echo "Remaining timers:"
systemctl list-timers --all | grep marketing || echo "  (none)"
