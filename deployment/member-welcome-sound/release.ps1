$part='member'
$ErrorActionPreference='Stop'
$reg='ucellprodacrm3z2zx4ohqyui'
$base="$reg.azurecr.io/ucell-member@sha256:ecacb7629d70f0466be414fbec03418cf826d5a18c6244d52437e0acefc9e878"
$tag='welcome-space-v2-261116'
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
