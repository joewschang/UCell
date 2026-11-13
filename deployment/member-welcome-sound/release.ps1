$part='member'
$ErrorActionPreference='Stop'
$reg='ucellprodacrm3z2zx4ohqyui'
$base="$reg.azurecr.io/ucell-member@sha256:8fc52e2960bc83c50065806fc0baa506ea116287ef4778eea9d6fbd93e03c16e"
$tag='welcome-coins-261113'
$digest=az acr repository show -n $reg --image "ucell-${part}:$tag" --query digest -o tsv
if($LASTEXITCODE -or !$digest -or $digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'No build'}
$current=az containerapp show -g rg-ucell-production -n "ucell-prod-$part" --query properties.template.containers[0].image -o tsv
if($current -eq "$reg.azurecr.io/ucell-$part@$digest"){Write-Output 'Image already active';return}
if($base -ne $current){throw 'Base changed'}
az containerapp update -g rg-ucell-production -n "ucell-prod-$part" --image "$reg.azurecr.io/ucell-$part@$digest" --revision-suffix $tag --only-show-errors -o none
if($LASTEXITCODE){throw 'Update failed'}
for($i=0;$i -lt 30;$i++){
 $ready=az containerapp show -g rg-ucell-production -n "ucell-prod-$part" --query properties.latestReadyRevisionName -o tsv
 if($ready -eq "ucell-prod-$part--$tag"){Write-Output "$part ready";return};Start-Sleep 3
};throw 'Readiness pending'
