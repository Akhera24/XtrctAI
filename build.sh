#!/bin/bash

# X-Analyzer Extension Build Script
# Builds the extension and performs necessary post-build steps

# Set up error handling
set -e

echo "🔧 Building X-Analyzer extension..."

# Run webpack build
npm run build

# Ensure proxy service worker is available
if [ -f "dist/proxy-service-worker.js" ]; then
  echo "✅ Proxy service worker is available."
else
  echo "❌ Proxy service worker not found in dist! Copying manually..."
  cp proxy-service-worker.js dist/
fi

# Ensure manifest is correctly set up
echo "🔍 Verifying manifest.json..."
if grep -q "proxy-service-worker.js" dist/manifest.json; then
  echo "✅ Manifest references proxy-service-worker.js correctly."
else
  echo "⚠️ Warning: proxy-service-worker.js might not be referenced in manifest.json"
fi

# Check if the dist directory contains all necessary files
echo "🔍 Checking for required files..."
REQUIRED_FILES=("manifest.json" "background.js" "popup/popup.html" "icons/icon48.png" "proxy-service-worker.js")
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
echo "If you encounter 'message port closed' errors:"
echo "- Check console logs for details"
echo "- Verify your proxy credentials in .env"
echo "- Make sure your API keys are valid"
echo "================================================" 