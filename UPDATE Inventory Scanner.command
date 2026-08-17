#!/bin/bash
set -e

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

REPO_ZIP="https://github.com/tejas340/inventory-scanner-local/archive/refs/heads/main.zip"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo ""
echo "Updating Inventory Scanner..."
echo "Your inventory database, HTTPS certificates, exports, and backups will be kept."
echo ""

mkdir -p data exports backups certs

if [ -f data/inventory.db ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  cp data/inventory.db "backups/pre-update-$TS.db"
  echo "Safety backup created: backups/pre-update-$TS.db"
fi

echo "Downloading latest version from GitHub..."
curl -fL --retry 3 --connect-timeout 10 "$REPO_ZIP" -o "$TMP_DIR/update.zip"
unzip -q "$TMP_DIR/update.zip" -d "$TMP_DIR"
SOURCE_DIR="$TMP_DIR/inventory-scanner-local-main"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Update download could not be opened. Nothing was changed."
  read -r -p "Press Return to close."
  exit 1
fi

# Update application code while preserving local/personal data.
rsync -a --delete \
  --exclude='.git/' \
  --exclude='data/' \
  --exclude='exports/' \
  --exclude='backups/' \
  --exclude='certs/' \
  "$SOURCE_DIR/" "$APP_DIR/"

chmod +x "$APP_DIR"/*.command "$APP_DIR"/scripts/*.command 2>/dev/null || true

LOCAL_VERSION="$(cat "$APP_DIR/VERSION" 2>/dev/null || echo latest)"
echo ""
echo "Update complete. Version: $LOCAL_VERSION"
echo "Your inventory and HTTPS setup were not deleted."
echo ""
read -r -p "Press Return to close."
