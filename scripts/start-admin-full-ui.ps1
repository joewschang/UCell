$ErrorActionPreference = 'Stop'
$taskRepo = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath (Join-Path $taskRepo 'admin')
$env:VITE_ENABLE_DEMO_LOGIN = 'true'
$env:VITE_ADMIN_DEV_READ_ONLY = 'false'
$env:VITE_ADMIN_DEV_FULL_ACCESS = 'true'
$env:VITE_DEV_API_PROXY = 'http://127.0.0.1:3001'
pnpm dev --host 127.0.0.1 --strictPort
exit $LASTEXITCODE
