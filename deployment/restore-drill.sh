#!/usr/bin/env bash
set -euo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL required}"
: "${1:?backup dump required}"
sha256sum -c "$1.sha256"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$1"
echo RESTORE_DRILL_COMPLETED
