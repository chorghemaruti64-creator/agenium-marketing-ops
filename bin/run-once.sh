#!/bin/bash
# Run marketing pipeline once and exit
# Usage: ./bin/run-once.sh [--dry-run] [--live]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# Default to dry run
DRY_RUN="true"
PUBLISH_ENABLED="false"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN="true"
      PUBLISH_ENABLED="false"
      shift
      ;;
    --live)
      DRY_RUN="false"
      PUBLISH_ENABLED="true"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--dry-run] [--live]"
      exit 1
      ;;
  esac
done

# Check for STOP_ALL kill switch
if [ -f "$PROJECT_DIR/config/STOP_ALL" ]; then
  echo "❌ STOP_ALL kill switch is active. Remove $PROJECT_DIR/config/STOP_ALL to continue."
  exit 1
fi

echo "🚀 Marketing Agent Swarm - Run Once"
echo "   DRY_RUN: $DRY_RUN"
echo "   PUBLISH_ENABLED: $PUBLISH_ENABLED"
echo ""

# Export environment
export RUN_ONCE=true
export DRY_RUN
export PUBLISH_ENABLED

# Load .env if exists
if [ -f "$PROJECT_DIR/config/.env" ]; then
  echo "📦 Loading config/.env"
  set -a
  source "$PROJECT_DIR/config/.env"
  set +a
fi

# Run orchestrator with RUN_ONCE=true
echo "▶️  Running orchestrator..."
echo ""

# Check if running in Docker or locally
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  # Docker mode
  docker compose run --rm \
    -e RUN_ONCE=true \
    -e DRY_RUN="$DRY_RUN" \
    -e PUBLISH_ENABLED="$PUBLISH_ENABLED" \
    orchestrator
else
  # Local mode (for development)
  echo "⚠️  Docker not found, running locally..."
  cd "$PROJECT_DIR/shared"
  
  # Build if needed
  if [ ! -d "dist" ]; then
    echo "📦 Building shared modules..."
    npm run build 2>/dev/null || (npm install typescript && npx tsc)
  fi
  
  # Run orchestrator
  cd "$PROJECT_DIR"
  export WORKSPACE_DIR="$PROJECT_DIR/workspace"
  export MOLTBOOK_DIR="$PROJECT_DIR/moltbook"
  export CONFIG_DIR="$PROJECT_DIR/config"
  export LOGS_DIR="$PROJECT_DIR/logs"
  export STORE_DB="$PROJECT_DIR/workspace/store.db"
  
  # Ensure directories exist
  mkdir -p "$WORKSPACE_DIR" "$MOLTBOOK_DIR" "$CONFIG_DIR" "$LOGS_DIR"
  
  node agents/orchestrator/index.js
fi

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ Pipeline completed successfully"
else
  echo "❌ Pipeline failed with exit code $EXIT_CODE"
fi

# Show quick status
echo ""
echo "📊 Quick Status:"
./bin/moltbook-status.sh 2>/dev/null || echo "   (run ./bin/moltbook-status.sh for details)"

exit $EXIT_CODE
