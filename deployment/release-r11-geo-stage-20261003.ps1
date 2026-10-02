param([Parameter(Mandatory=$true)][string]$ApiImage,[Parameter(Mandatory=$true)][string]$AdminImage)
$ErrorActionPreference='Stop'
$sourceCommit='94d0f918514061016e8d40381da8db22ba97b6d8'
$rg='rg-ucell-stage'
if($ApiImage -notmatch '^ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-api@sha256:[a-f0-9]{64}$' -or $AdminImage -notmatch '^ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-admin@sha256:[a-f0-9]{64}$'){throw 'Only pinned Stage ACR artifacts are allowed.'}
if(-not(Select-String -LiteralPath 'C:/UCell/logs/r11-api-full-20261003.log' -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet)){throw 'Full isolated API regression is required.'}
if(-not(Select-String -LiteralPath 'C:/UCell/logs/r11-admin-tests-20261003.log' -Pattern '237 passed' -Quiet)){throw 'Admin regression is required.'}
if(-not(Select-String -LiteralPath 'C:/UCell/logs/r11-geo-stage-auth-20261003.log' -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet)){throw 'Stage-specific Geo authentication verification is required.'}
function AzChecked([string[]]$Arguments){$result=& az @Arguments;if($LASTEXITCODE -ne 0){throw "Azure operation failed: $($Arguments[0..1] -join ' ')"};$result}
$before=@();foreach($name in @('ucell-stage-api','ucell-stage-worker','ucell-stage-admin','ucell-stage-member')){$before+=AzChecked @('containerapp','show','--name',$name,'--resource-group',$rg,'--query','{name:name,image:properties.template.containers[0].image,revision:properties.latestReadyRevisionName}','-o','json','--only-show-errors')|ConvertFrom-Json}
$before|ConvertTo-Json -Depth 5|Set-Content (Join-Path $PSScriptRoot 'r11-geo-stage-before-20261003.json') -Encoding utf8
AzChecked @('containerapp','job','update','--name','ucell-stage-migrate','--resource-group',$rg,'--image',$ApiImage,'--container-name','ucell-stage-migrate','--command','node','--args','scripts/stage-profile-migration-recovery.mjs','--query','name','-o','tsv','--only-show-errors')|Out-Null
$execution=(AzChecked @('containerapp','job','start','--name','ucell-stage-migrate','--resource-group',$rg,'--query','name','-o','tsv','--only-show-errors')).Trim()
Write-Output "Stage migration started: $execution"
$status='';for($i=0;$i -lt 120;$i++){Start-Sleep -Seconds 5;$status=(AzChecked @('containerapp','job','execution','show','--name','ucell-stage-migrate','--resource-group',$rg,'--job-execution-name',$execution,'--query','properties.status','-o','tsv','--only-show-errors')).Trim();if($status -notin @('Running','Processing','Pending')){break}}
if($status -ne 'Succeeded'){throw "Stage migration did not succeed: $status"}
AzChecked @('containerapp','update','--name','ucell-stage-api','--resource-group',$rg,'--image',$ApiImage,'--revision-suffix','r11-geo-20261003','--set-env-vars',"RELEASE_GIT_HEAD=$sourceCommit",'GEO_PROFILE_REFRESH_ENABLED=true','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
AzChecked @('containerapp','update','--name','ucell-stage-worker','--resource-group',$rg,'--image',$ApiImage,'--revision-suffix','r11-geo-20261003','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
AzChecked @('containerapp','update','--name','ucell-stage-admin','--resource-group',$rg,'--image',$AdminImage,'--revision-suffix','r11-geo-20261003','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
[pscustomobject]@{apiSourceCommit=$sourceCommit;adminSourceCommit='a3270fd32f17cb6cbfff0ec1ac80c606311f0f28';apiImage=$ApiImage;adminImage=$AdminImage;migrationExecution=$execution;migrationStatus=$status;stagePreviewOnly=$true;pr='https://github.com/joewschang/UCell/pull/23';deployedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'r11-geo-stage-release-20261003.json') -Encoding utf8
