#!/bin/bash

# Publish all Pyra packages to npm in the correct order
# Build order: shared → core → adapter-react → cli → create-pyra

set -e  # Exit on error

echo "Publishing Pyra packages to npm..."
echo ""

# 1. pyrajs-shared (no internal deps)
echo "📦 Publishing pyrajs-shared..."
cd ../packages/shared
pnpm publish --access public --no-git-checks
echo "✅ pyrajs-shared published"
echo ""

# 2. pyrajs-core (depends on shared)
echo "📦 Publishing pyrajs-core..."
cd ../core
pnpm publish --access public --no-git-checks
echo "✅ pyrajs-core published"
echo ""

# 3. pyrajs-adapter-react (depends on shared)
echo "📦 Publishing pyrajs-adapter-react..."
cd ../adapter-react
pnpm publish --access public --no-git-checks
echo "✅ pyrajs-adapter-react published"
echo ""

# 4. pyrajs-cli (depends on shared, core, adapter-react)
echo "📦 Publishing pyrajs-cli..."
cd ../cli
pnpm publish --access public --no-git-checks
echo "✅ pyrajs-cli published"
echo ""

# 5. create-pyra (standalone)
echo "📦 Publishing create-pyra..."
cd ../create-pyra
pnpm publish --access public --no-git-checks
echo "✅ create-pyra published"
echo ""

echo "🎉 All packages published successfully!"
echo ""
echo "Users can now get started with:"
echo "  npm create pyra my-app"
echo ""
