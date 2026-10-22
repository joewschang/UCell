param([Parameter(Mandatory=$true)][string]$Script)
$ErrorActionPreference='Stop'
$azPython='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function Invoke-StageAz([string[]]$Arguments){$result=& $azPython -X utf8 -IBm azure.cli @Arguments --only-show-errors;if($LASTEXITCODE -ne 0){throw 'Stage Azure command failed'};return $result}
$secrets=Invoke-StageAz @('containerapp','secret','list','-g','rg-ucell-stage','-n','ucell-stage-api','--show-values','-o','json')|ConvertFrom-Json
$env:DATABASE_URL=($secrets|Where-Object name -eq 'database-url').value
if(!$env:DATABASE_URL -or $env:DATABASE_URL -notmatch 'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com' -or $env:DATABASE_URL -notmatch '/ucell_stage(?:\?|$)'){throw 'Refuse non-Stage database'}
$env:STAGE_UAT_MEMBER_TOKEN=($secrets|Where-Object name -eq 'stage-uat-member-token').value
$env:UCELL_ENVIRONMENT='STAGE'
$env:NODE_ENV='staging'
$env:AI_ENABLED='true'
$env:AI_AZURE_ENDPOINT='https://ucell-stage-ai-20261022.openai.azure.com'
$env:AI_AZURE_DEPLOYMENT='ucell-stage-planner'
$env:AI_AZURE_KEY=(Invoke-StageAz @('cognitiveservices','account','keys','list','-g','rg-ucell-stage','-n','ucell-stage-ai-20261022','--query','key1','-o','tsv')).Trim()
try{node $Script;if($LASTEXITCODE -ne 0){throw 'Stage script failed'}}finally{$env:DATABASE_URL=$null;$env:STAGE_UAT_MEMBER_TOKEN=$null;$env:AI_AZURE_KEY=$null;$secrets=$null}
