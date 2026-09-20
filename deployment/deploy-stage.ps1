[CmdletBinding()]
param(
  [string]$Location = 'eastasia', [string]$ResourceGroup = 'rg-ucell-stage',
  [string]$PostgresAdminUser = 'ucellstageadmin', [SecureString]$PostgresAdminPassword, [SecureString]$PiiEncryptionKey,
  [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')][string]$PiiEncryptionKeyVersion = 'STAGE_V1',
  [string]$LineLoginChannelId = '', [string]$LiffId = '',
  [string]$EntraTenantId = '', [string]$EntraClientId = '', [string]$EntraRedirectUri = '', [string]$ImageTag = '',
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$InventoryWarehouseId,
  [Parameter(Mandatory)][ValidateNotNullOrEmpty()][string]$InventoryPolicyVersion,
  [ValidateRange(1,180)][int]$MigrationPollAttempts = 120,
  [ValidateRange(1,60)][int]$HealthPollAttempts = 30,
  [ValidateSet('Local','Acr')][string]$ContainerBuildMode = 'Local'
)
$ErrorActionPreference = 'Stop'
if($InventoryWarehouseId -notmatch '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'){throw 'UCELL_INVENTORY_WAREHOUSE_ID must be a UUID.'}
if($InventoryPolicyVersion -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'){throw 'UCELL_INVENTORY_POLICY_VERSION is missing or invalid.'}
$windowsAzPython = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\python.exe'
if (Test-Path $windowsAzPython) { $script:AzExecutable=$windowsAzPython; $script:AzPrefix=@('-IBm','azure.cli') }
else { $az=Get-Command az -ErrorAction SilentlyContinue; if(-not $az){throw 'Azure CLI is required.'}; $script:AzExecutable=$az.Source; $script:AzPrefix=@() }

function Invoke-AzChecked([string]$Operation,[string[]]$Arguments) {
  $allArguments=@($script:AzPrefix)+$Arguments
  $output=& $script:AzExecutable @allArguments
  if($LASTEXITCODE -ne 0){throw "Azure CLI operation failed: $Operation (exit $LASTEXITCODE)."}
  return $output
}
function Invoke-NativeChecked([string]$Operation,[string]$Executable,[string[]]$Arguments) {
  & $Executable @Arguments
  if($LASTEXITCODE -ne 0){throw "Native operation failed: $Operation (exit $LASTEXITCODE)."}
}
function Test-App([string]$Name) {
  $allArguments=@($script:AzPrefix)+@('containerapp','show','--name',$Name,'--resource-group',$ResourceGroup,'--only-show-errors')
  & $script:AzExecutable @allArguments *> $null
  return $LASTEXITCODE -eq 0
}
function Resolve-Image([string]$Repository) {
  $digest=(Invoke-AzChecked "resolve $Repository digest" @('acr','repository','show','--name',$acr,'--image',"${Repository}:$ImageTag",'--query','digest','-o','tsv','--only-show-errors')).Trim()
  if($digest -notmatch '^sha256:[0-9a-f]{64}$'){throw "Invalid ACR digest for ${Repository}:$ImageTag."}
  return "$registryServer/$Repository@$digest"
}
function Set-App([string]$Name,[string]$Image,[int]$Min,[int]$Max,[string[]]$Env=@(),[string[]]$RemoveEnv=@(),[string[]]$Secrets=@(),[switch]$Ingress,[int]$Port=0,[switch]$Database) {
  if(Test-App $Name){
    if($Database){Invoke-AzChecked "set $Name secret" @('containerapp','secret','set','--name',$Name,'--resource-group',$ResourceGroup,'--secrets',"database-url=$databaseUrl",'--only-show-errors')|Out-Null}
    if($Secrets.Count){Invoke-AzChecked "set $Name application secrets" (@('containerapp','secret','set','--name',$Name,'--resource-group',$ResourceGroup,'--secrets')+$Secrets+@('--only-show-errors'))|Out-Null}
    $a=@('containerapp','update','--name',$Name,'--resource-group',$ResourceGroup,'--image',$Image,'--revision-suffix',$revisionSuffix,'--min-replicas',"$Min",'--max-replicas',"$Max",'--only-show-errors')
    if($Env.Count){$a+=@('--set-env-vars')+$Env}; if($RemoveEnv.Count){$a+=@('--remove-env-vars')+$RemoveEnv}; Invoke-AzChecked "update $Name" $a|Out-Null
  } else {
    $a=@('containerapp','create','--name',$Name,'--resource-group',$ResourceGroup,'--environment',$environment,'--image',$Image,'--registry-server',$registryServer,'--registry-identity',$identity,'--user-assigned',$identity,'--revision-suffix',$revisionSuffix,'--min-replicas',"$Min",'--max-replicas',"$Max",'--only-show-errors')
    $createSecrets=@(); if($Database){$createSecrets+="database-url=$databaseUrl"}; if($Secrets.Count){$createSecrets+=$Secrets}
    if($Ingress){$a+=@('--ingress','external','--target-port',"$Port")}; if($createSecrets.Count){$a+=@('--secrets')+$createSecrets}; if($Env.Count){$a+=@('--env-vars')+$Env}
    Invoke-AzChecked "create $Name" $a|Out-Null
  }
}

if(-not $ImageTag){
  if($env:GITHUB_SHA){$commit=$env:GITHUB_SHA}else{$commit=(& git rev-parse HEAD).Trim(); if($LASTEXITCODE -ne 0){throw 'Cannot resolve Git commit for image tag.'}}; if(-not $commit){throw 'Cannot resolve image tag.'}
  $run=if($env:GITHUB_RUN_ID){"$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)"}else{(Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')}; $ImageTag="$commit-$run"
}
$ImageTag=($ImageTag.ToLowerInvariant()-replace '[^a-z0-9_.-]','-').Trim('-','.'); if(-not $ImageTag -or $ImageTag.Length -gt 128){throw 'Invalid image tag.'}
$token=($ImageTag-replace '[^a-z0-9]',''); if($token.Length -gt 45){$token=$token.Substring(0,45)}; $revisionSuffix="r-$token"
if(-not $PostgresAdminPassword){$PostgresAdminPassword=Read-Host 'Stage PostgreSQL administrator password' -AsSecureString}
$password=[System.Net.NetworkCredential]::new('',$PostgresAdminPassword).Password; if($password.Length -lt 16){throw 'Stage PostgreSQL password must contain at least 16 characters.'}
if(-not $PiiEncryptionKey){$PiiEncryptionKey=Read-Host 'Stage PII encryption key (base64 32-byte key)' -AsSecureString}
$piiKey=[System.Net.NetworkCredential]::new('',$PiiEncryptionKey).Password
try{$piiBytes=[Convert]::FromBase64String($piiKey)}catch{throw 'Stage PII encryption key must be base64.'}
if($piiBytes.Length -ne 32){throw 'Stage PII encryption key must decode to exactly 32 bytes.'}

Invoke-AzChecked 'verify Azure session' @('account','show','--only-show-errors')|Out-Null
Invoke-AzChecked 'install Container Apps extension' @('extension','add','--name','containerapp','--upgrade','--only-show-errors')|Out-Null
foreach($p in @('Microsoft.App','Microsoft.ContainerRegistry','Microsoft.DBforPostgreSQL','Microsoft.Insights','Microsoft.KeyVault','Microsoft.ManagedIdentity','Microsoft.OperationalInsights','Microsoft.Storage')){Invoke-AzChecked "register $p" @('provider','register','--namespace',$p,'--wait','--only-show-errors')|Out-Null}
Invoke-AzChecked 'create Stage resource group' @('group','create','--name',$ResourceGroup,'--location',$Location,'--only-show-errors')|Out-Null
$deployment=(Invoke-AzChecked 'deploy Stage foundation' @('deployment','group','create','--resource-group',$ResourceGroup,'--template-file','infra/stage/foundation.bicep','--parameters',"postgresAdminUser=$PostgresAdminUser", "postgresAdminPassword=$password",'--query','properties.outputs','-o','json','--only-show-errors')|ConvertFrom-Json)
$acr=$deployment.acrName.value; $identity=$deployment.workloadIdentityId.value; $environment=$deployment.containerEnvironmentName.value; $hostName=$deployment.postgresHost.value; $insights=$deployment.applicationInsightsConnectionString.value
$databaseUrl="postgresql://$([Uri]::EscapeDataString($PostgresAdminUser)):$([Uri]::EscapeDataString($password))@${hostName}:5432/ucell_stage?sslmode=require"; $registryServer="$acr.azurecr.io"

foreach($r in @('ucell-backend','ucell-worker')){
  $df=if($r -eq 'ucell-backend'){'deployment/Dockerfile.backend'}else{'deployment/Dockerfile.worker'}
  if($ContainerBuildMode -eq 'Local'){if($r -eq 'ucell-backend'){Invoke-AzChecked 'login ACR' @('acr','login','--name',$acr,'--only-show-errors')|Out-Null}; Invoke-NativeChecked "build $r" docker @('build','-t',"$registryServer/${r}:$ImageTag",'-f',$df,'.'); Invoke-NativeChecked "push $r" docker @('push',"$registryServer/${r}:$ImageTag")}
  else{Invoke-AzChecked "build $r" @('acr','build','--registry',$acr,'--image',"${r}:$ImageTag",'--file',$df,'.','--only-show-errors')|Out-Null}
}
$backendImage=Resolve-Image 'ucell-backend'; $workerImage=Resolve-Image 'ucell-worker'
$serverEnv=@('NODE_ENV=staging','ADMIN_AUTH_BYPASS=false','SWAGGER_ENABLED=true',"APPLICATIONINSIGHTS_CONNECTION_STRING=$insights",'UCELL_ENVIRONMENT=STAGE','DATABASE_URL=secretref:database-url','PII_ENCRYPTION_KEY=secretref:pii-encryption-key',"PII_ENCRYPTION_KEY_VERSION=$PiiEncryptionKeyVersion","UCELL_INVENTORY_WAREHOUSE_ID=$InventoryWarehouseId","UCELL_INVENTORY_POLICY_VERSION=$InventoryPolicyVersion")
$serverRemove=@()
if($LineLoginChannelId){$serverEnv+="LINE_LOGIN_CHANNEL_ID=$LineLoginChannelId"}else{$serverRemove+='LINE_LOGIN_CHANNEL_ID'}
if($EntraTenantId){$serverEnv+="ENTRA_TENANT_ID=$EntraTenantId"}else{$serverRemove+='ENTRA_TENANT_ID'}
if($EntraClientId){$serverEnv+="ENTRA_CLIENT_ID=$EntraClientId"}else{$serverRemove+='ENTRA_CLIENT_ID'}

$jobShowArguments=@($script:AzPrefix)+@('containerapp','job','show','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--only-show-errors')
& $script:AzExecutable @jobShowArguments *> $null
if($LASTEXITCODE -eq 0){
  Invoke-AzChecked 'set migration secret' @('containerapp','job','secret','set','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--secrets',"database-url=$databaseUrl",'--only-show-errors')|Out-Null
  Invoke-AzChecked 'update migration job' @('containerapp','job','update','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--image',$backendImage,'--container-name','ucell-stage-migrate','--replica-timeout','1800','--replica-retry-limit','0','--parallelism','1','--replica-completion-count','1','--set-env-vars','DATABASE_URL=secretref:database-url','NODE_ENV=staging','--command','pnpm','--args','db:deploy','--only-show-errors')|Out-Null
}else{
  Invoke-AzChecked 'create migration job' @('containerapp','job','create','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--environment',$environment,'--trigger-type','Manual','--replica-timeout','1800','--replica-retry-limit','0','--parallelism','1','--replica-completion-count','1','--image',$backendImage,'--registry-server',$registryServer,'--registry-identity',$identity,'--mi-user-assigned',$identity,'--secrets',"database-url=$databaseUrl",'--env-vars','DATABASE_URL=secretref:database-url','NODE_ENV=staging','--command','pnpm','--args','db:deploy','--only-show-errors')|Out-Null
}
$execution=(Invoke-AzChecked 'start migration' @('containerapp','job','start','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--query','name','-o','tsv','--only-show-errors')).Trim(); if(-not $execution){throw 'Migration execution name is empty.'}
$migrationStatus=''; for($i=1;$i -le $MigrationPollAttempts;$i++){Start-Sleep 10; $migrationStatus=(Invoke-AzChecked 'poll migration' @('containerapp','job','execution','show','--name','ucell-stage-migrate','--resource-group',$ResourceGroup,'--job-execution-name',$execution,'--query','properties.status','-o','tsv','--only-show-errors')).Trim(); if($migrationStatus -notin @('Running','Processing','Pending')){break}}
if($migrationStatus -ne 'Succeeded'){throw "Stage migration failed or timed out: $migrationStatus."}

Set-App 'ucell-stage-api' $backendImage 1 3 $serverEnv -RemoveEnv $serverRemove -Secrets @("pii-encryption-key=$piiKey") -Ingress -Port 3000 -Database
Set-App 'ucell-stage-worker' $workerImage 1 2 $serverEnv -RemoveEnv $serverRemove -Secrets @("pii-encryption-key=$piiKey") -Database
$apiFqdn=(Invoke-AzChecked 'read API FQDN' @('containerapp','show','--name','ucell-stage-api','--resource-group',$ResourceGroup,'--query','properties.configuration.ingress.fqdn','-o','tsv','--only-show-errors')).Trim(); if(-not $apiFqdn){throw 'API FQDN is empty.'}
$apiOrigin="https://$apiFqdn"; $apiBaseUrl="$apiOrigin/api/v1"

$frontends=@(
  @{r='ucell-admin';df='deployment/Dockerfile.admin';args=@("VITE_API_BASE_URL=$apiBaseUrl","VITE_ENTRA_TENANT_ID=$EntraTenantId","VITE_ENTRA_CLIENT_ID=$EntraClientId","VITE_ENTRA_REDIRECT_URI=$EntraRedirectUri","CSP_API_ORIGIN=$apiOrigin")},
  @{r='ucell-member';df='deployment/Dockerfile.member';args=@("VITE_API_BASE_URL=$apiBaseUrl","VITE_LIFF_ID=$LiffId","CSP_API_ORIGIN=$apiOrigin")}
)
foreach($f in $frontends){
  if($ContainerBuildMode -eq 'Local'){$a=@('build','-t',"$registryServer/$($f.r):$ImageTag",'-f',$f.df); foreach($b in $f.args){$a+=@('--build-arg',$b)}; $a+='.'; Invoke-NativeChecked "build $($f.r)" docker $a; Invoke-NativeChecked "push $($f.r)" docker @('push',"$registryServer/$($f.r):$ImageTag")}
  else{$a=@('acr','build','--registry',$acr,'--image',"$($f.r):$ImageTag",'--file',$f.df); foreach($b in $f.args){$a+=@('--build-arg',$b)}; $a+=@('.','--only-show-errors'); Invoke-AzChecked "build $($f.r)" $a|Out-Null}
}
$adminImage=Resolve-Image 'ucell-admin'; $memberImage=Resolve-Image 'ucell-member'
Set-App 'ucell-stage-admin' $adminImage 1 2 -Ingress -Port 80
Set-App 'ucell-stage-member' $memberImage 1 2 -Ingress -Port 80

$evidence=@(); foreach($name in @('ucell-stage-api','ucell-stage-worker','ucell-stage-admin','ucell-stage-member')){
  $state=(Invoke-AzChecked "read $name state" @('containerapp','show','--name',$name,'--resource-group',$ResourceGroup,'--query','{revision:properties.latestRevisionName,image:properties.template.containers[0].image,fqdn:properties.configuration.ingress.fqdn}','-o','json','--only-show-errors')|ConvertFrom-Json); if($state.image -notmatch '@sha256:[0-9a-f]{64}$'){throw "$name is not digest pinned."}
  $rev=(Invoke-AzChecked "read $name revision" @('containerapp','revision','show','--name',$name,'--resource-group',$ResourceGroup,'--revision',$state.revision,'--query','{active:properties.active,healthState:properties.healthState,runningState:properties.runningState,createdTime:properties.createdTime}','-o','json','--only-show-errors')|ConvertFrom-Json)
  $evidence += [pscustomobject]@{Name=$name;Revision=$state.revision;Image=$state.image;Fqdn=$state.fqdn;Active=$rev.active;HealthState=$rev.healthState;RunningState=$rev.runningState;CreatedTime=$rev.createdTime}
}
$healthy=$false; for($i=1;$i -le $HealthPollAttempts;$i++){try{$response=Invoke-WebRequest "$apiBaseUrl/health" -TimeoutSec 10 -UseBasicParsing; if($response.StatusCode -eq 200){$healthy=$true;break}}catch{if($i -eq $HealthPollAttempts){throw "Stage API health probe failed: $($_.Exception.Message)"}}; Start-Sleep 5}; if(-not $healthy){throw 'Stage API did not become healthy.'}
$adminFqdn=($evidence|Where-Object Name -eq 'ucell-stage-admin').Fqdn; $memberFqdn=($evidence|Where-Object Name -eq 'ucell-stage-member').Fqdn
[pscustomobject]@{ResourceGroup=$ResourceGroup;ImageTag=$ImageTag;MigrationExecution=$execution;MigrationStatus=$migrationStatus;Api=$apiOrigin;Admin="https://$adminFqdn";Member="https://$memberFqdn";ApiHealth='PASS';IdentityConfiguration=[pscustomobject]@{LineConfigured=([bool]$LineLoginChannelId -and [bool]$LiffId);EntraConfigured=([bool]$EntraTenantId -and [bool]$EntraClientId -and [bool]$EntraRedirectUri);VerificationStatus='OPERATIONAL_CREDENTIAL_PENDING'};Revisions=$evidence}|ConvertTo-Json -Depth 6
