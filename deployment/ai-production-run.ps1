param([Parameter(Mandatory)][string]$Script)
$ErrorActionPreference='Stop'
$az='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
$secret=Import-Clixml C:/UCell/production-deploy-secrets.clixml
$password=[System.Net.NetworkCredential]::new('',$secret.postgresPassword).Password
$env:DATABASE_URL="postgresql://ucellprodadmin:$([Uri]::EscapeDataString($password))@ucellprod-pg-m3z2zx4ohqyui.postgres.database.azure.com:5432/ucell_production?sslmode=require"
$env:UCELL_ENVIRONMENT='PRODUCTION';$env:NODE_ENV='production';$env:AI_ENABLED='true';$env:AI_ACCESS_MODE='PRODUCTION_ROLES'
$env:AI_AZURE_ENDPOINT='https://ucell-prod-ai-20261022.openai.azure.com';$env:AI_AZURE_DEPLOYMENT='ucell-prod-planner'
try{
 $env:AI_AZURE_KEY=(& $az -X utf8 -IBm azure.cli cognitiveservices account keys list -g rg-ucell-production -n ucell-prod-ai-20261022 --query key1 -o tsv --only-show-errors).Trim()
 if($LASTEXITCODE -ne 0){throw 'Model key lookup failed'}
 node $Script
 if($LASTEXITCODE -ne 0){throw 'Production AI operation failed'}
}finally{$env:DATABASE_URL=$null;$env:AI_AZURE_KEY=$null;$password=$null;$secret=$null}
