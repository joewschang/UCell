#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL required}"
OUT="${1:-ucell_$(date +%Y%m%d_%H%M%S).dump}"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$OUT"
sha256sum "$OUT" > "$OUT.sha256"
echo "$OUT"
