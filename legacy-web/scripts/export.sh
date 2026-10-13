#!/usr/bin/env bash
# Static export: temporarily move /src/app/api out of the way (since Next
# output:'export' can't handle API routes), build, restore.
set -e
API_DIR="src/app/api"
API_TMP=".api-tmp"

if [ -d "$API_DIR" ]; then
  mv "$API_DIR" "$API_TMP"
fi

restore() {
  if [ -d "$API_TMP" ]; then
    mv "$API_TMP" "$API_DIR"
  fi
}
trap restore EXIT

STATIC_EXPORT=1 npx next build
node scripts/spa-fallback.mjs
echo "✅ Static export done in out/"
