# One-time Stage release: preserve all current operational configuration and secrets.
# Run only after isolated API validation passes. Never targets Production.
$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$apiTestLog='C:/UCell/logs/integration-stage-api-verified-20261003.log'
if(-not (Select-String -LiteralPath $apiTestLog -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet)){throw 'Full isolated API validation must pass before Stage rollout.'}
$rg='rg-ucell-stage'
$registry='ucellstageacr5mafbbsq33mgu.azurecr.io'
$backendImage="$registry/ucell-api@sha256:324222a587b7f870d3b45bb76fe30a8d03c24fcdd6b48dc230a3cb6c708294f4"
$migrationImage="$registry/ucell-api@sha256:e4e7a608df566b57a4146ea6c6db06369294a8ef4c8b03042e2532043410e0d2"
$adminImage="$registry/ucell-admin@sha256:3cfab35ff427ec696d26ec8ac9136a9246abd05516aede83b03d5050bd6c257f"
$memberImage="$registry/ucell-member@sha256:0976b4d3316021d1ac4088eadcbb6e9a365673886a4184b086783bf4720d65bf"
function Az-Checked([string[]]$Arguments){$result=& az @Arguments;if($LASTEXITCODE -ne 0){throw "Azure operation failed: $($Arguments[0..1] -join ' ')"};$result}
$before=@();foreach($appName in @('ucell-stage-api','ucell-stage-worker','ucell-stage-admin','ucell-stage-member')){$before+=Az-Checked @('containerapp','show','--name',$appName,'--resource-group',$rg,'--query','{name:name,image:properties.template.containers[0].image,revision:properties.latestReadyRevisionName}','-o','json','--only-show-errors')|ConvertFrom-Json}
$before|ConvertTo-Json -Depth 5|Set-Content (Join-Path $PSScriptRoot 'stage-integration-before-20261003.json') -Encoding utf8
Az-Checked @('containerapp','job','update','--name','ucell-stage-migrate','--resource-group',$rg,'--image',$migrationImage,'--container-name','ucell-stage-migrate','--command','node','--args','scripts/stage-profile-migration-recovery.mjs','--query','name','-o','tsv','--only-show-errors')|Out-Null
# The existing recovery runner checks every applied SQL checksum before forward migrations.
$execution=(Az-Checked @('containerapp','job','start','--name','ucell-stage-migrate','--resource-group',$rg,'--query','name','-o','tsv','--only-show-errors')).Trim()
if(-not $execution){throw 'Migration execution name missing.'}
Write-Output "Stage migration started: $execution"
$status='';for($i=0;$i -lt 120;$i++){Start-Sleep -Seconds 5;$status=(Az-Checked @('containerapp','job','execution','show','--name','ucell-stage-migrate','--resource-group',$rg,'--job-execution-name',$execution,'--query','properties.status','-o','tsv','--only-show-errors')).Trim();if($status -notin @('Running','Processing','Pending')){break}}
if($status -ne 'Succeeded'){throw "Stage migration did not succeed: $status"}
Write-Output 'Stage migration succeeded.'
$secretNames=@(Az-Checked @('containerapp','secret','list','--name','ucell-stage-api','--resource-group',$rg,'--query','[].name','-o','json','--only-show-errors')|ConvertFrom-Json)
if('identity-match-hmac-secret' -notin $secretNames){
 $bytes=[byte[]]::new(48);[Security.Cryptography.RandomNumberGenerator]::Fill($bytes);$fingerprintSecret=[Convert]::ToBase64String($bytes)
 try{Az-Checked @('containerapp','secret','set','--name','ucell-stage-api','--resource-group',$rg,'--secrets',"identity-match-hmac-secret=$fingerprintSecret",'--query','[].name','-o','json','--only-show-errors')|Out-Null}finally{$fingerprintSecret=$null;[Array]::Clear($bytes)}
}
Az-Checked @('containerapp','update','--name','ucell-stage-api','--resource-group',$rg,'--image',$backendImage,'--revision-suffix','r10b-integrated-20261003','--set-env-vars','RELEASE_GIT_HEAD=fdbd08606ad665be4ddd85ff6550c06463978aa3','IDENTITY_MATCH_HMAC_SECRET=secretref:identity-match-hmac-secret','AUTH_CHANNEL_ENABLE_SMS_OTP=false','MEMBER_WEB_PUBLIC_ORIGIN=https://stage.ucell.life','CORS_ALLOWED_ORIGINS=https://admin-stage.ucell.life,https://stage.ucell.life','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
Az-Checked @('containerapp','update','--name','ucell-stage-worker','--resource-group',$rg,'--image',$backendImage,'--revision-suffix','r10b-integrated-20261003','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
foreach($frontend in @(@{name='ucell-stage-admin';image=$adminImage},@{name='ucell-stage-member';image=$memberImage})){Az-Checked @('containerapp','update','--name',$frontend.name,'--resource-group',$rg,'--image',$frontend.image,'--revision-suffix','r10b-integrated-20261003','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')}
[pscustomobject]@{migrationExecution=$execution;migrationStatus=$status;backendImage=$backendImage;adminImage=$adminImage;memberImage=$memberImage;runtimeSourceCommit='fdbd08606ad665be4ddd85ff6550c06463978aa3';frontendSourceCommit='0fdfb454bdd4abeacdb31e2397d591cdba2911e0';pr='https://github.com/joewschang/UCell/pull/22';deployedAtUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'stage-integration-release-20261003.json') -Encoding utf8
'INTEGRATED_STAGE_RELEASE_SUBMITTED'
