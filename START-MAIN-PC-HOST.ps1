# Run on MAIN PC (leave on during Whistle Stop pitch)
# Starts bridge + ensures tunnel — no thumb drive needed on presentation laptop
$ErrorActionPreference = "Stop"

$GrowthDeploy = "E:\KnightLogics-Growth-System\Social\WhistleStop\deploy"
$liveAdmin = "https://whistle-stop.knightlogics.workers.dev/admin.html"

Write-Host "=== Whistle Stop - main PC host mode ===" -ForegroundColor Cyan
Write-Host "Presentation laptop: open $liveAdmin only (no scripts there)" -ForegroundColor White
Write-Host ""

if (-not (Test-Path $GrowthDeploy)) {
    Write-Error "Deploy folder not found: $GrowthDeploy"
}

# Ensure ws-social is in tunnel config (idempotent)
& (Join-Path $GrowthDeploy "add-ws-social-tunnel.ps1")

# Start bridge (hidden)
& (Join-Path $GrowthDeploy "start-bridge.ps1")

Write-Host ""
Write-Host "Checking endpoints..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

try {
    $tunnel = Invoke-RestMethod -Uri "https://ws-social.knightlogics.com/health" -TimeoutSec 20
    Write-Host "  ws-social tunnel: OK ($($tunnel.service))" -ForegroundColor Green
} catch {
    Write-Host "  ws-social tunnel: FAIL - wait 2 min for DNS, re-run this script" -ForegroundColor Red
}

try {
    $site = Invoke-RestMethod -Uri "https://whistle-stop.knightlogics.workers.dev/api/health" -TimeoutSec 20
    if ($site.ok) { Write-Host "  Website + admin (Cloudflare): OK" -ForegroundColor Green }
    else { Write-Host "  Website + admin (Cloudflare): unexpected reply" -ForegroundColor Yellow }
} catch {
    Write-Host "  Website + admin (Cloudflare): FAIL" -ForegroundColor Red
}

Write-Host ""
Write-Host "Keep this PC awake. Playwright runs VISIBLE (WS_POSTER_HEADED=1) for the pitch demo." -ForegroundColor Cyan
Write-Host "Open admin on any device: $liveAdmin" -ForegroundColor White
Write-Host ""
Write-Host "One-time (Run as Administrator) for auto-start on boot:" -ForegroundColor DarkGray
Write-Host "  cd `"$GrowthDeploy`"" -ForegroundColor DarkGray
Write-Host "  .\install-all.ps1" -ForegroundColor DarkGray
