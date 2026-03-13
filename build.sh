#!/bin/bash
set -e

echo "Building vscode-multi-model extension..."

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not installed"
  exit 1
fi

npm install

npm run compile

npm test

if ! command -v vsce &> /dev/null; then
  echo "Installing @vscode/vsce..."
  npm install -g @vscode/vsce
fi

vsce package

VSIX_FILE=$(ls -t *.vsix 2>/dev/null | head -1)
if [ -n "$VSIX_FILE" ]; then
  echo ""
  echo "Build successful: $VSIX_FILE"
  echo ""
  echo "Install with:"
  echo "  code --install-extension $VSIX_FILE"
else
  echo "Error: .vsix file not found"
  exit 1
fi
