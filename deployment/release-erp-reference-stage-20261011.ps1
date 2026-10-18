$ErrorActionPreference='Stop'
$release='C:/UCell/releases/erp-reference-stage-20261011'
$azPython='C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe'
function StageAz([string[]]$Arguments){
 $result=& $azPython -X utf8 -IBm azure.cli @Arguments
 if($LASTEXITCODE -ne 0){throw "Stage Azure command failed: $($Arguments[0..1] -join ' ')"}
 $result
}
$tests=Get-Content 'C:/UCell/logs/institution-erp-stage-acceptance-20261011.json' -Raw|ConvertFrom-Json
if($tests.numPassedTests -ne 62 -or $tests.numFailedTests -ne 0){throw 'Acceptance gate failed'}
foreach($id in @('ck2a','ck2b')){
 $state=(StageAz @('acr','task','show-run','-r','ucellstageacr5mafbbsq33mgu','--run-id',$id,'--query','status','-o','tsv','--only-show-errors')).Trim()
 if($state -ne 'Succeeded'){throw "Build $id not succeeded: $state"}
}
$before=Get-Content "$release/stage-before.json" -Raw|ConvertFrom-Json
$images=@{}
foreach($service in @('api','admin')){
 $app="ucell-stage-$service"
 $old=$before|Where-Object name -eq $app
 $current=(StageAz @('containerapp','show','-g','rg-ucell-stage','-n',$app,'--query','properties.template.containers[0].image','-o','tsv','--only-show-errors')).Trim()
 if($current -ne $old.image){throw "Stage changed concurrently: $app"}
 $digest=(StageAz @('acr','repository','show','-n','ucellstageacr5mafbbsq33mgu','--image',"ucell-${service}:erp-reference-20261011",'--query','digest','-o','tsv','--only-show-errors')).Trim()
 if($digest -notmatch '^sha256:[a-f0-9]{64}$'){throw 'Invalid digest'}
 $images[$service]="ucellstageacr5mafbbsq33mgu.azurecr.io/ucell-${service}@$digest"
}
$changed=@()
try{
 foreach($service in @('api','admin')){
  $app="ucell-stage-$service";$changed+=$app
  StageAz @('containerapp','update','-g','rg-ucell-stage','-n',$app,'--image',$images[$service],'--revision-suffix','erp-ref-20261011','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')
  $healthy=$false
  for($i=0;$i -lt 36;$i++){
   $state=StageAz @('containerapp','revision','show','-g','rg-ucell-stage','-n',$app,'--revision',"$app--erp-ref-20261011",'--query','{health:properties.healthState,running:properties.runningState}','-o','json','--only-show-errors')|ConvertFrom-Json
   if($state.health -eq 'Healthy' -and $state.running -eq 'Running'){$healthy=$true;break}
   if($state.health -eq 'Unhealthy' -or $state.running -eq 'Failed'){throw "$app unhealthy"}
   Start-Sleep -Seconds 5
  }
  if(-not $healthy){throw "$app readiness timeout"}
  Write-Output "$app HEALTHY"
 }
 $after=StageAz @('containerapp','list','-g','rg-ucell-stage','--query','[].{name:name,image:properties.template.containers[0].image,revision:properties.latestReadyRevisionName}','-o','json','--only-show-errors')|ConvertFrom-Json
 foreach($name in @('ucell-stage-worker','ucell-stage-member')){if(($after|Where-Object name -eq $name).image -ne ($before|Where-Object name -eq $name).image){throw "Unexpected concurrent change: $name"}}
 @{date=[DateTimeOffset]::UtcNow.ToString('o');environment='STAGE';images=$images;before=$before;after=$after;sourceManifestHash=(Get-FileHash "$release/source-manifest.json" -Algorithm SHA256).Hash;health='PASS';migrationRequired=$false;productionChanged=$false}|ConvertTo-Json -Depth 6|Set-Content -Encoding utf8 "$release/stage-release.json"
}catch{
 $failure=$_
 foreach($app in $changed){$old=$before|Where-Object name -eq $app;StageAz @('containerapp','update','-g','rg-ucell-stage','-n',$app,'--image',$old.image,'--revision-suffix','erp-rollback-20261011','--query','properties.latestRevisionName','-o','tsv','--only-show-errors')}
 throw $failure
}
