[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)][ValidateSet('api','worker','member','admin','website','sms-egress')][string]$Component,
    [Parameter(Mandatory)][ValidatePattern('^sha256:[a-f0-9]{64}$')][string]$Digest,
    [Parameter(Mandatory)][string]$ExpectedRevision
)
$ErrorActionPreference = 'Stop'
$group = 'rg-ucell-production'
$registry = 'ucellprodacrm3z2zx4ohqyui'
$app = "ucell-prod-$Component"
function Invoke-Az([string[]]$Arguments) {
    $value = & az @Arguments --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Azure CLI failed: $($Arguments[0..1] -join ' ')" }
    return $value
}
function Get-App {
    return (Invoke-Az @('containerapp','show','-g',$group,'-n',$app,'--query','{latest:properties.latestRevisionName,ready:properties.latestReadyRevisionName,image:properties.template.containers[0].image}','-o','json') | ConvertFrom-Json)
}
$repository = "ucell-$Component"
$image = "$registry.azurecr.io/$repository@$Digest"
$actual = Invoke-Az @('acr','repository','show','-n',$registry,'--image',"$repository@$Digest",'--query','digest','-o','tsv')
if ($actual -cne $Digest) { throw 'ACR digest mismatch' }
$before = Get-App
if ($before.latest -ne $ExpectedRevision -or $before.ready -ne $ExpectedRevision) { throw "Production revision changed or is not ready: $($before.latest)" }
Write-Output "Current $app $($before.ready) $($before.image)"
if ($before.image -ne $image) {
    if (!$PSCmdlet.ShouldProcess($app,"Deploy $image")) { return }
    $suffix = 'rel-' + [DateTime]::UtcNow.ToString('yyMMddHHmmss') + '-' + $Digest.Substring(7,6)
    $revision = "$app--$suffix"
    Invoke-Az @('containerapp','update','-g',$group,'-n',$app,'--image',$image,'--revision-suffix',$suffix,'-o','none')
} else { $revision = $before.ready }
for ($i=0; $i -lt 30; $i++) {
    $live = Get-App
    if ($live.latest -ne $revision) { throw "Another revision is current: $($live.latest)" }
    if ($live.ready -eq $revision -and $live.image -eq $image) { break }
    Start-Sleep -Seconds 5
}
if ($live.ready -ne $revision -or $live.image -ne $image) { throw "Revision readiness timed out: $revision" }
$public = @{api='https://api.ucell.life/api/v1/health';admin='https://admin.ucell.life/';member='https://member.ucell.life/';website='https://www.ucell.life/'}
if ($public.ContainsKey($Component)) {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $public[$Component] -TimeoutSec 20
    if ($response.StatusCode -ne 200) { throw "Public health check failed: $($response.StatusCode)" }
}
Write-Output "Ready $revision $Digest"
