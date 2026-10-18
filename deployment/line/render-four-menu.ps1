param([string]$OutputPath = "$PSScriptRoot/ucell-four-services.png")
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$bitmap=[Drawing.Bitmap]::new(2500,1686)
$g=[Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode='AntiAlias'; $g.TextRenderingHint='AntiAliasGridFit'
function Brush([string]$c){[Drawing.SolidBrush]::new([Drawing.ColorTranslator]::FromHtml($c))}
function Label([string]$text,[float]$x,[float]$y,[int]$size,[string]$color,[bool]$bold=$false){
 $style=if($bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular}
 $font=[Drawing.Font]::new('Microsoft JhengHei',$size,$style,[Drawing.GraphicsUnit]::Pixel)
 $b=Brush $color; $g.DrawString($text,$font,$b,$x,$y);$font.Dispose();$b.Dispose()
}
$tiles=@(
 @{x=0;y=0;title='會員中心';sub='我的帳戶與會員服務';tag='MEMBER';dark=$true},
 @{x=1250;y=0;title='活動報名';sub='探索活動，一起參與';tag='EVENTS';dark=$false},
 @{x=0;y=843;title='線上商城';sub='用心選購，美好生活';tag='SHOP';dark=$false},
 @{x=1250;y=843;title='常見問答';sub='快速找到需要的解答';tag='SUPPORT';dark=$true}
)
for($i=0;$i -lt 4;$i++){
 $t=$tiles[$i];$x=$t.x;$y=$t.y;$bg=if($t.dark){'#173F36'}else{'#F4F0E7'};$ink=if($t.dark){'#F4F0E7'}else{'#173F36'};$muted=if($t.dark){'#BDD1C1'}else{'#577367'}
 $b=Brush $bg;$g.FillRectangle($b,$x,$y,1250,843);$b.Dispose()
 Label 'UCell' ($x+80) ($y+54) 39 $muted $true
 Label $t.tag ($x+870) ($y+64) 26 $muted
 $pen=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml($ink),10)
 $cx=$x+92;$cy=$y+195
 switch($i){
  0 {$g.DrawEllipse($pen,$cx+44,$cy,92,92);$g.DrawArc($pen,$cx,$cy+116,180,120,180,180);$g.DrawLine($pen,$cx,$cy+176,$cx+180,$cy+176)}
  1 {$g.DrawRectangle($pen,$cx,$cy+20,180,170);$g.DrawLine($pen,$cx,$cy+75,$cx+180,$cy+75);$g.DrawLine($pen,$cx+40,$cy,$cx+40,$cy+40);$g.DrawLine($pen,$cx+140,$cy,$cx+140,$cy+40);$g.DrawLine($pen,$cx+45,$cy+125,$cx+78,$cy+151);$g.DrawLine($pen,$cx+78,$cy+151,$cx+141,$cy+99)}
  2 {$g.DrawRectangle($pen,$cx,$cy+60,180,145);$g.DrawArc($pen,$cx+45,$cy,90,125,180,180)}
  3 {$g.DrawEllipse($pen,$cx,$cy,190,190);Label '?' ($cx+53) ($cy+7) 137 $ink $true}
 }
 $pen.Dispose()
 Label $t.title ($x+75) ($y+466) 98 $ink $true
 Label $t.sub ($x+82) ($y+611) 38 $muted
 Label '→' ($x+1045) ($y+579) 77 $ink
}
$line=[Drawing.Pen]::new([Drawing.ColorTranslator]::FromHtml('#B7C5B9'),2);$g.DrawLine($line,1250,0,1250,1686);$g.DrawLine($line,0,843,2500,843);$line.Dispose()
$bitmap.Save([IO.Path]::GetFullPath($OutputPath),[Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$bitmap.Dispose()
Write-Output $OutputPath
