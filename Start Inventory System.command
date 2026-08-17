#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo ""
echo "Starting Inventory Scanner..."
echo ""

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

echo "Inventory Scanner is starting."
echo "Keep this window open while using the iPhone scanner."
echo ""

npm start
