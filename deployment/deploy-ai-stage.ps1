param([string]$Tag='ai-stage-20261022-v1')
$ErrorActionPreference='Stop'
if($Tag -notmatch '^ai-stage-20261022-v[0-9]+$'){throw 'Invalid release tag'}
$azPython='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function Az([string[]]$Arguments){$r=& $azPython -X utf8 -IBm azure.cli @Arguments --only-show-errors;if($LASTEXITCODE -ne 0){throw 'Stage deployment command failed'};return $r}
$baselines=@{
 api='ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-backend@sha256:466af564544b54b356fb623eadc2f66a5105b4de0e1fca1b721ff248ec710eab'
 admin='ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-admin@sha256:478b8aa278d7a7bcf0cb70ba2fbe59a7f754026a46b5e0d2469bb9ce1f3090ff'
 member='ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-member@sha256:9a8b432a4a1bf7d985a26e7a76ce61a759179776c60b4673c88a3de97e291e29'
}
$images=@{}
foreach($app in @('api','admin','member')){
 $repository=if($app -eq 'api'){'ucell-backend'}else{"ucell-$app"}
 $digest=(Az @('acr','repository','show','-n','ucellstageacr5mafbbsq33mgu','--image',"${repository}:$Tag",'--query','digest','-o','tsv')).Trim()
 if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Missing digest'}
 $images[$app]="ucellstageacr5mafbbsq33mgu.azurecr.io/$repository@$digest"
 $current=(Az @('containerapp','show','-g','rg-ucell-stage','-n',"ucell-stage-$app",'--query','properties.template.containers[0].image','-o','tsv')).Trim()
 if($current -ne $baselines[$app] -and $current -ne $images[$app]){throw "Concurrent Stage revision change: $app"}
}
$key=(Az @('cognitiveservices','account','keys','list','-g','rg-ucell-stage','-n','ucell-stage-ai-20261022','--query','key1','-o','tsv')).Trim()
try{Az @('containerapp','secret','set','-g','rg-ucell-stage','-n','ucell-stage-api','--secrets',"ai-azure-key=$key",'-o','none')|Out-Null}finally{$key=$null}
Az @('containerapp','update','-g','rg-ucell-stage','-n','ucell-stage-api','--image',$images.api,'--revision-suffix',$Tag,'--set-env-vars','AI_ENABLED=true','AI_AZURE_ENDPOINT=https://ucell-stage-ai-20261022.openai.azure.com','AI_AZURE_DEPLOYMENT=ucell-stage-planner','AI_AZURE_KEY=secretref:ai-azure-key','AI_MONTHLY_TOKEN_LIMIT=500000','--query','{name:name,revision:properties.latestRevisionName}','-o','json')
foreach($app in @('admin','member')){Az @('containerapp','update','-g','rg-ucell-stage','-n',"ucell-stage-$app",'--image',$images[$app],'--revision-suffix',$Tag,'--query','{name:name,revision:properties.latestRevisionName}','-o','json')}
$images|ConvertTo-Json|Set-Content C:/UCell/ai-stage-20261022/deployed-images.json
