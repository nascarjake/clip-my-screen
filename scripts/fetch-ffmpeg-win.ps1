$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')
New-Item -ItemType Directory -Force vendor/ffmpeg | Out-Null
$archive = 'vendor/ffmpeg9.0.1-windows-x64.zip'
Invoke-WebRequest 'https://github.com/ispysoftware/agentdvr-ffmpeg-build/releases/download/v9.0.1/ffmpeg9.0.1-windows-x64.zip' -OutFile $archive
$expected = '17eaa8c3f7f39b20224c4e09276272f36f6b3829f5c728ee084e391d159eeb55'
$actual = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'FFmpeg checksum mismatch' }
Expand-Archive $archive -DestinationPath vendor/ffmpeg -Force
$ErrorActionPreference = 'Continue'
$build = (& vendor/ffmpeg/ffmpeg.exe -buildconf 2>&1 | Out-String)
if ($build -notmatch '--disable-nonfree' -or $build -notmatch '--enable-gpl') { throw 'FFmpeg build is not redistributable' }
$encoders = (& vendor/ffmpeg/ffmpeg.exe -encoders 2>&1 | Out-String)
if ($encoders -notmatch 'libx264') { throw 'FFmpeg build lacks H.264 encoding' }
Write-Output 'Verified redistributable GPL FFmpeg with H.264 encoding.'
