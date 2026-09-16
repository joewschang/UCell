[CmdletBinding()]
param(
  [string]$Location = 'eastasia',
  [string]$ResourceGroup = 'rg-ucell-stage',
  [string]$PostgresAdminUser = 'ucellstageadmin',
  [SecureString]$PostgresAdminPassword,
  [string]$LineChannelId = '',
  [string]$LiffId = '',
  [string]$EntraTenantId = '',
  [string]$EntraClientId = '',
  [ValidateSet('Local','Acr')]
  [string]$ContainerBuildMode = 'Local'
)

$ErrorActionPreference = 'Stop'
$azCommand = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCommand) {
  $windowsAz = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
  if (Test-Path $windowsAz) { $az = $windowsAz } else { throw 'Azure CLI is required.' }
} else { $az = $azCommand.Source }
if (-not $PostgresAdminPassword) { $PostgresAdminPassword = Read-Host 'Stage PostgreSQL administrator password' -AsSecureString }
$password = [System.Net.NetworkCredential]::new('', $PostgresAdminPassword).Password
if ($password.Length -lt 16) { throw 'Stage PostgreSQL password must contain at least 16 characters.' }

& $az account show --only-show-errors | Out-Null
& $az extension add --name containerapp --upgrade --only-show-errors | Out-Null
foreach($provider in @('Microsoft.App','Microsoft.ContainerRegistry','Microsoft.DBforPostgreSQL','Microsoft.Insights','Microsoft.KeyVault','Microsoft.ManagedIdentity','Microsoft.OperationalInsights','Microsoft.Storage')){
  & $az provider register --namespace $provider --wait --only-show-errors | Out-Null
}
& $az group create --name $ResourceGroup --location $Location --only-show-errors | Out-Null
$deployment = & $az deployment group create --resource-group $ResourceGroup --template-file infra/stage/foundation.bicep --parameters postgresAdminUser=$PostgresAdminUser postgresAdminPassword=$password --query properties.outputs --output json --only-show-errors | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Stage foundation deployment failed.' }

$acr = $deployment.acrName.value
$identity = $deployment.workloadIdentityId.value
$environment = $deployment.containerEnvironmentName.value
$hostName = $deployment.postgresHost.value
$insights = $deployment.applicationInsightsConnectionString.value
$encodedUser = [Uri]::EscapeDataString($PostgresAdminUser)
$encodedPassword = [Uri]::EscapeDataString($password)
$databaseUrl = "postgresql://${encodedUser}:$encodedPassword@${hostName}:5432/ucell_stage?schema=public&sslmode=require"

$registryServer = "$acr.azurecr.io"
if ($ContainerBuildMode -eq 'Local') {
  & $az acr login --name $acr --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'Stage ACR login failed.' }
  & docker build --tag "$registryServer/ucell-backend:stage" --file deployment/Dockerfile.backend .
  if ($LASTEXITCODE -ne 0) { throw 'Stage Backend container build failed.' }
  & docker push "$registryServer/ucell-backend:stage"
  if ($LASTEXITCODE -ne 0) { throw 'Stage Backend container push failed.' }
  & docker build --tag "$registryServer/ucell-worker:stage" --file deployment/Dockerfile.worker .
  if ($LASTEXITCODE -ne 0) { throw 'Stage Worker container build failed.' }
  & docker push "$registryServer/ucell-worker:stage"
  if ($LASTEXITCODE -ne 0) { throw 'Stage Worker container push failed.' }
} else {
  & $az acr build --registry $acr --image ucell-backend:stage --file deployment/Dockerfile.backend . --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'Stage Backend ACR build failed.' }
  & $az acr build --registry $acr --image ucell-worker:stage --file deployment/Dockerfile.worker . --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'Stage Worker ACR build failed.' }
}

$common = @('NODE_ENV=staging',"DATABASE_URL=$databaseUrl",'ADMIN_AUTH_BYPASS=false',"APPLICATIONINSIGHTS_CONNECTION_STRING=$insights",'UCELL_ENVIRONMENT=STAGE')
if ($LineChannelId) { $common += "LINE_CHANNEL_ID=$LineChannelId" }

& $az containerapp job create --name ucell-stage-migrate --resource-group $ResourceGroup --environment $environment --trigger-type Manual --replica-timeout 1800 --replica-retry-limit 0 --parallelism 1 --replica-completion-count 1 --image "$registryServer/ucell-backend:stage" --registry-server $registryServer --registry-identity $identity --mi-user-assigned $identity --secrets "database-url=$databaseUrl" --env-vars 'DATABASE_URL=secretref:database-url' 'NODE_ENV=staging' --command pnpm --args '--filter' '@ucell/database' 'prisma' 'migrate' 'deploy' --only-show-errors
$execution = & $az containerapp job start --name ucell-stage-migrate --resource-group $ResourceGroup --query name --output tsv --only-show-errors
do {
  Start-Sleep -Seconds 10
  $migrationStatus = & $az containerapp job execution show --name ucell-stage-migrate --resource-group $ResourceGroup --job-execution-name $execution --query properties.status --output tsv --only-show-errors
} while ($migrationStatus -in @('Running','Processing','Pending'))
if ($migrationStatus -ne 'Succeeded') { throw "Stage Prisma migration failed with status $migrationStatus." }

& $az containerapp create --name ucell-stage-api --resource-group $ResourceGroup --environment $environment --image "$registryServer/ucell-backend:stage" --registry-server $registryServer --registry-identity $identity --user-assigned $identity --ingress external --target-port 3000 --min-replicas 1 --max-replicas 3 --secrets "database-url=$databaseUrl" --env-vars @($common | Where-Object { $_ -notlike 'DATABASE_URL=*' }) 'DATABASE_URL=secretref:database-url' --only-show-errors
& $az containerapp create --name ucell-stage-worker --resource-group $ResourceGroup --environment $environment --image "$registryServer/ucell-worker:stage" --registry-server $registryServer --registry-identity $identity --user-assigned $identity --min-replicas 1 --max-replicas 2 --secrets "database-url=$databaseUrl" --env-vars @($common | Where-Object { $_ -notlike 'DATABASE_URL=*' }) 'DATABASE_URL=secretref:database-url' --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Stage API/Worker deployment failed.' }

$apiFqdn = & $az containerapp show --name ucell-stage-api --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv
$apiBaseUrl = "https://$apiFqdn/api/v1"
if ($ContainerBuildMode -eq 'Local') {
  & docker build --tag "$registryServer/ucell-admin:stage" --file deployment/Dockerfile.admin --build-arg "VITE_API_BASE_URL=$apiBaseUrl" --build-arg "VITE_ENTRA_TENANT_ID=$EntraTenantId" --build-arg "VITE_ENTRA_CLIENT_ID=$EntraClientId" .
  if ($LASTEXITCODE -ne 0) { throw 'Stage Admin container build failed.' }
  & docker push "$registryServer/ucell-admin:stage"
  if ($LASTEXITCODE -ne 0) { throw 'Stage Admin container push failed.' }
  & docker build --tag "$registryServer/ucell-member:stage" --file deployment/Dockerfile.member --build-arg "VITE_API_BASE_URL=$apiBaseUrl" --build-arg "VITE_LIFF_ID=$LiffId" .
  if ($LASTEXITCODE -ne 0) { throw 'Stage Member container build failed.' }
  & docker push "$registryServer/ucell-member:stage"
  if ($LASTEXITCODE -ne 0) { throw 'Stage Member container push failed.' }
} else {
  & $az acr build --registry $acr --image ucell-admin:stage --file deployment/Dockerfile.admin --build-arg VITE_API_BASE_URL=$apiBaseUrl --build-arg VITE_ENTRA_TENANT_ID=$EntraTenantId --build-arg VITE_ENTRA_CLIENT_ID=$EntraClientId . --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'Stage Admin ACR build failed.' }
  & $az acr build --registry $acr --image ucell-member:stage --file deployment/Dockerfile.member --build-arg VITE_API_BASE_URL=$apiBaseUrl --build-arg VITE_LIFF_ID=$LiffId . --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw 'Stage Member ACR build failed.' }
}

& $az containerapp create --name ucell-stage-admin --resource-group $ResourceGroup --environment $environment --image "$registryServer/ucell-admin:stage" --registry-server $registryServer --registry-identity $identity --user-assigned $identity --ingress external --target-port 80 --min-replicas 1 --max-replicas 2 --only-show-errors
& $az containerapp create --name ucell-stage-member --resource-group $ResourceGroup --environment $environment --image "$registryServer/ucell-member:stage" --registry-server $registryServer --registry-identity $identity --user-assigned $identity --ingress external --target-port 80 --min-replicas 1 --max-replicas 2 --only-show-errors
if ($LASTEXITCODE -ne 0) { throw 'Stage Container Apps deployment failed.' }

$adminFqdn = & $az containerapp show --name ucell-stage-admin --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv
$memberFqdn = & $az containerapp show --name ucell-stage-member --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn --output tsv
[pscustomobject]@{ ResourceGroup=$ResourceGroup; Api="https://$apiFqdn"; Admin="https://$adminFqdn"; Member="https://$memberFqdn"; CredentialsVerified=([bool]$LineChannelId -and [bool]$EntraTenantId -and [bool]$EntraClientId) } | ConvertTo-Json
