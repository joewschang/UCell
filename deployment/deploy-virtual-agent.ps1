param([Parameter(Mandatory)][ValidateSet('admin','member','website')][string]$Component)
$ErrorActionPreference='Stop'
$az='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function Az([string[]]$Arguments){$r=& $az -X utf8 -IBm azure.cli @Arguments --only-show-errors;if($LASTEXITCODE -ne 0){throw 'Deployment command failed'};return $r}
$manifest=Get-Content C:/UCell/virtual-agent-20261022/manifest.json -Raw|ConvertFrom-Json
$current=(Az @('containerapp','show','-g','rg-ucell-production','-n',"ucell-prod-$Component",'--query','properties.template.containers[0].image','-o','tsv')).Trim()
if($current -ne $manifest.observed.$Component){throw 'Concurrent production change: inspect before deploying'}
$tag='virtual-agent-20261022-v1'
$digest=(Az @('acr','repository','show','-n','ucellprodacrm3z2zx4ohqyui','--image',"ucell-${Component}:$tag",'--query','digest','-o','tsv')).Trim()
if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Invalid image digest'}
Az @('containerapp','update','-g','rg-ucell-production','-n',"ucell-prod-$Component",'--image',"ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-$Component@$digest",'--revision-suffix',$tag,'--query','{name:name,revision:properties.latestRevisionName}','-o','json')
