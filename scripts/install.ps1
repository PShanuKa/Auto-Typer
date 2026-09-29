$ErrorActionPreference = 'Stop'

$appName = 'Auto Typer'
$source = Join-Path $PSScriptRoot '..\release\win-unpacked'
$dest = Join-Path $env:LOCALAPPDATA "Programs\$appName"
$exe = Join-Path $dest "$appName.exe"

if (-not (Test-Path (Join-Path $source "$appName.exe"))) {
    throw "Build output not found at $source - run 'npm run dist' first."
}

Get-Process -Name $appName -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500

if (Test-Path $dest) {
    Remove-Item -LiteralPath $dest -Recurse -Force
}
New-Item -ItemType Directory -Path $dest -Force | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $dest -Recurse -Force

$shell = New-Object -ComObject WScript.Shell
$shortcutDirs = @(
    [Environment]::GetFolderPath('Programs'),
    [Environment]::GetFolderPath('Desktop')
)
foreach ($dir in $shortcutDirs) {
    $shortcut = $shell.CreateShortcut((Join-Path $dir "$appName.lnk"))
    $shortcut.TargetPath = $exe
    $shortcut.WorkingDirectory = $dest
    $shortcut.Description = 'Type text as keystrokes into Remote Desktop'
    $shortcut.Save()
}

Write-Host "$appName installed to $dest"
Write-Host 'Shortcuts added to the Start menu and Desktop.'
