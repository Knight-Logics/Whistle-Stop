# Whistle Stop - preflight (flash drive or desktop)
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
$allowedPlatforms = @("facebook", "x", "linkedin", "gbp", "nextdoor")

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
    $readyAccounts = @($p.checks | Where-Object { $_.accountId -and $_.ok }).Count
    if ($p.demoScope -eq "knight_logics_only" -and $p.readyForFullLiveTest -and $readyAccounts -eq 5) {
        return @{ Ok = $true; Detail = "all five sessions ready; fbMode=$($p.facebookMode)" }
    }
    @{ Ok = $false; Detail = "scope=$($p.demoScope) fullLive=$($p.readyForFullLiveTest) readyAccounts=$readyAccounts/5" }
}

$results += Test-Step "Tunnel ($tunnelUrl)" {
    $p = Invoke-RestMethod -Uri "$tunnelUrl/api/preflight" -TimeoutSec 30
    if ($p.readyForFullLiveTest) { return @{ Ok = $true; Detail = "reachable; all five sessions ready" } }
    @{ Ok = $false; Detail = "reachable but full five-platform preflight failed" }
}

$results += Test-Step "Cloud health" {
    $h = Invoke-RestMethod -Uri "${cloudApi}?route=health" -TimeoutSec 15
    if ($h.ok) { return @{ Ok = $true; Detail = "Facebook=$($h.facebook) X=$($h.x) fallback ready" } }
    @{ Ok = $false; Detail = "down" }
}

$results += Test-Step "Five-platform dry run (no post)" {
    $platforms = $allowedPlatforms -join ","
    $p = Invoke-RestMethod -Uri "$tunnelUrl/api/dry-run?platforms=$platforms" -TimeoutSec 45
    $readyChecks = @($p.checks | Where-Object { $_.ok }).Count
    $targetCount = @($p.targets).Count
    @{ Ok = ($p.ok -and $p.dryRun -and $readyChecks -eq 5 -and $targetCount -eq 5); Detail = "ready=$readyChecks/5 targets=$targetCount noPost=$($p.dryRun)" }
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
