param([Parameter(Mandatory)][ValidateSet('api','admin','member')][string]$Component)
$ErrorActionPreference='Stop'
$az='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function Az([string[]]$Arguments){$r=& $az -X utf8 -IBm azure.cli @Arguments --only-show-errors;if($LASTEXITCODE -ne 0){throw 'Production deployment failed'};return $r}
$path='C:/UCell/ai-production-20261022/deployed-images.json'
$manifest=Get-Content C:/UCell/ai-production-20261022/manifest.json -Raw|ConvertFrom-Json
$current=(Az @('containerapp','show','-g','rg-ucell-production','-n',"ucell-prod-$Component",'--query','properties.template.containers[0].image','-o','tsv')).Trim()
if($current -ne $manifest.baseline.$Component){throw 'Concurrent production change; inspect before deployment'}
$repository="ucell-$Component";$tag='ai-production-20261022-v1'
$digest=(Az @('acr','repository','show','-n','ucellprodacrm3z2zx4ohqyui','--image',"${repository}:$tag",'--query','digest','-o','tsv')).Trim()
if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Missing image digest'}
$image="ucellprodacrm3z2zx4ohqyui.azurecr.io/$repository@$digest"
$argsList=@('containerapp','update','-g','rg-ucell-production','-n',"ucell-prod-$Component",'--image',$image,'--revision-suffix',$tag)
if($Component -eq 'api'){
 $key=(Az @('cognitiveservices','account','keys','list','-g','rg-ucell-production','-n','ucell-prod-ai-20261022','--query','key1','-o','tsv')).Trim()
 try{Az @('containerapp','secret','set','-g','rg-ucell-production','-n','ucell-prod-api','--secrets',"ai-azure-key=$key",'-o','none')|Out-Null}finally{$key=$null}
 $argsList+=@('--set-env-vars','AI_ENABLED=true','AI_ACCESS_MODE=PRODUCTION_ROLES','AI_AZURE_ENDPOINT=https://ucell-prod-ai-20261022.openai.azure.com','AI_AZURE_DEPLOYMENT=ucell-prod-planner','AI_AZURE_KEY=secretref:ai-azure-key','AI_MONTHLY_TOKEN_LIMIT=500000')
}
Az ($argsList+@('--query','{name:name,revision:properties.latestRevisionName}','-o','json'))
$record=if(Test-Path -LiteralPath $path){Get-Content -LiteralPath $path -Raw|ConvertFrom-Json -AsHashtable}else{@{}}
$record[$Component]=$image;$record|ConvertTo-Json|Set-Content -LiteralPath $path
