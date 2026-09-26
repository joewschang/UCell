#!/usr/bin/env bash
# Restore a custom-format PostgreSQL dump into a caller-provisioned disposable target
# and verify only structural and safe aggregate integrity. The caller destroys the target.
set -euo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL required}"
: "${1:?backup dump required}"
DUMP="$1"
: "${EXPECTED_MIGRATION_COUNT:?EXPECTED_MIGRATION_COUNT required}"
command -v pg_restore >/dev/null
command -v psql >/dev/null
sha256sum -c "$DUMP.sha256"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$RESTORE_DATABASE_URL" "$DUMP"
actual_migrations="$(psql "$RESTORE_DATABASE_URL" -Atqc 'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL' 2>/dev/null || true)"
if [[ ! "$actual_migrations" =~ ^[0-9]+$ ]] || [[ "$actual_migrations" != "$EXPECTED_MIGRATION_COUNT" ]]; then
  echo "RESTORE_SCHEMA_INTEGRITY_FAILED expected_migrations=$EXPECTED_MIGRATION_COUNT actual_migrations=${actual_migrations:-unavailable}" >&2
  exit 1
fi
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
  SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='identity' AND table_name='person')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='membership' AND table_name='qualification')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='commerce' AND table_name='order')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='audit' AND table_name='audit_event')
              THEN 'RESTORE_CRITICAL_SCHEMA_PASS' ELSE 'RESTORE_CRITICAL_SCHEMA_FAIL' END;" | grep -qx 'RESTORE_CRITICAL_SCHEMA_PASS'
echo "RESTORE_DRILL_COMPLETED migration_count=$actual_migrations"

