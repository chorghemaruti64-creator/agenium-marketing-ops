#!/bin/bash
# Pause publishing by creating STOP_ALL kill switch
# This immediately stops all publishing without disabling scheduling

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="${CONFIG_DIR:-$PROJECT_DIR/config}"
MOLTBOOK_DIR="${MOLTBOOK_DIR:-$PROJECT_DIR/moltbook}"

STOP_FILE="$CONFIG_DIR/STOP_ALL"

echo "⏸️  Pausing Marketing Publishing"
echo ""

# Create STOP_ALL file
mkdir -p "$CONFIG_DIR"
date -u +%Y-%m-%dT%H:%M:%SZ > "$STOP_FILE"
echo "Paused by: $(whoami)@$(hostname)" >> "$STOP_FILE"
echo "Reason: ${1:-Manual pause}" >> "$STOP_FILE"

echo "Created: $STOP_FILE"

# Log to Moltbook
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
DATE=$(date -u +%Y-%m-%d)
EVENT_DIR="$MOLTBOOK_DIR/events/$DATE"
mkdir -p "$EVENT_DIR"

cat > "$EVENT_DIR/${TIMESTAMP//[:.]/-}_pause_AGENT_ACTION.jsonl" << EOF
{"event_id":"$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)","ts":"$TIMESTAMP","source_agent":"admin","event_type":"AGENT_ACTION","platform":"internal","status":"success","summary":"Publishing PAUSED via STOP_ALL kill switch","data":{"action":"pause_publishing","reason":"${1:-Manual pause}","stop_file":"$STOP_FILE"}}
EOF

echo ""
echo "✅ Publishing paused!"
echo ""
echo "To resume: ./bin/resume-publishing.sh"
echo ""
echo "Note: Scheduled jobs will still run but will exit immediately"
echo "      when they see the STOP_ALL file."
