# Stage 25 → 39 migration preflight

This preflight is a read-only release guard for the known Stage upgrade risks before `prisma migrate deploy`. It does not connect to Azure, retrieve secrets, deploy resources, repair data, or run migrations.

It checks:

- failed or incomplete rows in `public._prisma_migrations`;
- applied migration checksums against every repository `migration.sql`;
- the prerequisite `public.ucell_prevent_mutation()` function;
- more than one open Binary placement for the same parent Qualification and side;
- more than one open formal application for the same Person;
- more than one current delivery profile for the same Person.

The last three checks protect the partial unique indexes introduced or reinforced between the 25-migration Stage baseline and the current 39-migration target. A conflict blocks migration. This tool deliberately reports aggregate counts only and never changes the conflicting rows. Resolution requires an approved, separately reviewed data remediation with retained evidence.

## Explicit execution

`psql` must be installed. Supply `DATABASE_URL` through the process environment; never put it in a command argument, log, file, or source control. The operator must also select a permitted non-Production environment and opt in to the read-only database access:

```powershell
$env:UCELL_ENVIRONMENT = 'STAGE' # or CONNECTED_DEV
$env:UCELL_UPGRADE_PREFLIGHT_OPT_IN = 'READ_ONLY_PREFLIGHT'
$env:DATABASE_URL = '<injected by the approved secret boundary>'
node deployment/stage-upgrade-preflight.mjs
```

Missing or invalid environment, opt-in, `DATABASE_URL`, `psql`, migration history, checksum, prerequisite function, or uniqueness evidence returns `BLOCKED` and a nonzero exit code. `PRODUCTION` is rejected. A `PASS` authorizes only the next reviewed Stage migration step; it is not deployment, UAT, credential verification, or Production evidence.

Run the offline/static regression without any database or credential:

```powershell
node --test deployment/stage-upgrade-preflight.test.mjs
```
