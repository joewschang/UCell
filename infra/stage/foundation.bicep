targetScope = 'resourceGroup'

@description('Azure region for the isolated Stage environment.')
param location string = resourceGroup().location

@secure()
@minLength(16)
param postgresAdminPassword string

param postgresAdminUser string = 'ucellstageadmin'
param environmentName string = 'stage'

var suffix = uniqueString(subscription().subscriptionId, resourceGroup().id, environmentName)
var compactPrefix = 'ucell${environmentName}'

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${compactPrefix}-logs-${suffix}'
  location: location
  properties: {
    retentionInDays: 30
    features: { enableLogAccessUsingOnlyResourcePermissions: true }
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${compactPrefix}-appi-${suffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
  }
}

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${compactPrefix}acr${suffix}'
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource workloadIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${compactPrefix}-workload-${suffix}'
  location: location
}

resource registryPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, workloadIdentity.id, 'AcrPull')
  scope: registry
  properties: {
    principalId: workloadIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'ucellkv${suffix}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    sku: { family: 'A', name: 'standard' }
    accessPolicies: []
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: 'ucellst${suffix}'
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource databaseServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: '${compactPrefix}-pg-${suffix}'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    availabilityZone: '1'
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' }
    storage: { storageSizeGB: 32 }
  }
}

resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: databaseServer
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource postgresExtensions 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: databaseServer
  name: 'azure.extensions'
  properties: {
    value: 'PGCRYPTO'
    source: 'user-override'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: databaseServer
  name: 'ucell_stage'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

resource containerEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${compactPrefix}-cae-${suffix}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

output acrName string = registry.name
output workloadIdentityId string = workloadIdentity.id
output containerEnvironmentName string = containerEnvironment.name
output postgresHost string = databaseServer.properties.fullyQualifiedDomainName
output postgresServerName string = databaseServer.name
output postgresDatabase string = database.name
output postgresAdminUser string = postgresAdminUser
output keyVaultName string = vault.name
output storageAccountName string = storage.name
output applicationInsightsConnectionString string = insights.properties.ConnectionString
