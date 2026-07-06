# Run on MAIN PC (leave on during Whistle Stop pitch)
# Starts bridge + ensures tunnel — no thumb drive needed on presentation laptop
$ErrorActionPreference = "Stop"

$GrowthDeploy = "E:\KnightLogics-Growth-System\Social\WhistleStop\deploy"
$liveAdmin = "https://knight-logics.github.io/Whistle-Stop/admin.html"

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
    $cloud = Invoke-RestMethod -Uri "https://knightlogics.com/api/whistle-stop-social/health" -TimeoutSec 20
    if ($cloud.remoteBridge) {
        Write-Host "  Vercel sees bridge: OK (full poster from any device)" -ForegroundColor Green
    } else {
        Write-Host "  Vercel sees bridge: waiting (DNS may need 5-15 min after first setup)" -ForegroundColor Yellow
        Write-Host "  ws-social works locally? If yes, cloud will catch up shortly." -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  Cloud health: FAIL" -ForegroundColor Red
}

Write-Host ""
Write-Host "Keep this PC awake. Playwright runs VISIBLE (WS_POSTER_HEADED=1) for the pitch demo." -ForegroundColor Cyan
Write-Host "Open admin on any device: $liveAdmin" -ForegroundColor White
Write-Host ""
Write-Host "One-time (Run as Administrator) for auto-start on boot:" -ForegroundColor DarkGray
Write-Host "  cd `"$GrowthDeploy`"" -ForegroundColor DarkGray
Write-Host "  .\install-all.ps1" -ForegroundColor DarkGray
