#!/bin/bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ""
echo "Starting Inventory Scanner..."
echo ""

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "$APP_DIR" >/dev/null 2>&1 || true
fi

mkdir -p data exports backups certs
chmod +x "$APP_DIR"/*.command "$APP_DIR"/scripts/*.command >/dev/null 2>&1 || true

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed yet."
  echo "Install Node.js 24 or newer from https://nodejs.org, then open this file again."
  read -r -p "Press Return to close."
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "This app needs Node.js 24 or newer."
  echo "Please update Node.js from https://nodejs.org, then open this file again."
  read -r -p "Press Return to close."
  exit 1
fi

# Lightweight update check. If the internet is unavailable, startup continues normally.
LOCAL_VERSION="$(cat VERSION 2>/dev/null || echo 0)"
REMOTE_VERSION="$(curl -fsL --connect-timeout 3 https://raw.githubusercontent.com/tejas340/inventory-scanner-local/main/VERSION 2>/dev/null | tr -d '\r\n' || true)"
if [ -n "$REMOTE_VERSION" ] && [ "$REMOTE_VERSION" != "$LOCAL_VERSION" ] && [ -f "UPDATE Inventory Scanner.command" ]; then
  echo "A newer Inventory Scanner version is available ($LOCAL_VERSION -> $REMOTE_VERSION)."
  echo "Updating automatically without touching inventory data or HTTPS certificates..."
  echo ""
  bash "UPDATE Inventory Scanner.command" </dev/null || echo "Automatic update failed; starting the installed version instead."
  echo ""
fi

echo "Inventory Scanner is starting."
echo "Keep this window open while using the iPhone scanner."
echo ""

PROTOCOL="http"
if [ -f certs/localhost.pem ] && [ -f certs/localhost-key.pem ]; then
  PROTOCOL="https"
fi

(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$PROTOCOL://localhost:${PORT:-3765}" >/dev/null 2>&1 || true
  fi
) &

npm start
