$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath (Join-Path $taskRepo 'backend')
$env:NODE_ENV = 'development'
$env:ADMIN_AUTH_BYPASS = 'true'
$env:UCELL_ADMIN_DEV_READ_ONLY = 'false'
$env:UCELL_ADMIN_DEV_FULL_ACCESS = 'true'
$env:DATABASE_URL = 'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell_admin_test?schema=public'
pnpm --filter @ucell/api build:admin-dev
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
pnpm --filter @ucell/api start:admin-dev
exit $LASTEXITCODE
