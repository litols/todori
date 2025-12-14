#!/bin/bash
set -e

echo "==> Installing dependencies with Bun..."
bun install

echo "==> Building project..."
bun run build:dist

echo "==> Setup complete!"
echo ""
echo "To use Claude Code, ensure you have:"
echo "  1. ANTHROPIC_API_KEY set in your environment, or"
echo "  2. ~/.claude directory mounted with valid credentials"
echo ""
echo "Run 'claude' to start Claude Code"
