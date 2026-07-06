# Whistle Stop — preflight (flash drive or desktop)
param([switch]$Strict)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "portable-paths.ps1")
try {
    $roots = Get-KnightLogicsRoots -ScriptRoot $PSScriptRoot
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

$bridgePort = 8787
$cloudApi = "https://knightlogics.com/api/whistle-stop-social"
$localBridge = "http://127.0.0.1:$bridgePort"
$tunnelUrl = "https://ws-social.knightlogics.com"
$logPath = $roots.LogPath
$allowedAccounts = @("fb_kl", "x_kl", "gbp_kl", "li_kl", "nd_kl")

function Test-Step {
    param([string]$Label, [scriptblock]$Check)
    Write-Host ""
    Write-Host "== $Label ==" -ForegroundColor Cyan
    try {
        $result = & $Check
        if ($result.Ok) {
            Write-Host "  PASS  $($result.Detail)" -ForegroundColor Green
            return $true
        }
        Write-Host "  FAIL  $($result.Detail)" -ForegroundColor Red
        return $false
    } catch {
        Write-Host "  FAIL  $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

Write-Host "=== Whistle Stop Social Preflight ===" -ForegroundColor White
Write-Host "Growth System: $($roots.GrowthRoot)" -ForegroundColor DarkGray
Write-Host "Knight Logics ONLY: $($allowedAccounts -join ', ')" -ForegroundColor DarkGray

$results = @()

$results += Test-Step "Local bridge" {
    $r = Invoke-RestMethod -Uri "$localBridge/health" -TimeoutSec 5
    if ($r.ok) { return @{ Ok = $true; Detail = $r.service } }
    @{ Ok = $false; Detail = "not ok" }
}

$results += Test-Step "Local preflight API" {
    $p = Invoke-RestMethod -Uri "$localBridge/api/preflight" -TimeoutSec 30
    if ($p.demoScope -eq "knight_logics_only") {
        return @{ Ok = $true; Detail = "fbMode=$($p.facebookMode) ready=$($p.readyForLiveTest)" }
    }
    @{ Ok = $false; Detail = "scope=$($p.demoScope)" }
}

$results += Test-Step "Tunnel ($tunnelUrl)" {
    $r = Invoke-RestMethod -Uri "$tunnelUrl/health" -TimeoutSec 12
    if ($r.ok) { return @{ Ok = $true; Detail = "reachable" } }
    @{ Ok = $false; Detail = "health failed" }
}

$results += Test-Step "Cloud health" {
    $h = Invoke-RestMethod -Uri "$cloudApi/health" -TimeoutSec 15
    if ($h.ok) { return @{ Ok = $true; Detail = "remoteBridge=$($h.remoteBridge)" } }
    @{ Ok = $false; Detail = "down" }
}

$results += Test-Step "Cloud preflight" {
    $p = Invoke-RestMethod -Uri "$cloudApi/preflight" -TimeoutSec 20
    @{ Ok = ($p.demoScope -eq "knight_logics_only"); Detail = "fullLive=$($p.readyForFullLiveTest) tunnel=$($p.tunnelOnline)" }
}

$results += Test-Step "Bridge log" {
    if (Test-Path $logPath) { return @{ Ok = $true; Detail = $logPath } }
    @{ Ok = $false; Detail = "missing" }
}

$passed = @($results | Where-Object { $_ }).Count
$failed = @($results | Where-Object { -not $_ }).Count
Write-Host ""
Write-Host "=== $passed passed, $failed failed ===" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
if ($Strict -and $failed -gt 0) { exit 1 }
if ($failed -gt 0) { exit 1 }
exit 0
