# gen-cert.ps1 - Generate a self-signed code-signing cert for local builds.
# Usage: PS> .\scripts\gen-cert.ps1 [-Subject "CN=Your Name"] [-Password "your-password"]
# Output: scripts/certs/ai-launcher.pfx + thumbprint printed
#
# What it does:
#   1. Creates self-signed cert valid for 3 years in CurrentUser\My
#   2. Exports password-protected PFX (scripts/certs/ai-launcher.pfx)
#   3. Exports public .cer (scripts/certs/ai-launcher.cer)
#   4. Installs the .cer into Trusted Root Certification Authorities (CurrentUser)
#   5. Prints Thumbprint (copy to tauri.conf.json > bundle.windows.certificateThumbprint)
#
# After running: Windows Defender and SmartScreen will trust binaries signed
# with this cert on THIS machine only. For distribution to other PCs use a
# real CA cert (Sectigo, DigiCert, SSL.com, Azure Trusted Signing, ...).

[CmdletBinding()]
param(
    [string]$Subject      = "CN=AI Launcher Dev, O=AI Launcher, C=US",
    [string]$FriendlyName = "AI Launcher Code Signing",
    [string]$Password     = "ailauncher-dev",
    [string]$OutDir       = "",
    [int]   $YearsValid   = 3
)

$ErrorActionPreference = "Stop"

# Resolve script root (fallback chain for different invocation contexts)
$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path -ErrorAction SilentlyContinue }
if (-not $scriptRoot) { $scriptRoot = (Get-Location).Path }
if (-not $OutDir) { $OutDir = Join-Path $scriptRoot "certs" }

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

$pfxPath = Join-Path $OutDir "ai-launcher.pfx"
$cerPath = Join-Path $OutDir "ai-launcher.cer"

Write-Host "=== AI Launcher - Self-Signed Code Signing Cert ===" -ForegroundColor Cyan
Write-Host ""

# 1) Create cert
Write-Host "[1/4] Generating certificate..." -ForegroundColor Yellow
$cert = New-SelfSignedCertificate `
    -Type            CodeSigningCert `
    -Subject         $Subject `
    -FriendlyName    $FriendlyName `
    -KeyUsage        DigitalSignature `
    -KeyAlgorithm    RSA `
    -KeyLength       4096 `
    -HashAlgorithm   SHA256 `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter        (Get-Date).AddYears($YearsValid) `
    -TextExtension   @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

Write-Host "    Thumbprint: $($cert.Thumbprint)" -ForegroundColor Green

# 2) Export PFX
Write-Host "[2/4] Exporting PFX..." -ForegroundColor Yellow
$securePwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate `
    -Cert     "Cert:\CurrentUser\My\$($cert.Thumbprint)" `
    -FilePath $pfxPath `
    -Password $securePwd | Out-Null
Write-Host "    PFX saved to: $pfxPath" -ForegroundColor Green

# 3) Export .cer (public)
Write-Host "[3/4] Exporting public .cer..." -ForegroundColor Yellow
Export-Certificate `
    -Cert     "Cert:\CurrentUser\My\$($cert.Thumbprint)" `
    -FilePath $cerPath `
    -Type     CERT | Out-Null
Write-Host "    .cer saved to: $cerPath" -ForegroundColor Green

# 4) Install into Trusted Root (CurrentUser - no admin required)
Write-Host "[4/4] Installing into Trusted Root Certification Authorities..." -ForegroundColor Yellow
Import-Certificate `
    -FilePath         $cerPath `
    -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
Write-Host "    Installed in Cert:\CurrentUser\Root" -ForegroundColor Green

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Thumbprint (copy to tauri.conf.json):" -ForegroundColor White
Write-Host "  $($cert.Thumbprint)" -ForegroundColor Yellow
Write-Host ""
Write-Host "To use in build, set env vars:" -ForegroundColor White
Write-Host "  `$env:TAURI_SIGNING_PRIVATE_KEY = '$pfxPath'" -ForegroundColor Yellow
Write-Host "  `$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '$Password'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Or use signtool after the build (scripts/sign-build.ps1)." -ForegroundColor White
Write-Host ""
Write-Host "IMPORTANT: this cert works ONLY on this machine." -ForegroundColor Red
Write-Host "For distribution, end users need to import the .cer" -ForegroundColor Red
Write-Host "into Cert:\CurrentUser\Root, OR you need a real paid cert." -ForegroundColor Red
