# G8 Environment Inventory Collector
# Read-only: captures no secret values and makes no Azure mutations.
[CmdletBinding()]
param(
  [string]$ResourceGroup = 'rg-ucell-stage',
  [ValidateSet('STAGE','PRODUCTION')][string]$Environment = 'STAGE',
  [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
function Invoke-AzJson([string[]]$AzArguments) {
  $out = az @AzArguments --only-show-errors -o json
  if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed: az $($AzArguments -join ' ')" }
  return $out | ConvertFrom-Json
}
$account = Invoke-AzJson -AzArguments @('account','show')
$resources = Invoke-AzJson -AzArguments @('resource','list','--resource-group',$ResourceGroup)
$byType = @{}
foreach($resource in $resources) { if(-not $byType.ContainsKey($resource.type)){$byType[$resource.type]=@()}; $byType[$resource.type] += $resource }
$apps = @()
foreach($resource in @($byType['Microsoft.App/containerApps'])) {
  $app = Invoke-AzJson -AzArguments @('containerapp','show','--name',$resource.name,'--resource-group',$ResourceGroup)
  $container = @($app.properties.template.containers)[0]
  $apps += [pscustomobject]@{
    name = $resource.name
    latestRevision = $app.properties.latestRevisionName
    ingressFqdn = $app.properties.configuration.ingress.fqdn
    image = $container.image
    environmentVariableNames = @($container.env | ForEach-Object { $_.name } | Sort-Object)
  }
}
$jobs = @()
foreach($resource in @($byType['Microsoft.App/jobs'])) {
  $job = Invoke-AzJson -AzArguments @('containerapp','job','show','--name',$resource.name,'--resource-group',$ResourceGroup)
  $container = @($job.properties.template.containers)[0]
  $jobs += [pscustomobject]@{
    name = $resource.name
    image = $container.image
    command = @($container.command)
    environmentVariableNames = @($container.env | ForEach-Object { $_.name } | Sort-Object)
  }
}
$postgres = @($byType['Microsoft.DBforPostgreSQL/flexibleServers'] | ForEach-Object {
  $server = Invoke-AzJson -AzArguments @('postgres','flexible-server','show','--resource-group',$ResourceGroup,'--name',$_.name)
  [pscustomobject]@{
    name = $_.name
    version = $server.version
    fqdn = $server.fullyQualifiedDomainName
    backupRetentionDays = $server.backup.backupRetentionDays
    geoRedundantBackup = $server.backup.geoRedundantBackup
    highAvailability = $server.highAvailability.mode
    publicNetworkAccess = $server.network.publicNetworkAccess
  }
})
$vaults = @($byType['Microsoft.KeyVault/vaults'] | ForEach-Object {
  $vault = Invoke-AzJson -AzArguments @('keyvault','show','--name',$_.name,'--resource-group',$ResourceGroup)
  [pscustomobject]@{name=$_.name;enableRbacAuthorization=$vault.properties.enableRbacAuthorization;softDeleteRetentionInDays=$vault.properties.softDeleteRetentionInDays;enablePurgeProtection=$vault.properties.enablePurgeProtection}
})
$inventory = [ordered]@{
  schemaVersion = 'G8_ENVIRONMENT_INVENTORY_V1'
  collectedAt = (Get-Date).ToUniversalTime().ToString('o')
  environment = $Environment
  azure = [ordered]@{subscriptionId=$account.id; tenantId=$account.tenantId; resourceGroup=$ResourceGroup; location=($resources | Select-Object -First 1).location}
  containerApps = $apps
  jobs = $jobs
  postgres = $postgres
  keyVaults = $vaults
  logAnalyticsWorkspaces = @($byType['Microsoft.OperationalInsights/workspaces'] | ForEach-Object { $_.name })
  applicationInsights = @($byType['Microsoft.Insights/components'] | ForEach-Object { $_.name })
  storageAccounts = @($byType['Microsoft.Storage/storageAccounts'] | ForEach-Object { $_.name })
  notes = @('Secret values, database URLs, tokens, and connection strings are intentionally excluded.','Production inventory must be collected separately before G9.')
}
$json = $inventory | ConvertTo-Json -Depth 8
if($OutputPath) { $json | Set-Content -LiteralPath $OutputPath -Encoding utf8 }
else { $json }




