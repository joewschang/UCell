param([ValidateSet('api','member','admin')]$Part,[string]$Tag)
$ErrorActionPreference='Stop'
$env:AZURE_CONFIG_DIR='D:/UCell/tmp/az-qual-maint'
$env:TEMP='D:/UCell/tmp';$env:TMP=$env:TEMP
$registry='ucellprodacrm3z2zx4ohqyui'
$rg='rg-ucell-production'
$repo="ucell-$Part"
$app="ucell-prod-$Part"
$base=(Get-Content "D:/UCell/tmp/health-release/$Part/Dockerfile" -TotalCount 1).Substring(5)
$current=az containerapp show -g $rg -n $app --query properties.template.containers[0].image -o tsv
if($base -ne $current){throw "Live image changed: $Part"}
$digest=az acr repository show -n $registry --image "${repo}:$Tag" --query digest -o tsv
if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Missing build'}
$image="$registry.azurecr.io/$repo@$digest"
az containerapp update -g $rg -n $app --image $image --revision-suffix $Tag --only-show-errors -o none
if($LASTEXITCODE -ne 0){throw 'Update failed'}
for($i=0;$i -lt 36;$i++){
 $ready=az containerapp show -g $rg -n $app --query properties.latestReadyRevisionName -o tsv
 if($ready -eq "$app--$Tag"){Write-Output "$ready ready";exit 0}
 Start-Sleep 4
}
throw 'Revision not ready'
