#!/bin/bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ""
echo "Inventory Scanner"
echo "This window keeps the scanner running."
echo "Close this window when you are done for the day."
echo ""

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP_DIR" >/dev/null 2>&1 || true
fi

mkdir -p data exports backups certs
chmod +x "CLICK TO START - Inventory Scanner.command" "Start Inventory System.command" scripts/*.command >/dev/null 2>&1 || true

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found."
  echo "Node.js is already installed sometimes, but Mac does not expose it to this click window."
  echo "Please install Node.js 24 or newer from https://nodejs.org and restart the Mac."
  echo ""
  read -r -p "Press Return to close."
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "This app needs Node.js 24 or newer."
  echo "Please update Node.js from https://nodejs.org, then open this file again."
  echo ""
  read -r -p "Press Return to close."
  exit 1
fi

PORT="${PORT:-3765}"
MAC_URL="http://localhost:${PORT}"

echo "Starting the inventory scanner..."
echo "The Mac browser will open automatically."
echo ""

(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$MAC_URL" >/dev/null 2>&1 || true
  fi
) &

npm start
