#!/usr/bin/env bash
# Runs the unchanged OpenAPI governance gate from a minimal Linux workspace.
# Intended for WSL when the source checkout is mounted from Windows.
set -euo pipefail
SOURCE_ROOT="${UCELL_OPENAPI_SOURCE_ROOT:-$(pwd)}"
WORKSPACE="${UCELL_OPENAPI_LINUX_WORKSPACE:-/tmp/ucell-openapi-governance}"
NODE_BIN="${UCELL_OPENAPI_NODE_BIN:-$HOME/.local/node/bin}"
export PATH="$NODE_BIN:$PATH"
: "${OASDIFF_BIN:?Set OASDIFF_BIN to the verified pinned Linux oasdiff binary}"
: "${DATABASE_URL:?Set DATABASE_URL to a disposable local PostgreSQL control database}"
[ -f "$SOURCE_ROOT/backend/pnpm-lock.yaml" ] || { echo "UCELL_OPENAPI_SOURCE_ROOT is not a UCell checkout" >&2; exit 2; }
rm -rf "$WORKSPACE"
mkdir -p "$WORKSPACE"
(
  cd "$SOURCE_ROOT"
  tar --exclude='backend/node_modules' --exclude='backend/**/node_modules' \
    --exclude='backend/**/dist' --exclude='backend/coverage' --exclude='.git' \
    -cf - backend governance/swaggerhub | tar -xf - -C "$WORKSPACE"
)
cd "$WORKSPACE/backend"
"$NODE_BIN/corepack" enable
"$NODE_BIN/corepack" prepare pnpm@12.4.1 --activate
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @ucell/contracts build
pnpm --filter @ucell/shared build
pnpm --filter @ucell/database build
pnpm --filter @ucell/api build
node --version
"$OASDIFF_BIN" --version
node scripts/openapi-governance.mjs gate