$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$release=Get-Content (Join-Path $PSScriptRoot 'r11-geo-stage-release-20261003.json') -Raw|ConvertFrom-Json
$assets=@()
foreach($entry in @(@{name='admin';url='https://admin-stage.ucell.life'},@{name='member';url='https://stage.ucell.life'})){
 $html=Invoke-WebRequest -Uri $entry.url -TimeoutSec 30
 if($html.StatusCode -ne 200){throw 'Frontend unavailable.'}
 $paths=@([regex]::Matches($html.Content,'(?:src|href)="(/assets/[^\"]+)"')|ForEach-Object{$_.Groups[1].Value}|Select-Object -Unique)
 if($paths.Count -lt 2){throw 'Frontend assets missing.'}
 foreach($path in $paths+@('/ucell-logo-transparent.png')){
  $response=Invoke-WebRequest -Uri ($entry.url+$path) -TimeoutSec 30
  $actual=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($response.RawContentStream.ToArray())).ToLowerInvariant()
  $expected=(Get-FileHash -LiteralPath (Join-Path $repoRoot ($entry.name+'/dist'+$path)) -Algorithm SHA256).Hash.ToLowerInvariant()
  if($actual -ne $expected){throw "Asset mismatch: $($entry.name) $path"}
  $assets+=[pscustomobject]@{frontend=$entry.name;asset=$path;sha256=$actual;match=$true}
 }
}
$health=Invoke-WebRequest 'https://api-stage.ucell.life/api/v1/health' -TimeoutSec 30
if($health.StatusCode -ne 200){throw 'API health failed.'}
$time=[DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
$query='?rootBallNo=A000001&dateFrom=2026-01-01T00%3A00%3A00.000Z&dateTo='+[uri]::EscapeDataString($time)+'&asOf='+[uri]::EscapeDataString($time)+'&knowledgeCutoff='+[uri]::EscapeDataString($time)
foreach($route in @('summary','export')){
 $response=Invoke-WebRequest ('https://api-stage.ucell.life/api/v1/admin/organization/geo/'+$route+$query) -SkipHttpErrorCheck -TimeoutSec 30
 if($response.StatusCode -ne 401){throw "Anonymous Geo $route must return 401, got $($response.StatusCode)."}
}
$member=Invoke-WebRequest 'https://api-stage.ucell.life/api/v1/member/me' -SkipHttpErrorCheck -TimeoutSec 30
if($member.StatusCode -ne 401){throw 'Member authentication boundary regressed.'}
$states=@()
foreach($name in @('ucell-stage-api','ucell-stage-worker','ucell-stage-admin','ucell-stage-member')){
 $item=az containerapp show --name $name --resource-group rg-ucell-stage --query '{name:name,image:properties.template.containers[0].image,revision:properties.latestReadyRevisionName}' -o json --only-show-errors|ConvertFrom-Json
 if($LASTEXITCODE -ne 0){throw 'Cannot inspect Stage revision.'}
 $expectedRevision=$name+$(if($name -eq 'ucell-stage-member'){'--r10b-integrated-20261003'}else{'--r11-geo-20261003'})
 if($item.revision -ne $expectedRevision){throw "Revision not ready: $name"}
 $expectedImage=if($name -eq 'ucell-stage-admin'){$release.adminImage}elseif($name -ne 'ucell-stage-member'){$release.apiImage}else{'ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-member@sha256:0976b4d3316021d1ac4088eadcbb6e9a365673886a4184b086783bf4720d65bf'}
 if($item.image -ne $expectedImage){throw "Unexpected runtime image: $name"}
 $state=az containerapp revision show --name $name --resource-group rg-ucell-stage --revision $item.revision --query '{health:properties.healthState,running:properties.runningState}' -o json --only-show-errors|ConvertFrom-Json
 if($LASTEXITCODE -ne 0 -or $state.health -ne 'Healthy' -or $state.running -ne 'Running'){throw "Revision unhealthy: $name"}
 $states+=[pscustomobject]@{name=$name;revision=$item.revision;image=$item.image;health=$state.health;running=$state.running}
}
[pscustomobject]@{verifiedAtUtc=[DateTime]::UtcNow.ToString('o');apiHealthStatus=200;anonymousGeoSummaryStatus=401;anonymousGeoExportStatus=401;unauthenticatedMemberStatus=401;revisions=$states;assets=$assets;authenticatedGeoUat='PENDING: Entra configuration and desktop/mobile evidence';externalProviderSetup='PENDING: native browser safety URL verification blocks interaction'}|ConvertTo-Json -Depth 8|Set-Content (Join-Path $PSScriptRoot 'r11-geo-stage-verification-20261003.json') -Encoding utf8
'R11_GEO_STAGE_VERIFICATION_PASS'
