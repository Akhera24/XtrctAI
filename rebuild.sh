#!/bin/bash

# X-Analyzer Extension Rebuild Script

# Fail fast: a copy that silently fails must not report a successful build.
set -euo pipefail

echo "🔄 Rebuilding X-Analyzer extension..."

# Create dist directory if it doesn't exist
if [ ! -d "dist" ]; then
  mkdir -p dist
  echo "📁 Created dist directory."
fi

# Copy static assets
echo "📄 Copying static assets..."
cp -r icons dist/
cp -r styles dist/
cp -r popup dist/
cp manifest.json dist/
# NOTE: .env is deliberately NOT copied into dist/. The extension bundle is
# distributed to users and cannot hold secrets — credentials belong to the proxy
# server only. Copying .env here would ship them to every user who installs it.

# Add a fallback logo (if missing)
if [ ! -f "dist/icons/logo.png" ]; then
  echo "🖼️ Adding fallback logo..."
  cp dist/icons/icon48.png dist/icons/logo.png
fi

# Copy scripts directly for simpler development
echo "📜 Copying scripts..."
mkdir -p dist/scripts
cp scripts/*.js dist/scripts/

echo "✅ Build completed!"
echo "📌 Load the extension from the 'dist' directory in Chrome." 