#!/usr/bin/env bash
# Start the local dev server for manual testing.
set -euo pipefail
cd "$(dirname "$0")"
npm run dev
