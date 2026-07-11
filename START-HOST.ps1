# Whistle Stop Social Host — run on any Windows PC that stays awake
# Starts local bridge + Cloudflare tunnel (Playwright for LinkedIn / Nextdoor / FB groups).
# Graph platforms (Facebook Page, X, GBP) do NOT need this — they use knightlogics.com.
#
# Usage (from Whistle-Stop repo root):
#   .\START-HOST.ps1
#
# Or double-click after unblocking: Right-click → Run with PowerShell
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$presentation = Join-Path $here "START-PRESENTATION.ps1"
$mainHost = Join-Path $here "START-MAIN-PC-HOST.ps1"

Write-Host ""
Write-Host "=== Whistle Stop Social Host ===" -ForegroundColor Cyan
Write-Host "This PC becomes the Playwright host for LinkedIn / Nextdoor / FB groups." -ForegroundColor White
Write-Host "Keep this machine awake and the bridge/tunnel windows open." -ForegroundColor DarkGray
Write-Host "Admin (any device): https://knight-logics.github.io/Whistle-Stop/admin.html" -ForegroundColor DarkGray
Write-Host ""

if (Test-Path $mainHost) {
    Write-Host "Prefer always-on main PC? Use START-MAIN-PC-HOST.ps1 once, then Task Scheduler." -ForegroundColor Yellow
}

if (-not (Test-Path $presentation)) {
    Write-Host "Missing START-PRESENTATION.ps1 next to this script." -ForegroundColor Red
    Write-Host "Clone or sync the Whistle-Stop repo (and Growth System for Playwright)." -ForegroundColor Red
    exit 1
}

& $presentation @args
