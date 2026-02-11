#!/bin/bash
# Resume publishing by removing STOP_ALL kill switch

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="${CONFIG_DIR:-$PROJECT_DIR/config}"
MOLTBOOK_DIR="${MOLTBOOK_DIR:-$PROJECT_DIR/moltbook}"

STOP_FILE="$CONFIG_DIR/STOP_ALL"

echo "▶️  Resuming Marketing Publishing"
echo ""

# Check if STOP_ALL exists
if [ ! -f "$STOP_FILE" ]; then
  echo "⚠️  STOP_ALL file not found - publishing is already active"
  exit 0
fi

# Show current stop file contents
echo "Current STOP_ALL contents:"
cat "$STOP_FILE"
echo ""

# Remove STOP_ALL file
rm -f "$STOP_FILE"
echo "Removed: $STOP_FILE"

# Log to Moltbook
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
DATE=$(date -u +%Y-%m-%d)
EVENT_DIR="$MOLTBOOK_DIR/events/$DATE"
mkdir -p "$EVENT_DIR"

cat > "$EVENT_DIR/${TIMESTAMP//[:.]/-}_resume_AGENT_ACTION.jsonl" << EOF
{"event_id":"$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)","ts":"$TIMESTAMP","source_agent":"admin","event_type":"AGENT_ACTION","platform":"internal","status":"success","summary":"Publishing RESUMED - STOP_ALL kill switch removed","data":{"action":"resume_publishing"}}
EOF

echo ""
echo "✅ Publishing resumed!"
echo ""
echo "Next scheduled runs will proceed normally."
