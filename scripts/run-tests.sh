#!/bin/bash
set -e

echo "🧪 Running test suite..."
cd /vercel/share/v0-project
pnpm test --run
echo "✅ Test suite completed!"
