param([Parameter(Mandatory)][ValidateSet('api','admin','member')][string]$Component,[Parameter(Mandatory)][ValidatePattern('^ai-stage-20261022-v[0-9]+$')][string]$Tag,[string]$RecordPath='C:/UCell/ai-stage-20261022/deployed-images.json')
$ErrorActionPreference='Stop'
$azPython='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function Az([string[]]$Arguments){$r=& $azPython -X utf8 -IBm azure.cli @Arguments --only-show-errors;if($LASTEXITCODE -ne 0){throw 'Stage update failed'};return $r}
$record=Get-Content -LiteralPath $RecordPath -Raw|ConvertFrom-Json
$current=(Az @('containerapp','show','-g','rg-ucell-stage','-n',"ucell-stage-$Component",'--query','properties.template.containers[0].image','-o','tsv')).Trim()
if($current -ne $record.$Component){throw 'Concurrent Stage revision change'}
$repository=if($Component -eq 'api'){'ucell-backend'}else{"ucell-$Component"}
$digest=(Az @('acr','repository','show','-n','ucellstageacr5mafbbsq33mgu','--image',"${repository}:$Tag",'--query','digest','-o','tsv')).Trim()
if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Invalid digest'}
$record.$Component="ucellstageacr5mafbbsq33mgu.azurecr.io/$repository@$digest"
Az @('containerapp','update','-g','rg-ucell-stage','-n',"ucell-stage-$Component",'--image',$record.$Component,'--revision-suffix',$Tag,'--query','{name:name,revision:properties.latestRevisionName}','-o','json')
$record|ConvertTo-Json|Set-Content -LiteralPath $RecordPath
