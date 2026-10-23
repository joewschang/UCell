param([ValidateSet('member','admin')][string]$App,[switch]$AssetsOnly)
$ErrorActionPreference='Stop'
if(!$App){throw 'Specify -App member or admin'}
$repo=Split-Path $PSScriptRoot -Parent
$env:VITE_API_BASE_URL='https://api.ucell.life/api/v1'
$env:VITE_APP_ENV='production'
$env:VITE_ENABLE_MOCK='false'
$env:VITE_ENABLE_DEMO_LOGIN='false'
$env:VITE_STAGE_UAT_DEMO_LOGIN='false'
if($App -eq 'member'){
 $env:VITE_LIFF_ID='2012021712-Dqh6Z8aq'
 $env:VITE_GOOGLE_OIDC_CLIENT_ID='624267916918-10vr4skhkfdtcc9f708sppios9s01tn1.apps.googleusercontent.com'
}else{
 $env:VITE_ENTRA_CLIENT_ID='0dd08c48-b6e9-4b19-b67a-d3de401f9092'
 $env:VITE_ENTRA_TENANT_ID='2ed64e97-b7a4-4627-ac8b-44e2b95cef3b'
 $env:VITE_ENTRA_REDIRECT_URI='https://admin.ucell.life/login'
}
Push-Location (Join-Path $repo $App)
try{
 if($AssetsOnly){
  pnpm exec tsc --noEmit
  if($LASTEXITCODE -ne 0){throw 'Type check failed'}
  node ../deployment/build-web-assets.cjs $App
 }else{pnpm build}
 if($LASTEXITCODE -ne 0){throw 'Production web build failed'}
 $bundles=Get-ChildItem -LiteralPath 'dist/assets' -Filter '*.js'
 $matched=$bundles | Where-Object {[IO.File]::ReadAllText($_.FullName).Contains('https://api.ucell.life/api/v1')}
 if(!$matched){throw 'Production API endpoint missing from generated bundle'}
 node ../deployment/verify-web-login-config.cjs $App
 if($LASTEXITCODE -ne 0){throw 'Production login configuration missing'}
 Write-Output 'PRODUCTION_API_ENDPOINT_VERIFIED'
}finally{Pop-Location}
