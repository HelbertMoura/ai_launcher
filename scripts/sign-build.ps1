# sign-build.ps1 - Sign generated binary and MSI/NSIS installers
# Usage: PS> .\scripts\sign-build.ps1
# Requires: run gen-cert.ps1 first

[CmdletBinding()]
param(
    [string]$PfxPath  = "",
    [string]$Password = "ailauncher-dev",
    [string]$Timestamp = "http://timestamp.digicert.com"
)

$ErrorActionPreference = "Stop"

# Resolve script root
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue }
if (-not $scriptRoot) { $scriptRoot = (Get-Location).Path }

if (-not $PfxPath) { $PfxPath = Join-Path $scriptRoot "certs\ai-launcher.pfx" }

# Find signtool.exe (Windows SDK)
$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match "x64\\signtool.exe" } |
    Sort-Object -Property FullName -Descending |
    Select-Object -First 1

if (-not $signtool) {
    Write-Host "ERROR: signtool.exe not found. Install Windows SDK." -ForegroundColor Red
    exit 1
}
Write-Host "signtool: $($signtool.FullName)" -ForegroundColor Gray

if (-not (Test-Path $PfxPath)) {
    Write-Host "ERROR: $PfxPath not found. Run gen-cert.ps1 first." -ForegroundColor Red
    exit 1
}

$root = Split-Path -Parent $scriptRoot
$targets = @()
$mainExe = Join-Path $root "src-tauri\target\release\ai-launcher.exe"
if (Test-Path $mainExe) { $targets += $mainExe }

$nsisDir = Join-Path $root "src-tauri\target\release\bundle\nsis"
if (Test-Path $nsisDir) {
    Get-ChildItem $nsisDir -Filter "*.exe" | ForEach-Object { $targets += $_.FullName }
}

$msiDir = Join-Path $root "src-tauri\target\release\bundle\msi"
if (Test-Path $msiDir) {
    Get-ChildItem $msiDir -Filter "*.msi" | ForEach-Object { $targets += $_.FullName }
}

if ($targets.Count -eq 0) {
    Write-Host "No artifacts found. Run 'npm run tauri build' first." -ForegroundColor Red
    exit 1
}

foreach ($target in $targets) {
    Write-Host ""
    Write-Host "Signing: $target" -ForegroundColor Yellow
    & $signtool.FullName sign `
        /f  $PfxPath `
        /p  $Password `
        /fd SHA256 `
        /tr $Timestamp `
        /td SHA256 `
        /d  "AI Launcher Pro" `
        $target

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAILED" -ForegroundColor Red
    } else {
        Write-Host "  OK" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Verifying signatures..." -ForegroundColor Cyan
foreach ($target in $targets) {
    Write-Host ""
    Write-Host "Verifying: $target" -ForegroundColor Gray
    & $signtool.FullName verify /pa /v $target
}
