$ErrorActionPreference='Stop'
# Stage only. Existing secrets, LINE configuration and Worker remain intact.
$smsAz='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
$smsRegistry='ucellstageacr5mafbbsq33mgu.azurecr.io'
function SmsAz([string[]]$Arguments){
 $result=& $smsAz -X utf8 -IBm azure.cli @Arguments
 if($LASTEXITCODE -ne 0){throw "Azure operation failed: $($Arguments[0..1] -join ' ')"}
 $result
}
if(-not(Select-String -LiteralPath 'C:/UCell/logs/sms-release-api-tests.log' -Pattern '^API_JEST_ISOLATED_PASS$' -Quiet)){throw 'Full isolated API regression must pass before rollout'}
$migration=SmsAz @('containerapp','job','execution','show','-g','rg-ucell-stage','-n','ucell-stage-migrate','--job-execution-name','ucell-stage-migrate-1weg4ob','--query','properties.status','-o','tsv','--only-show-errors')
if($migration.Trim() -ne 'Succeeded'){throw 'Stage migration must succeed before rollout'}
$images=@{}
foreach($service in @('api','member','admin')){
 $digest=(SmsAz @('acr','repository','show','-n','ucellstageacr5mafbbsq33mgu','--image',"ucell-${service}:sms-stage-20261008",'--query','digest','-o','tsv','--only-show-errors')).Trim()
 if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Invalid image digest'}
 $images[$service]="$smsRegistry/ucell-${service}@$digest"
}
$manifest=(Get-FileHash 'C:/UCell/releases/sms-stage-20261008/source-manifest.json' -Algorithm SHA256).Hash.ToLowerInvariant()
$images|ConvertTo-Json|Set-Content (Join-Path $PSScriptRoot 'stage-images-20261008.json')
foreach($service in @('api','member','admin')){
 $app="ucell-stage-$service"
 $arguments=@('containerapp','update','-g','rg-ucell-stage','-n',$app,'--image',$images[$service],'--revision-suffix','sms-20261008','--set-env-vars',"RELEASE_SOURCE_MANIFEST_SHA256=$manifest")
 if($service -eq 'api'){$arguments+=@('CONTACT_VERIFICATION_SMS_REQUIRED=true','AUTH_MEMBER_SMS_LOGIN_ENABLED=true','SMS_NOTIFICATIONS_ENABLED=true','AUTH_CHANNEL_ENABLE_SMS_OTP=false','SMS_OTP_DAILY_LIMIT=200','SMS_NOTIFICATION_DAILY_LIMIT=500')}
 $arguments+=@('--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
 SmsAz $arguments
 $healthy=$false
 for($attempt=0;$attempt -lt 36;$attempt++){
  $state=SmsAz @('containerapp','revision','show','-g','rg-ucell-stage','-n',$app,'--revision',"$app--sms-20261008",'--query','{health:properties.healthState,running:properties.runningState}','-o','json','--only-show-errors')|ConvertFrom-Json
  if($state.health -eq 'Healthy' -and $state.running -eq 'Running'){$healthy=$true;break}
  if($state.running -eq 'Failed' -or $state.health -eq 'Unhealthy'){throw "Unhealthy Stage revision: $app"}
  Start-Sleep -Seconds 5
 }
 if(-not $healthy){throw "Stage readiness timed out: $app"}
 Write-Output "$app HEALTHY"
}
@{date=[DateTimeOffset]::UtcNow.ToString('o');environment='STAGE';images=$images;manifestHash=$manifest;migration='ucell-stage-migrate-1weg4ob';health='PASS';workerChanged=$false;productionChanged=$false}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $PSScriptRoot 'stage-release-20261008.json')
