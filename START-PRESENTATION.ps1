# Whistle Stop LIVE presentation — works from flash drive (D:) or desktop (E:)
# MAIN PC HOST (recommended): run START-MAIN-PC-HOST.ps1 on always-on PC; laptop = browser only.
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "portable-paths.ps1")
$roots = Get-KnightLogicsRoots -ScriptRoot $PSScriptRoot

$bridgeRoot = $roots.BridgeRoot
$tunnelScript = $roots.TunnelScript
$tunnelSetup = $roots.TunnelSetup
$repoRoot = $roots.RepoRoot
$liveAdmin = "https://knight-logics.github.io/Whistle-Stop/admin.html"
$bridgePort = 8787
$localBridge = "http://127.0.0.1:$bridgePort"
$tunnelUrl = "https://ws-social.knightlogics.com"
$cloudHealth = "https://knightlogics.com/api/whistle-stop-social/health"

$env:KL_GROWTH_ROOT = $roots.GrowthRoot
$env:WS_ADMIN_PASSWORD_HASH = "400c226817e7e87a668c1988b211de97430bf1560be7e57a5c0577a6c76c5065"
if (-not $env:PLAYWRIGHT_BROWSERS_PATH) {
    $portableBrowsers = Join-Path $roots.GrowthRoot "Social\tools\ms-playwright"
    $userBrowsers = Join-Path $env:USERPROFILE "AppData\Local\ms-playwright"
    if (Test-Path $portableBrowsers) { $env:PLAYWRIGHT_BROWSERS_PATH = $portableBrowsers }
    elseif (Test-Path $userBrowsers) { $env:PLAYWRIGHT_BROWSERS_PATH = $userBrowsers }
}

function Test-PortInUse([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)
}

function Test-Internet {
    try {
        $null = Invoke-RestMethod -Uri $cloudHealth -TimeoutSec 12
        return $true
    } catch {
        return $false
    }
}

function Wait-ForUrl([string]$Label, [scriptblock]$Try, [int]$MaxSeconds = 90) {
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            if (& $Try) {
                Write-Host "  OK    $Label" -ForegroundColor Green
                return $true
            }
        } catch { }
        Write-Host "  ...   waiting for $Label" -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
    Write-Host "  FAIL  $Label (timed out after ${MaxSeconds}s)" -ForegroundColor Red
    return $false
}

Write-Host ""
Write-Host "=== Whistle Stop — live presentation ===" -ForegroundColor Cyan
Write-Host "Growth System: $($roots.GrowthRoot)" -ForegroundColor DarkGray
Write-Host "Drive:         $($roots.DriveLetter):" -ForegroundColor DarkGray
Write-Host ""
Write-Host "TWO layers: [1] Cloud API (knightlogics.com)  [2] This PC bridge + tunnel (Playwright)" -ForegroundColor White
Write-Host ""

if (-not (Test-Internet)) {
    Write-Host "No internet. Connect to WiFi first." -ForegroundColor Red
    exit 1
}
Write-Host "Internet: OK" -ForegroundColor Green

if (-not (Test-Path (Join-Path $bridgeRoot "run_bridge.ps1"))) {
    Write-Host "Bridge missing at $bridgeRoot — run SYNC-TO-FLASH.ps1 on your main PC first." -ForegroundColor Red
    exit 1
}

if (-not (Test-PortInUse $bridgePort)) {
    Write-Host ""
    Write-Host "Starting local bridge on port $bridgePort..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
`$env:KL_GROWTH_ROOT = '$($roots.GrowthRoot)'
`$env:WS_ADMIN_PASSWORD_HASH = '$($env:WS_ADMIN_PASSWORD_HASH)'
Set-Location '$bridgeRoot'
.\run_bridge.ps1
"@ -WorkingDirectory $bridgeRoot
} else {
    Write-Host ""
    Write-Host "Bridge port $bridgePort already in use." -ForegroundColor Yellow
}

if (Test-Path $tunnelScript) {
    Write-Host "Starting Cloudflare tunnel..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-File", $tunnelScript
} else {
    Write-Host "Tunnel script missing: $tunnelScript" -ForegroundColor Yellow
    Write-Host "Run SYNC-TO-FLASH.ps1 on main PC, or install cloudflared + config on this laptop." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Waiting for services..." -ForegroundColor Cyan

$localOk = Wait-ForUrl "Local bridge" {
    $h = Invoke-RestMethod -Uri "$localBridge/health" -TimeoutSec 5
    [bool]$h.ok
}

$tunnelOk = $false
if (Test-Path $tunnelScript) {
    $tunnelOk = Wait-ForUrl "Tunnel ($tunnelUrl)" {
        $h = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 10
        [bool]$h.ok
    } -MaxSeconds 120
}

$cloudOk = Wait-ForUrl "Cloud sees this PC (remoteBridge=true)" {
    $h = Invoke-RestMethod -Uri $cloudHealth -TimeoutSec 15
    [bool]$h.remoteBridge
} -MaxSeconds 60

Write-Host ""
Write-Host "========== STATUS ==========" -ForegroundColor White
function Show-Light($ok, $label) {
    if ($ok) { Write-Host "  [GREEN]  $label" -ForegroundColor Green }
    else { Write-Host "  [RED]    $label" -ForegroundColor Red }
}
Show-Light $true "Cloud API"
Show-Light $localOk "Local bridge (:8787)"
Show-Light $tunnelOk "Tunnel (ws-social)"
Show-Light $cloudOk "Full poster linked"
Write-Host "============================" -ForegroundColor White

if (-not $tunnelOk) {
    Write-Host ""
    Write-Host "Tunnel fix (once per laptop): cloudflared + DNS for ws-social.knightlogics.com" -ForegroundColor Yellow
    if (Test-Path $tunnelSetup) {
        Write-Host "  cd $(Split-Path $tunnelSetup -Parent)" -ForegroundColor DarkGray
        Write-Host "  .\setup-tunnel.ps1 -RouteDns" -ForegroundColor DarkGray
    }
}

if ($localOk -and $tunnelOk -and $cloudOk) {
    Write-Host ""
    Write-Host "FULL POSTER READY" -ForegroundColor Green
    & (Join-Path $repoRoot "TEST-SOCIAL-PREFLIGHT.ps1")
} elseif ($localOk) {
    Write-Host ""
    Write-Host "PARTIAL — FB/X/GBP via cloud only until tunnel is green." -ForegroundColor Yellow
}

Start-Process $liveAdmin
Write-Host ""
Write-Host "Admin: $liveAdmin  |  Login: whistlestop2026" -ForegroundColor Cyan
Write-Host "Logs:  $($roots.LogPath)" -ForegroundColor DarkGray
Write-Host "Keep bridge + tunnel windows open during the pitch." -ForegroundColor White
Write-Host ""

if (-not ($localOk -and $tunnelOk -and $cloudOk)) { exit 1 }
