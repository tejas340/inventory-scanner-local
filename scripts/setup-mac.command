#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

echo ""
echo "Inventory Scanner Mac setup"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed yet."
  echo "Install Node.js 24 or newer from https://nodejs.org, then run this setup again."
  read -r -p "Press Return to close."
  exit 1
fi

NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 24 ]; then
  echo "This app needs Node.js 24 or newer."
  echo "Please update Node.js from https://nodejs.org, then run this setup again."
  read -r -p "Press Return to close."
  exit 1
fi

mkdir -p data exports backups certs
chmod +x "Start Inventory System.command" scripts/*.command

echo "Local folders are ready."
echo ""
echo "Optional: HTTPS certificates"
echo "The iPhone camera may require a secure address. This setup can create a local certificate if OpenSSL is available."
read -r -p "Create local HTTPS certificate now? [y/N] " CREATE_CERT

if [[ "$CREATE_CERT" =~ ^[Yy]$ ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo "OpenSSL was not found. You can still use manual barcode entry."
  else
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout certs/localhost-key.pem \
      -out certs/localhost.pem \
      -days 825 \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    echo "Certificate created in certs/."
    echo "For iPhone camera access, the iPhone must trust this certificate or use a trusted local certificate later."
  fi
fi

echo ""
echo "Setup complete."
echo "Open 'Start Inventory System.command' to run the app."
read -r -p "Press Return to close."
