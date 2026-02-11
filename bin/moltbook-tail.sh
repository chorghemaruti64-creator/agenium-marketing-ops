#!/bin/bash
# Moltbook Tail - Watch events in real-time
set -euo pipefail

MOLTBOOK_PATH="${MOLTBOOK_PATH:-/opt/marketing-ops/moltbook}"
TODAY=$(date +%Y-%m-%d)
EVENTS_DIR="$MOLTBOOK_PATH/events/$TODAY"
LINES="${1:-20}"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    MOLTBOOK TAIL                               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Watching: $EVENTS_DIR"
echo "Last $LINES events:"
echo ""
echo "────────────────────────────────────────────────────────────────────"

# Function to format event
format_event() {
    jq -r '
        def status_emoji:
            if .status == "ok" then "✅"
            elif .status == "blocked" then "🚫"
            elif .status == "failed" then "❌"
            elif .status == "retrying" then "🔄"
            else "❓"
            end;
        
        "\(.ts | split("T")[1] | split(".")[0]) \(status_emoji) [\(.source_agent)] \(.event_type) \(.platform // "") \(.summary | .[0:50])"
    ' 2>/dev/null || echo "(parse error)"
}

# Create directory if needed
mkdir -p "$EVENTS_DIR"

# Show last N events
if ls "$EVENTS_DIR"/*.jsonl &>/dev/null; then
    cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | \
        tail -n "$LINES" | \
        while IFS= read -r line; do
            echo "$line" | format_event
        done
else
    echo "(no events yet)"
fi

echo ""
echo "────────────────────────────────────────────────────────────────────"
echo "Watching for new events... (Ctrl+C to stop)"
echo ""

# Watch for new events using inotifywait if available
if command -v inotifywait &>/dev/null; then
    inotifywait -m -e modify -e create "$EVENTS_DIR" 2>/dev/null | while read -r dir action file; do
        if [[ "$file" == *.jsonl ]]; then
            tail -n 1 "$EVENTS_DIR/$file" 2>/dev/null | format_event
        fi
    done
else
    # Fallback: poll every 2 seconds
    LAST_COUNT=0
    while true; do
        sleep 2
        if ls "$EVENTS_DIR"/*.jsonl &>/dev/null; then
            CURRENT_COUNT=$(cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | wc -l)
            if [[ $CURRENT_COUNT -gt $LAST_COUNT ]]; then
                NEW_EVENTS=$((CURRENT_COUNT - LAST_COUNT))
                cat "$EVENTS_DIR"/*.jsonl 2>/dev/null | tail -n "$NEW_EVENTS" | while IFS= read -r line; do
                    echo "$line" | format_event
                done
                LAST_COUNT=$CURRENT_COUNT
            fi
        fi
    done
fi
