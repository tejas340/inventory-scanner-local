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
echo "iPhone camera HTTPS setup"
echo "Live camera scanning on iPhone requires a trusted HTTPS address."
read -r -p "Set up trusted local HTTPS now? [Y/n] " CREATE_CERT
CREATE_CERT="${CREATE_CERT:-Y}"

if [[ "$CREATE_CERT" =~ ^[Yy]$ ]]; then
  if ! command -v mkcert >/dev/null 2>&1; then
    if command -v brew >/dev/null 2>&1; then
      echo "mkcert is not installed. Installing it with Homebrew..."
      brew install mkcert
    else
      echo ""
      echo "mkcert is required for the easiest trusted iPhone camera setup."
      echo "Install Homebrew first, then run: brew install mkcert"
      echo "After that, run this setup again."
      read -r -p "Press Return to close."
      exit 1
    fi
  fi

  echo "Creating a local trusted certificate authority..."
  mkcert -install

  IPS=()
  while IFS= read -r ip; do
    [[ -n "$ip" ]] && IPS+=("$ip")
  done < <(ifconfig 2>/dev/null | awk '/inet / {print $2}' | grep -Ev '^(127\.|169\.254\.)' | sort -u)

  LOCAL_NAME="$(scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null || echo inventory-mac)"
  HOSTS=("localhost" "127.0.0.1" "::1" "${LOCAL_NAME}.local")
  for ip in "${IPS[@]}"; do
    HOSTS+=("$ip")
  done

  rm -f certs/localhost-key.pem certs/localhost.pem
  mkcert \
    -key-file certs/localhost-key.pem \
    -cert-file certs/localhost.pem \
    "${HOSTS[@]}"

  CAROOT="$(mkcert -CAROOT)"
  cp "$CAROOT/rootCA.pem" "$HOME/Desktop/Inventory Scanner Root CA.pem"

  echo ""
  echo "HTTPS certificate created for this Mac and its current local IP address(es)."
  echo "A SAFE public root certificate was copied to:"
  echo "$HOME/Desktop/Inventory Scanner Root CA.pem"
  echo ""
  echo "IMPORTANT: Never share rootCA-key.pem from the mkcert folder."
  echo ""
  echo "On the iPhone:"
  echo "1. AirDrop 'Inventory Scanner Root CA.pem' from the Desktop to the iPhone."
  echo "2. Install the downloaded profile in Settings."
  echo "3. Go to Settings > General > About > Certificate Trust Settings."
  echo "4. Enable full trust for the Inventory Scanner/mkcert root certificate."
  echo "5. Start the Inventory Scanner again and open the HTTPS address shown in Terminal."
  echo ""
fi

echo "Setup complete."
echo "Open 'Start Inventory System.command' to run the app."
read -r -p "Press Return to close."