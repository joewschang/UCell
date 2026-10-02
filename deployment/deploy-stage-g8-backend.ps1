# Controlled incremental Stage update. Frontend updates are explicit; existing
# Container App secrets, custom domains and TLS are retained.
[CmdletBinding()]
param(
  [string]$ResourceGroup='rg-ucell-stage',
  [string]$Acr='ucellstageacr5mafbbsq33mgu',
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9._-]{0,127}$')][string]$ImageTag,
  [ValidateSet('Local','Acr')][string]$ContainerBuildMode='Local',
  [switch]$UseExistingImages,
  [switch]$IncludeFrontends,
  [string]$LiffId='',
  [string]$LineLoginChannelId='',
  [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
if($ResourceGroup -ne 'rg-ucell-stage'){throw 'Incremental update is restricted to rg-ucell-stage.'}
if($LineLoginChannelId -and $LineLoginChannelId -notmatch '^\d+$'){throw 'Invalid LINE Login Channel ID.'}
if($LiffId -and $LiffId -notmatch '^\d+-[A-Za-z0-9]+$'){throw 'Invalid LIFF ID.'}
function Invoke-Az([string[]]$Arguments){
  $out=az @Arguments --only-show-errors
  if($LASTEXITCODE -ne 0){throw "Azure CLI failed: az $($Arguments -join ' ')"}
  return $out
}
function Json([string[]]$Arguments){return (Invoke-Az -Arguments $Arguments | ConvertFrom-Json)}
function Require-ExistingSecretReference([string]$App,[string]$Name,[switch]$Job){
  $query=if($Job){@('containerapp','job','show','--resource-group',$ResourceGroup,'--name',$App,'-o','json')}else{@('containerapp','show','--resource-group',$ResourceGroup,'--name',$App,'-o','json')}
  $state=Json $query
  $found=@($state.properties.template.containers[0].env|Where-Object {$_.name -eq $Name -and $_.secretRef})
  if($found.Count -ne 1){throw "$App must retain existing secret reference $Name; update is refused."}
  return $state
}

$api=Require-ExistingSecretReference 'ucell-stage-api' 'DATABASE_URL'
if($IncludeFrontends){
 if(@($api.properties.template.containers[0].env|Where-Object {$_.name -eq 'ENTRA_CLIENT_ID'}).Count){throw 'Preserve existing Entra frontend settings explicitly before updating this configured environment.'}
 if(-not $LiffId -and @($api.properties.template.containers[0].env|Where-Object {$_.name -eq 'LINE_LOGIN_CHANNEL_ID'}).Count){throw 'Supply the existing LIFF ID to preserve configured LINE login.'}
}
[void](Require-ExistingSecretReference 'ucell-stage-api' 'PII_ENCRYPTION_KEY')
[void](Require-ExistingSecretReference 'ucell-stage-api' 'STAGE_UAT_MEMBER_TOKEN')
[void](Require-ExistingSecretReference 'ucell-stage-worker' 'DATABASE_URL')
[void](Require-ExistingSecretReference 'ucell-stage-worker' 'PII_ENCRYPTION_KEY')
$migrationJob=Require-ExistingSecretReference 'ucell-stage-migrate' 'DATABASE_URL' -Job
$previousMigrationImage=$migrationJob.properties.template.containers[0].image
$previousMigrationCommand=@($migrationJob.properties.template.containers[0].command)
$previousMigrationArgs=@($migrationJob.properties.template.containers[0].args)
if($previousMigrationImage -notmatch '@sha256:[0-9a-f]{64}$'){throw 'Migration Job must start from a digest-pinned image.'}

$server=(Invoke-Az @('acr','show','--name',$Acr,'--query','loginServer','-o','tsv')).Trim()
foreach($item in @(@{repository='ucell-backend';dockerfile='deployment/Dockerfile.backend'},@{repository='ucell-worker';dockerfile='deployment/Dockerfile.worker'})){
  if($UseExistingImages){continue} # Resolve-Digest below still requires both exact tags to exist.
  if($ContainerBuildMode -eq 'Acr'){
    Invoke-Az @('acr','build','--registry',$Acr,'--image',"$($item.repository):$ImageTag",'--file',$item.dockerfile,'.','--no-logs')|Out-Null
  }else{
    & docker build -t "$server/$($item.repository):$ImageTag" -f $item.dockerfile .
    if($LASTEXITCODE -ne 0){throw "Local Docker build failed for $($item.repository)."}
    & docker push "$server/$($item.repository):$ImageTag"
    if($LASTEXITCODE -ne 0){throw "ACR push failed for $($item.repository)."}
  }
}
function Resolve-Digest([string]$Repository){
  $digest=(Invoke-Az @('acr','repository','show','--name',$Acr,'--image',"${Repository}:$ImageTag",'--query','digest','-o','tsv')).Trim()
  if($digest -notmatch '^sha256:[0-9a-f]{64}$'){throw "Invalid digest for ${Repository}:$ImageTag"}
  return "$server/$Repository@$digest"
}
$backend=Resolve-Digest 'ucell-backend';$worker=Resolve-Digest 'ucell-worker'

# The migration Job keeps its existing database secret reference. No password is read or replaced.
$execution='';$status='';$migrationSucceeded=$false
try{
 Invoke-Az @('containerapp','job','update','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--image',$backend,'--set-env-vars','UCELL_ENVIRONMENT=STAGE','NODE_ENV=staging','--command','node','--args','scripts/stage-profile-migration-recovery.mjs','--only-show-errors')|Out-Null
 $execution=(Invoke-Az @('containerapp','job','start','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--query','name','-o','tsv')).Trim()
 if(-not $execution){throw 'Migration execution name is empty.'}
 for($i=1;$i -le 120;$i++){
  Start-Sleep 10
  $status=(Invoke-Az @('containerapp','job','execution','show','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--job-execution-name',$execution,'--query','properties.status','-o','tsv')).Trim()
  if($status -notin @('Running','Processing','Pending')){break}
 }
 if($status -ne 'Succeeded'){throw "Stage migration did not succeed: $status"}
 $migrationSucceeded=$true
}catch{
 if(-not $migrationSucceeded){
  $restore=@('containerapp','job','update','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--image',$previousMigrationImage,'--command')+$previousMigrationCommand+@('--args')+$previousMigrationArgs
  Invoke-Az $restore|Out-Null
 }
 throw
}

$suffix=('g8'+($ImageTag -replace '[^a-z0-9]','')).Substring(0,[Math]::Min(45,2+($ImageTag -replace '[^a-z0-9]','').Length))
Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-api','--image',$backend,'--revision-suffix',$suffix)|Out-Null
Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-worker','--image',$worker,'--revision-suffix',$suffix)|Out-Null

# Additive configuration only: existing domains, TLS, identities and secret refs survive.
Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-worker','--set-env-vars','LINE_MESSAGING_WORKER_ENABLED=true')|Out-Null
if($LineLoginChannelId){Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-api','--set-env-vars',"LINE_LOGIN_CHANNEL_ID=$LineLoginChannelId")|Out-Null}
if($IncludeFrontends){
 # Preserve the existing synthetic Stage entry. Never print or persist the token.
 $uatToken=(Invoke-Az @('containerapp','secret','list','--resource-group',$ResourceGroup,'--name','ucell-stage-api','--show-values','--query',"[?name=='stage-uat-member-token'].value | [0]",'-o','tsv')).Trim()
 if(-not $uatToken){throw 'Existing Stage UAT token is unavailable; frontend update refused.'}
 $apiOrigin='https://api-stage.ucell.life'
 $frontends=@(
  @{repository='ucell-admin';app='ucell-stage-admin';dockerfile='deployment/Dockerfile.admin';args=@('VITE_ENABLE_DEMO_LOGIN=true','VITE_STAGE_UAT_DEMO_LOGIN=true')},
  @{repository='ucell-member';app='ucell-stage-member';dockerfile='deployment/Dockerfile.member';args=@("VITE_LIFF_ID=$LiffId",'VITE_STAGE_UAT_MEMBER_ENABLED=true')}
 )
 try{
  foreach($item in $frontends){
   $build=if($ContainerBuildMode -eq 'Acr'){@('acr','build','--registry',$Acr,'--image',"$($item.repository):$ImageTag",'--file',$item.dockerfile)}else{@('build','-t',"$server/$($item.repository):$ImageTag",'-f',$item.dockerfile)}
   $build+=@('--build-arg',"VITE_API_BASE_URL=$apiOrigin/api/v1",'--build-arg',"CSP_API_ORIGIN=$apiOrigin")
   foreach($arg in $item.args){$build+=@('--build-arg',$arg)}
   if($item.repository -eq 'ucell-member'){
    if($ContainerBuildMode -eq 'Acr'){$build+=@('--secret-build-arg',"VITE_STAGE_UAT_MEMBER_TOKEN=$uatToken")}
    else{$env:UCELL_STAGE_BUILD_TOKEN=$uatToken;$build+=@('--secret','id=stage-uat-member-token,env=UCELL_STAGE_BUILD_TOKEN')}
   }
   # Suppress build output and avoid the general error helper, which prints arguments.
   if($ContainerBuildMode -eq 'Acr'){& az @build . --no-logs --only-show-errors *> $null}
   else{& docker @build .}
   if($LASTEXITCODE -ne 0){throw "Frontend build failed for $($item.repository)."}
   if($ContainerBuildMode -eq 'Local'){& docker push "$server/$($item.repository):$ImageTag";if($LASTEXITCODE -ne 0){throw 'Frontend image push failed.'}}
   $image=Resolve-Digest $item.repository
   Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name',$item.app,'--image',$image,'--revision-suffix',$suffix)|Out-Null
  }
 }finally{$uatToken=$null;$build=$null;$env:UCELL_STAGE_BUILD_TOKEN=$null}
}

$fqdn=(Json @('containerapp','show','--resource-group',$ResourceGroup,'--name','ucell-stage-api','-o','json')).properties.configuration.ingress.fqdn
$healthy=$false;for($i=1;$i -le 30;$i++){
 try{$response=Invoke-WebRequest "https://$fqdn/api/v1/health" -UseBasicParsing -TimeoutSec 10;if($response.StatusCode -eq 200){$healthy=$true;break}}catch{if($i -eq 30){throw}}
 Start-Sleep 5
}
if(-not $healthy){throw 'Stage API health probe failed.'}
$result=[ordered]@{schemaVersion='G8_STAGE_BACKEND_UPDATE_V1';imageTag=$ImageTag;migrationExecution=$execution;migrationStatus=$status;apiImage=$backend;workerImage=$worker;apiHealth='PASS';adminMemberFrontend=if($IncludeFrontends){'UPDATED'}else{'UNCHANGED'};completedAt=(Get-Date).ToUniversalTime().ToString('o')}
if($OutputPath){$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputPath -Encoding utf8}else{$result|ConvertTo-Json -Depth 5}

