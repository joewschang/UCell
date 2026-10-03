$ErrorActionPreference='Stop'
$rg='rg-ucell-stage'
$source='51a94960d962e77fde4194097ab7c2084e8fab11'
$api='ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-api@sha256:839d23bebd06033e29117a3a7bca948ca680e10616586e15c6628fe5752d91d8'
$member='ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-member@sha256:5b68ec14822b15aaf047b4c6101ff65b5643c580061cf52e2bff4fe0f1de1dbb'
function AzChecked([string[]]$Arguments){$result=& az @Arguments;if($LASTEXITCODE -ne 0){throw 'Stage Azure operation failed'};$result}
function WaitHealthy([string]$app){
 for($n=0;$n -lt 60;$n++){
  $r=AzChecked @('containerapp','revision','show','--name',$app,'--resource-group',$rg,'--revision',"$app--formal-enrollment-20261003",'--query','{health:properties.healthState,running:properties.runningState}','-o','json','--only-show-errors')|ConvertFrom-Json
  if($r.health -eq 'Healthy' -and $r.running -eq 'Running'){return $r}
  if($r.health -eq 'Unhealthy' -or $r.running -eq 'Failed'){throw 'Stage revision failed health check'}
  Start-Sleep -Seconds 5
 }
 throw 'Stage readiness timed out'
}
$regression='C:/UCell/logs/formal-enrollment-api-full-20261003.log'
for($n=0;$n -lt 120;$n++){
 if(Select-String -LiteralPath $regression -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet){break}
 if(Select-String -LiteralPath $regression -Pattern 'isolated Jest child failed' -Quiet){throw 'Full API regression failed'}
 Start-Sleep -Seconds 5
}
if(-not(Select-String -LiteralPath $regression -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet)){throw 'Full API regression required'}
if(-not(Select-String -LiteralPath 'C:/UCell/logs/formal-enrollment-member-tests-final-20261003.log' -Pattern '239 passed' -Quiet)){throw 'Member regression required'}
$migration=(AzChecked @('containerapp','job','execution','show','--name','ucell-stage-migrate','--resource-group',$rg,'--job-execution-name','ucell-stage-migrate-7m2ebao','--query','properties.status','-o','tsv','--only-show-errors')).Trim()
if($migration -ne 'Succeeded'){throw 'Stage migration required'}
AzChecked @('containerapp','update','--name','ucell-stage-api','--resource-group',$rg,'--image',$api,'--revision-suffix','formal-enrollment-20261003','--set-env-vars',"RELEASE_GIT_HEAD=$source",'STAGE_PAYMENT_MODE=ASSUME_PAID','KYC_STORAGE_ACCOUNT_NAME=ucellst5mafbbsq33mgu','KYC_STORAGE_CONTAINER=kyc-stage-private','KYC_STORAGE_MANAGED_IDENTITY_CLIENT_ID=1693fef5-f8f9-4f12-9b43-213298e5272e','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
$apiHealth=WaitHealthy 'ucell-stage-api'
AzChecked @('containerapp','update','--name','ucell-stage-member','--resource-group',$rg,'--image',$member,'--revision-suffix','formal-enrollment-20261003','--set-env-vars',"RELEASE_GIT_HEAD=$source",'--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
$memberHealth=WaitHealthy 'ucell-stage-member'
[pscustomobject]@{sourceCommit=$source;apiImage=$api;memberImage=$member;apiHealth=$apiHealth;memberHealth=$memberHealth;migrationExecution='ucell-stage-migrate-7m2ebao';migrationStatus=$migration;catalogSeedExecution='ucell-stage-migrate-s0hq5yf';privateStorageProbeExecution='ucell-stage-migrate-oo04ova';stagePaymentMode='ASSUME_PAID';realCharge=$false;automaticFormalApproval=$false;stagePreviewOnly=$true;deployedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $PSScriptRoot 'formal-enrollment-stage-release-20261003.json') -Encoding utf8
