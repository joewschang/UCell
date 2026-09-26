# Controlled G8 Stage backend/worker update. It deliberately leaves Admin and Member
# frontends and all existing Container App secrets untouched.
[CmdletBinding()]
param(
  [string]$ResourceGroup='rg-ucell-stage',
  [string]$Acr='ucellstageacr5mafbbsq33mgu',
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9._-]{0,127}$')][string]$ImageTag,
  [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
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
[void](Require-ExistingSecretReference 'ucell-stage-api' 'PII_ENCRYPTION_KEY')
[void](Require-ExistingSecretReference 'ucell-stage-api' 'STAGE_UAT_MEMBER_TOKEN')
[void](Require-ExistingSecretReference 'ucell-stage-worker' 'DATABASE_URL')
[void](Require-ExistingSecretReference 'ucell-stage-worker' 'PII_ENCRYPTION_KEY')
[void](Require-ExistingSecretReference 'ucell-stage-migrate' 'DATABASE_URL' -Job)

foreach($item in @(@{repository='ucell-backend';dockerfile='deployment/Dockerfile.backend'},@{repository='ucell-worker';dockerfile='deployment/Dockerfile.worker'})){
  Invoke-Az @('acr','build','--registry',$Acr,'--image',"$($item.repository):$ImageTag",'--file',$item.dockerfile,'.','--no-logs')|Out-Null
}
$server=(Invoke-Az @('acr','show','--name',$Acr,'--query','loginServer','-o','tsv')).Trim()
function Resolve-Digest([string]$Repository){
  $digest=(Invoke-Az @('acr','repository','show','--name',$Acr,'--image',"${Repository}:$ImageTag",'--query','digest','-o','tsv')).Trim()
  if($digest -notmatch '^sha256:[0-9a-f]{64}$'){throw "Invalid digest for ${Repository}:$ImageTag"}
  return "$server/$Repository@$digest"
}
$backend=Resolve-Digest 'ucell-backend';$worker=Resolve-Digest 'ucell-worker'

# The migration Job keeps its existing database secret reference. No password is read or replaced.
Invoke-Az @('containerapp','job','update','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--image',$backend,'--only-show-errors')|Out-Null
$execution=(Invoke-Az @('containerapp','job','start','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--query','name','-o','tsv')).Trim()
if(-not $execution){throw 'Migration execution name is empty.'}
$status='';for($i=1;$i -le 120;$i++){
 Start-Sleep 10
 $status=(Invoke-Az @('containerapp','job','execution','show','--resource-group',$ResourceGroup,'--name','ucell-stage-migrate','--job-execution-name',$execution,'--query','properties.status','-o','tsv')).Trim()
 if($status -notin @('Running','Processing','Pending')){break}
}
if($status -ne 'Succeeded'){throw "Stage migration did not succeed: $status"}

$suffix=('g8'+($ImageTag -replace '[^a-z0-9]','')).Substring(0,[Math]::Min(45,2+($ImageTag -replace '[^a-z0-9]','').Length))
Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-api','--image',$backend,'--revision-suffix',$suffix)|Out-Null
Invoke-Az @('containerapp','update','--resource-group',$ResourceGroup,'--name','ucell-stage-worker','--image',$worker,'--revision-suffix',$suffix)|Out-Null

$fqdn=(Json @('containerapp','show','--resource-group',$ResourceGroup,'--name','ucell-stage-api','-o','json')).properties.configuration.ingress.fqdn
$healthy=$false;for($i=1;$i -le 30;$i++){
 try{$response=Invoke-WebRequest "https://$fqdn/api/v1/health" -UseBasicParsing -TimeoutSec 10;if($response.StatusCode -eq 200){$healthy=$true;break}}catch{if($i -eq 30){throw}}
 Start-Sleep 5
}
if(-not $healthy){throw 'Stage API health probe failed.'}
$result=[ordered]@{schemaVersion='G8_STAGE_BACKEND_UPDATE_V1';imageTag=$ImageTag;migrationExecution=$execution;migrationStatus=$status;apiImage=$backend;workerImage=$worker;apiHealth='PASS';adminMemberFrontend='UNCHANGED';completedAt=(Get-Date).ToUniversalTime().ToString('o')}
if($OutputPath){$result|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $OutputPath -Encoding utf8}else{$result|ConvertTo-Json -Depth 5}
