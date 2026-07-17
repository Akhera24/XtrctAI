#!/bin/bash

# X-Analyzer Extension Build Script
# Builds the extension and performs necessary post-build steps

# Fail fast and loudly:
#   -e  abort on any command failure
#   -u  abort on undefined variables
#   -o pipefail  a failure anywhere in a pipeline fails the whole pipeline
# Without pipefail, piping webpack's output would mask a non-zero webpack exit.
set -euo pipefail

echo "🔧 Building X-Analyzer extension..."

# Run webpack build. `set -e` propagates a webpack failure as a non-zero exit,
# so a broken bundle can never be reported as a successful build.
npm run build

# Guard against credentials ever being packaged into the shipped bundle.
# The extension is distributed as a zip: anything in dist/ is public.
echo "🔍 Checking that no credentials leaked into dist/..."
if [ -f "dist/.env" ]; then
  echo "❌ dist/.env exists — credentials must never be packaged into the extension."
  exit 1
fi

if grep -rqE "AAAAAAAAAAAAAAAAAAAAA|xai-[A-Za-z0-9]{20}" dist/ 2>/dev/null; then
  echo "❌ A bearer-token-shaped string was found in dist/. Refusing to report success."
  exit 1
fi
echo "✅ No credentials found in dist/."

# Check if the dist directory contains all necessary files.
# These are exactly the paths manifest.json points at.
echo "🔍 Checking for required files..."
REQUIRED_FILES=(
  "manifest.json"
  "background.js"
  "content.js"
  "popup/popup.html"
  "popup/popup.js"
  "scripts/bridge.js"
  "scripts/debugging.js"
  "scripts/utils/uiHelpers.js"
  "scripts/utils/domHelpers.js"
  "icons/icon48.png"
)
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "dist/$file" ]; then
    MISSING_FILES+=("$file")
  fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
  echo "❌ Missing required files in dist:"
  for file in "${MISSING_FILES[@]}"; do
    echo "   - $file"
  done
  exit 1
else
  echo "✅ All required files are present."
fi

echo "🚀 Build completed successfully!"
echo "Load the extension from the 'dist' directory in Chrome's extension page."

echo "================================================"
echo "  Build Successful!"
echo "  Your extension is in the dist/ directory."
echo "================================================"
echo ""
echo "To load the extension in Chrome:"
echo "1. Go to chrome://extensions/"
echo "2. Enable Developer mode (toggle in top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'dist' directory"
echo ""
echo "The extension holds NO API credentials. All X API access goes through"
echo "the proxy server, which is the only place credentials live."
echo ""
echo "By default the extension talks to http://localhost:3000."
echo ""
echo "To point it at a deployed proxy you must edit manifest.json first — add the"
echo "origin to BOTH host_permissions and the CSP connect-src. Setting proxyUrl"
echo "alone is not enough; the CSP will block the request. Then:"
echo "  chrome.storage.local.set({ proxyUrl: 'https://your-proxy.example.com' })"
echo ""
echo "If analysis fails with 'Proxy server unreachable':"
echo "- Make sure the proxy from server/ is running"
echo "- Check the proxy's credentials are configured (server-side .env)"
echo "- Confirm the proxy host is allowed by manifest.json host_permissions"
echo "================================================"