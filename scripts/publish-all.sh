#!/bin/bash

# Publish all Pyra packages to npm in the correct order
# Build order: shared → core → adapter-react → cli → create-pyra

set -e  # Exit on error

echo "Publishing Pyra packages to npm..."
echo ""

# 1. pyrajs-shared (no internal deps)
echo "📦 Publishing pyrajs-shared..."
cd packages/shared
npm publish
echo "✅ pyrajs-shared published"
echo ""

# 2. pyrajs-core (depends on shared)
echo "📦 Publishing pyrajs-core..."
cd ../core
npm publish
echo "✅ pyrajs-core published"
echo ""

# 3. pyrajs-adapter-react (depends on shared)
echo "📦 Publishing pyrajs-adapter-react..."
cd ../adapter-react
npm publish
echo "✅ pyrajs-adapter-react published"
echo ""

# 4. pyrajs-cli (depends on shared, core, adapter-react)
echo "📦 Publishing pyrajs-cli..."
cd ../cli
npm publish
echo "✅ pyrajs-cli published"
echo ""

# 5. create-pyra (standalone)
echo "📦 Publishing create-pyra..."
cd ../create-pyra
npm publish
echo "✅ create-pyra published"
echo ""

echo "🎉 All packages published successfully!"
echo ""
echo "Users can now get started with:"
echo "  npm create pyra my-app"
echo ""
