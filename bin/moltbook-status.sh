#!/bin/bash
# Moltbook Status - Show summary of today's events
set -euo pipefail

MOLTBOOK_PATH="${MOLTBOOK_PATH:-/opt/marketing-ops/moltbook}"
TODAY=$(date +%Y-%m-%d)
EVENTS_DIR="$MOLTBOOK_PATH/events/$TODAY"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    MOLTBOOK STATUS                             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Date: $TODAY"
echo "Path: $MOLTBOOK_PATH"
echo ""

# Check if events directory exists
if [[ ! -d "$EVENTS_DIR" ]]; then
    echo "No events for today."
    exit 0
fi

# Count files
FILE_COUNT=$(ls -1 "$EVENTS_DIR"/*.jsonl 2>/dev/null | wc -l || echo 0)
echo "Event files: $FILE_COUNT"
echo ""

# Count events by type
echo "=== Events by Type ==="
if [[ $FILE_COUNT -gt 0 ]]; then
    cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | jq -r '.event_type' | sort | uniq -c | sort -rn
else
    echo "  (none)"
fi
echo ""

# Count by status
echo "=== Events by Status ==="
if [[ $FILE_COUNT -gt 0 ]]; then
    cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | jq -r '.status' | sort | uniq -c | sort -rn
else
    echo "  (none)"
fi
echo ""

# Count by platform
echo "=== Events by Platform ==="
if [[ $FILE_COUNT -gt 0 ]]; then
    cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | jq -r '.platform // "N/A"' | sort | uniq -c | sort -rn
else
    echo "  (none)"
fi
echo ""

# Show blocked/failed events
echo "=== Blocked/Failed Events ==="
if [[ $FILE_COUNT -gt 0 ]]; then
    cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | \
        jq -r 'select(.status == "blocked" or .status == "failed") | "\(.ts | split("T")[1] | split(".")[0]) | \(.status) | \(.platform // "N/A") | \(.summary | .[0:60])"' | \
        head -10
else
    echo "  (none)"
fi
echo ""

# Check daily summary
DAILY_SUMMARY="$MOLTBOOK_PATH/daily/$TODAY.md"
if [[ -f "$DAILY_SUMMARY" ]]; then
    echo "Daily summary: $DAILY_SUMMARY (exists)"
else
    echo "Daily summary: Not generated yet"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Use 'moltbook-tail.sh' to watch live events                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
