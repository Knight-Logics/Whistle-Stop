#Requires -Version 5.1
# Run on the host PC before leaving for a venue pitch.
# Checks local bridge, tunnel, and Vercel remoteBridge — exits 1 if Graph-critical path is down.
$ErrorActionPreference = "Continue"

$local = "http://127.0.0.1:8787/health"
$tunnel = "https://ws-social.knightlogics.com/health"
$cloud = "https://knightlogics.com/api/whistle-stop-social/health"
$admin = "https://knight-logics.github.io/Whistle-Stop/admin.html"

Write-Host ""
Write-Host "=== Whistle Stop — pre-leave health ===" -ForegroundColor Cyan
Write-Host ""

function Show-Check([bool]$Ok, [string]$Label, [string]$Detail = "") {
    if ($Ok) { Write-Host "  [OK]   $Label $(if ($Detail) { "- $Detail" })" -ForegroundColor Green }
    else { Write-Host "  [FAIL] $Label $(if ($Detail) { "- $Detail" })" -ForegroundColor Red }
}

$localOk = $false
$tunnelOk = $false
$cloudOk = $false
$remoteOk = $false
$cloudflaredOk = [bool](Get-Process -Name cloudflared -ErrorAction SilentlyContinue)

try {
    $h = Invoke-RestMethod -Uri $local -TimeoutSec 5
    $localOk = [bool]$h.ok
} catch {}

try {
    $h = Invoke-RestMethod -Uri $tunnel -TimeoutSec 12
    $tunnelOk = [bool]$h.ok
} catch {}

try {
    $h = Invoke-RestMethod -Uri $cloud -TimeoutSec 15
    $cloudOk = [bool]$h.ok
    $remoteOk = [bool]$h.remoteBridge
} catch {}

Show-Check $localOk "Local bridge :8787"
Show-Check $cloudflaredOk "cloudflared process"
Show-Check $tunnelOk "Tunnel ws-social.knightlogics.com"
Show-Check $cloudOk "Cloud API knightlogics.com"
Show-Check $remoteOk "Vercel remoteBridge (Playwright via cloud)"

Write-Host ""
Write-Host "Admin bookmark: $admin" -ForegroundColor White
Write-Host "  (not /admin/ and not /site/admin.html)" -ForegroundColor DarkGray
Write-Host ""

$graphReady = $cloudOk
$playwrightReady = $tunnelOk -or $remoteOk

if ($graphReady -and $playwrightReady) {
    Write-Host "READY — Graph + Playwright paths look good." -ForegroundColor Green
    Write-Host "Keep this PC awake (no sleep). Test Social Poster from your phone hotspot before you leave." -ForegroundColor Cyan
    exit 0
}

if ($graphReady -and -not $playwrightReady) {
    Write-Host "PARTIAL — Facebook Page / X / GBP will work from the venue." -ForegroundColor Yellow
    Write-Host "LinkedIn / Nextdoor need tunnel or START-HOST.ps1 on a reachable PC." -ForegroundColor Yellow
    Write-Host "Fix: START-HOST.ps1 or START-MAIN-PC-HOST.ps1 + ensure cloudflared is running." -ForegroundColor DarkYellow
    exit 1
}

Write-Host "NOT READY — cloud Graph path failed. Do not leave until knightlogics.com health is green." -ForegroundColor Red
Write-Host "Also run: Social\WhistleStop\deploy\ensure-bridge-running.ps1" -ForegroundColor DarkYellow
exit 1
