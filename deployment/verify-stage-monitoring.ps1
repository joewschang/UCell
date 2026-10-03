# Read-only Stage monitoring readiness verifier. It records no secret values and makes no Azure mutations.
[CmdletBinding()]
param(
  [string]$ResourceGroup='rg-ucell-stage',
  [switch]$RequireDeliveryReceiver,
  [string]$OutputPath=''
)
$ErrorActionPreference='Stop'
function AzJson([string[]]$AzArguments){
  $out=az @AzArguments --only-show-errors -o json
  if($LASTEXITCODE -ne 0){throw "Azure CLI failed: az $($AzArguments -join ' ')"}
  $out|ConvertFrom-Json
}
$resources=AzJson -AzArguments @('resource','list','--resource-group',$ResourceGroup)
$apps=@($resources|Where-Object type -eq 'Microsoft.App/containerApps')
$revisions=@()
foreach($app in $apps){
  $state=AzJson -AzArguments @('containerapp','show','--name',$app.name,'--resource-group',$ResourceGroup)
  $revisions += [pscustomobject]@{name=$app.name;latestRevision=$state.properties.latestRevisionName;ingressFqdn=$state.properties.configuration.ingress.fqdn;image=@($state.properties.template.containers)[0].image}
}
$actionGroups=@($resources|Where-Object type -ieq 'microsoft.insights/actiongroups' | ForEach-Object {
  $group=AzJson -AzArguments @('resource','show','--ids',$_.id)
  $p=$group.properties
  $deliveryCount=@($p.emailReceivers).Count+@($p.smsReceivers).Count+@($p.webhookReceivers).Count+@($p.logicAppReceivers).Count+@($p.azureFunctionReceivers).Count+@($p.eventHubReceivers).Count
  [pscustomobject]@{name=$_.name;enabled=$p.enabled;deliveryReceiverCount=$deliveryCount;rbacReceiverCount=@($p.armRoleReceivers).Count}
})
$appsHealthy=($revisions.Count -ge 4 -and @($revisions|Where-Object { -not $_.latestRevision -or -not $_.image }).Count -eq 0)
$deliveryReady=@($actionGroups|Where-Object { $_.enabled -and $_.deliveryReceiverCount -gt 0 }).Count -gt 0
$result=[ordered]@{schemaVersion='G8_MONITORING_READINESS_V1';collectedAt=(Get-Date).ToUniversalTime().ToString('o');resourceGroup=$ResourceGroup;applicationRevisionInventory=$revisions;actionGroups=$actionGroups;checks=[ordered]@{applicationRevisionInventory=$appsHealthy;logAnalyticsPresent=@($resources|Where-Object type -eq 'Microsoft.OperationalInsights/workspaces').Count -gt 0;applicationInsightsPresent=@($resources|Where-Object type -eq 'Microsoft.Insights/components').Count -gt 0;deliveryCapableActionGroup=$deliveryReady};status=if($appsHealthy -and $deliveryReady){'PASS'}else{'PENDING_OPERATIONAL_OWNER'}}
$json=$result|ConvertTo-Json -Depth 8
if($OutputPath){$json|Set-Content -LiteralPath $OutputPath -Encoding utf8}else{$json}
if($RequireDeliveryReceiver -and -not $deliveryReady){exit 2}
