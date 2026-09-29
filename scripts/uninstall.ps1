$ErrorActionPreference = 'Stop'

$appName = 'Auto Typer'
$dest = Join-Path $env:LOCALAPPDATA "Programs\$appName"

Get-Process -Name $appName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

if (Test-Path $dest) {
    Remove-Item -LiteralPath $dest -Recurse -Force
}
foreach ($dir in @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop'))) {
    $link = Join-Path $dir "$appName.lnk"
    if (Test-Path $link) {
        Remove-Item -LiteralPath $link -Force
    }
}

Write-Host "$appName uninstalled."
