#!/bin/bash

# Publish all Pyra packages to npm in the correct order
# Usage: ./publish-all.sh

set -e  # Exit on error

echo "🚀 Publishing Pyra packages to npm..."
echo ""

# 1. Publish @pyra/shared
echo "📦 Publishing @pyra/shared..."
cd packages/shared
npm publish
echo "✅ @pyra/shared published"
echo ""

# 2. Publish @pyra/core
echo "📦 Publishing @pyra/core..."
cd ../core
npm publish
echo "✅ @pyra/core published"
echo ""

# 3. Publish @pyra/cli
echo "📦 Publishing @pyra/cli..."
cd ../cli
npm publish
echo "✅ @pyra/cli published"
echo ""

echo "🎉 All packages published successfully!"
echo ""
echo "Users can now install with:"
echo "  npm install -D @pyra/cli"
echo "  npx @pyra/cli create my-app"
