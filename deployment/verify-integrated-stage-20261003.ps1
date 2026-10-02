$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$rg='rg-ucell-stage'
$results=@()
foreach($entry in @(@{name='member';url='https://stage.ucell.life'},@{name='admin';url='https://admin-stage.ucell.life'})){
 $html=Invoke-WebRequest -Uri $entry.url -TimeoutSec 30
 if($html.StatusCode -ne 200){throw 'Frontend HTML unavailable.'}
 $assets=@([regex]::Matches($html.Content,'(?:src|href)="(/assets/[^\"]+)"')|ForEach-Object{$_.Groups[1].Value}|Select-Object -Unique)
 if($assets.Count -lt 2){throw 'Frontend JS/CSS assets missing.'}
 foreach($asset in $assets+@('/ucell-logo-transparent.png')){
  $response=Invoke-WebRequest -Uri ($entry.url+$asset) -TimeoutSec 30
  $bytes=$response.RawContentStream.ToArray()
  $actual=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
  $local=Join-Path $repoRoot ($entry.name+'/dist'+$asset)
  $expected=(Get-FileHash -LiteralPath $local -Algorithm SHA256).Hash.ToLowerInvariant()
  if($actual -ne $expected){throw "Deployed asset mismatch: $($entry.name) $asset"}
  $results+=[pscustomobject]@{frontend=$entry.name;asset=$asset;status=$response.StatusCode;sha256=$actual;match=$true}
 }
}
$health=Invoke-RestMethod 'https://api-stage.ucell.life/api/v1/health' -TimeoutSec 30
$preflight=Invoke-WebRequest 'https://api-stage.ucell.life/api/v1/auth/member/password/login' -Method Options -Headers @{Origin='https://stage.ucell.life';'Access-Control-Request-Method'='POST'} -SkipHttpErrorCheck -TimeoutSec 30
if($preflight.StatusCode -ne 204 -or $preflight.Headers['Access-Control-Allow-Origin'] -ne 'https://stage.ucell.life'){throw 'Member auth CORS preflight failed.'}
$unauth=Invoke-WebRequest 'https://api-stage.ucell.life/api/v1/member/me' -SkipHttpErrorCheck -TimeoutSec 30
if($unauth.StatusCode -ne 401){throw 'Protected member route must reject unauthenticated requests.'}
$invalidLogin=Invoke-WebRequest 'https://api-stage.ucell.life/api/v1/auth/member/password/login' -Method Post -ContentType 'application/json' -Body '{"memberNo":"0000000000","password":"NOT_A_REAL_PASSWORD_20261003"}' -SkipHttpErrorCheck -TimeoutSec 30
if($invalidLogin.StatusCode -ne 401){throw 'Unknown Web member must not authenticate.'}
$state=@();foreach($name in @('ucell-stage-api','ucell-stage-worker','ucell-stage-admin','ucell-stage-member')){
 $item=az containerapp show --name $name --resource-group $rg --query '{name:name,image:properties.template.containers[0].image,revision:properties.latestReadyRevisionName}' -o json --only-show-errors|ConvertFrom-Json
 if($LASTEXITCODE -ne 0 -or $item.revision -ne ($name+'--r10b-integrated-20261003')){throw "New revision is not ready: $name"}
 $revision=az containerapp revision show --name $name --resource-group $rg --revision $item.revision --query '{health:properties.healthState,running:properties.runningState}' -o json --only-show-errors|ConvertFrom-Json
 if($LASTEXITCODE -ne 0 -or $revision.health -ne 'Healthy' -or $revision.running -ne 'Running'){throw "Unhealthy revision: $name"}
 $state+=[pscustomobject]@{name=$name;revision=$item.revision;image=$item.image;health=$revision.health;running=$revision.running}
}
[pscustomobject]@{verifiedAtUtc=[DateTime]::UtcNow.ToString('o');health=$health;cors='PASS';unauthenticatedMemberStatus=401;unknownPasswordLoginStatus=401;revisions=$state;assets=$results;browserVisualValidation='Unavailable: CUA runtime kernel assets path error'}|ConvertTo-Json -Depth 8|Set-Content (Join-Path $PSScriptRoot 'stage-integration-verification-20261003.json') -Encoding utf8
'INTEGRATED_STAGE_VERIFICATION_PASS'
