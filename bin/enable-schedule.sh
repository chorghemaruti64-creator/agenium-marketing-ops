#!/bin/bash
# Enable marketing agent scheduling
# Installs and enables systemd timers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SYSTEMD_DIR="$PROJECT_DIR/infra/systemd"
MOLTBOOK_DIR="${MOLTBOOK_DIR:-/opt/marketing-ops/moltbook}"

echo "🚀 Enabling Marketing Agent Scheduling"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Copy service files
echo "📦 Installing systemd units..."
cp "$SYSTEMD_DIR"/*.service /etc/systemd/system/
cp "$SYSTEMD_DIR"/*.timer /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable and start timers
echo "⏰ Enabling timers..."
systemctl enable --now marketing-orchestrator.timer
systemctl enable --now marketing-community.timer
systemctl enable --now marketing-partnerships.timer

# Log to Moltbook
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
DATE=$(date -u +%Y-%m-%d)
EVENT_DIR="$MOLTBOOK_DIR/events/$DATE"
mkdir -p "$EVENT_DIR"

cat > "$EVENT_DIR/${TIMESTAMP//[:.]/-}_schedule_AGENT_ACTION.jsonl" << EOF
{"event_id":"$(uuidgen)","ts":"$TIMESTAMP","source_agent":"admin","event_type":"AGENT_ACTION","platform":"internal","status":"success","summary":"Scheduling enabled: orchestrator (daily 09:00), community (2h), partnerships (Mon 10:00)","data":{"action":"enable_schedule","timers":["marketing-orchestrator.timer","marketing-community.timer","marketing-partnerships.timer"]}}
EOF

echo ""
echo "✅ Scheduling enabled!"
echo ""
echo "Active timers:"
systemctl list-timers --all | grep marketing
