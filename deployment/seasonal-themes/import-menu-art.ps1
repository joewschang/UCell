param([Parameter(Mandatory)][string]$InputDirectory)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$files=[ordered]@{christmas='聖誕繽紛四格會員選單.png';lunar='金紅新春四格會員服務選單.png';newyear='Luxurious New Year Gold-Emerald Menu.png'}
$codec=[Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
foreach($key in $files.Keys){
 $image=[Drawing.Image]::FromFile((Join-Path $InputDirectory $files[$key]))
 $bitmap=[Drawing.Bitmap]::new(1280,864)
 $g=[Drawing.Graphics]::FromImage($bitmap)
 $opts=[Drawing.Imaging.EncoderParameters]::new(1)
 try{
  if($image.Height -ne 1031 -or $image.Width -notin 1525,1526){throw 'Unexpected source size'}
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.DrawImage($image,[Drawing.Rectangle]::new(0,0,1280,864))
  $opts.Param[0]=[Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality,[long]94)
  $file=Join-Path $PSScriptRoot "art/menu-$key.jpg"
  $bitmap.Save($file,$codec,$opts)
  if((Get-Item $file).Length -ge 1000000){throw "Oversize: $file"}
 }finally{$opts.Dispose();$g.Dispose();$bitmap.Dispose();$image.Dispose()}
}
