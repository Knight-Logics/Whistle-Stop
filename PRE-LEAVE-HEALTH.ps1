#Requires -Version 5.1
# Run on the host PC before leaving for a venue pitch.
# Checks local bridge, full five-platform tunnel preflight, and the Cloudflare website/admin.
$ErrorActionPreference = "Continue"

$local = "http://127.0.0.1:8787/health"
$tunnel = "https://ws-social.knightlogics.com/health"
$site = "https://whistle-stop.knightlogics.workers.dev/api/health"
$admin = "https://whistle-stop.knightlogics.workers.dev/admin.html"

Write-Host ""
Write-Host "=== Whistle Stop - pre-leave health ===" -ForegroundColor Cyan
Write-Host ""

function Show-Check([bool]$Ok, [string]$Label, [string]$Detail = "") {
    if ($Ok) { Write-Host "  [OK]   $Label $(if ($Detail) { "- $Detail" })" -ForegroundColor Green }
    else { Write-Host "  [FAIL] $Label $(if ($Detail) { "- $Detail" })" -ForegroundColor Red }
}

$localOk = $false
$tunnelOk = $false
$siteOk = $false
$fullDemoOk = $false
$cloudflaredOk = [bool](Get-Process -Name cloudflared -ErrorAction SilentlyContinue)

try {
    $h = Invoke-RestMethod -Uri $local -TimeoutSec 5
    $localOk = [bool]$h.ok
} catch {}

try {
    $h = Invoke-RestMethod -Uri "https://ws-social.knightlogics.com/api/preflight" -TimeoutSec 30
    $tunnelOk = [bool]$h.ok
    $fullDemoOk = [bool]$h.readyForFullLiveTest
} catch {}

try {
    $h = Invoke-RestMethod -Uri $site -TimeoutSec 15
    $siteOk = [bool]$h.ok
} catch {}

Show-Check $localOk "Local bridge :8787"
Show-Check $cloudflaredOk "cloudflared process"
Show-Check $tunnelOk "Tunnel ws-social.knightlogics.com"
Show-Check $siteOk "Website + admin (Cloudflare)"
Show-Check $fullDemoOk "All five Knight Logics demo sessions"

Write-Host ""
Write-Host "Admin bookmark: $admin" -ForegroundColor White
Write-Host ""

$siteReady = $siteOk
$playwrightReady = $tunnelOk -and $fullDemoOk

if ($siteReady -and $playwrightReady) {
    Write-Host "READY - Facebook, X, LinkedIn, GBP, and Nextdoor all passed." -ForegroundColor Green
    Write-Host "Keep this PC awake (no sleep). Test Social Poster from your phone hotspot before you leave." -ForegroundColor Cyan
    exit 0
}

if ($siteReady -and -not $playwrightReady) {
    Write-Host "PARTIAL - website and admin are fine; social posting needs the Social Host." -ForegroundColor Yellow
    Write-Host "Facebook, X, LinkedIn, Nextdoor and GBP all post through this PC's bridge + tunnel." -ForegroundColor Yellow
    Write-Host "Fix: START-HOST.ps1 or START-MAIN-PC-HOST.ps1 + ensure cloudflared is running." -ForegroundColor DarkYellow
    exit 1
}

Write-Host "NOT READY - the Cloudflare site did not answer. Check https://whistle-stop.knightlogics.workers.dev in a browser." -ForegroundColor Red
Write-Host "Also run: Social\WhistleStop\deploy\ensure-bridge-running.ps1" -ForegroundColor DarkYellow
exit 1
