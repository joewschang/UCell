param([ValidateSet('api','member')][string]$part)
$ErrorActionPreference='Stop'
$reg='ucellprodacrm3z2zx4ohqyui'
$file="$PSScriptRoot/Dockerfile.$part"
$base=(Get-Content $file -First 1).Split(' ')[1]
$tag=if($part -eq 'api'){'seasonal2-261111'}else{'seasonal-261111'}
$digest=az acr repository show -n $reg --image "ucell-${part}:$tag" --query digest -o tsv
if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'No build'}
$current=az containerapp show -g rg-ucell-production -n "ucell-prod-$part" --query properties.template.containers[0].image -o tsv
if($current -eq "$reg.azurecr.io/ucell-$part@$digest"){Write-Output 'Image already active';return}
if($part -eq 'api' -and $current -match '@sha256:65b007bb141e99665520da1f40a12fe8b7e2c69669363af27c2c12d12bed6018$'){$base=$current}
if($base -ne $current){throw 'Base changed'}
az containerapp update -g rg-ucell-production -n "ucell-prod-$part" --image "$reg.azurecr.io/ucell-$part@$digest" --revision-suffix $tag --only-show-errors -o none
if($LASTEXITCODE){throw 'Update failed'}
for($i=0;$i -lt 30;$i++){
 $ready=az containerapp show -g rg-ucell-production -n "ucell-prod-$part" --query properties.latestReadyRevisionName -o tsv
 if($ready -eq "ucell-prod-$part--$tag"){Write-Output "$part ready";return};Start-Sleep 3
};throw 'Readiness pending'
