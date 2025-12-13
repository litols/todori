#!/usr/bin/env bash
#
# MCP Inspector launcher for Todori
#
# This script launches the MCP Inspector GUI to test the Todori MCP server.
# The Inspector provides a visual interface to test tools, prompts, and resources.
#
# Usage:
#   ./scripts/inspect.sh                 # Use bun runtime (recommended)
#   ./scripts/inspect.sh node            # Use node runtime
#

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Determine runtime (default: bun)
RUNTIME="${1:-bun}"

# Check if build exists
if [ ! -f "dist/server/index.js" ]; then
    echo -e "${YELLOW}Build not found. Running build...${NC}"
    bun run build:dist
fi

# Display info
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Todori MCP Inspector${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "Runtime: ${YELLOW}$RUNTIME${NC}"
echo -e "Server:  ${YELLOW}dist/server/index.js${NC}"
echo -e "UI URL:  ${YELLOW}http://localhost:6274${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}Starting MCP Inspector...${NC}"
echo -e "The inspector GUI will open in your browser."
echo -e "Press ${YELLOW}Ctrl+C${NC} to stop."
echo ""

# Launch MCP Inspector
# The inspector will:
# 1. Start a proxy server on port 6274
# 2. Launch the Todori MCP server as a subprocess
# 3. Open the web UI in your browser
exec npx @modelcontextprotocol/inspector "$RUNTIME" dist/server/index.js
