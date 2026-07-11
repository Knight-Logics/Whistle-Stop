#Requires -Version 5.1
# Build site/downloads/whistle-stop-social-host.zip for auth-gated admin download.
$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$GrowthRoot = "E:\KnightLogics-Growth-System"
$Staging = Join-Path $RepoRoot "packaging\social-host-staging"
$OutDir = Join-Path $RepoRoot "site\downloads"
$ZipPath = Join-Path $OutDir "whistle-stop-social-host.zip"
$PkgName = "whistle-stop-social-host"

if (-not (Test-Path (Join-Path $GrowthRoot "Social\WhistleStop\bridge-server.js"))) {
    Write-Error "Growth System bridge not found at $GrowthRoot\Social\WhistleStop"
}

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
$root = Join-Path $Staging $PkgName
New-Item -ItemType Directory -Force -Path $root | Out-Null
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Launcher scripts (Whistle-Stop)
foreach ($f in @(
        "START-HOST.ps1",
        "START-PRESENTATION.ps1",
        "START-MAIN-PC-HOST.ps1",
        "PRE-LEAVE-HEALTH.ps1",
        "portable-paths.ps1"
    )) {
    $src = Join-Path $RepoRoot $f
    if (Test-Path $src) {
        Copy-Item $src (Join-Path $root $f) -Force
    }
}

# Nested Growth System paths so portable-paths finds the bridge next to the unzip folder
$bridgeDst = Join-Path $root "KnightLogics-Growth-System\Social\WhistleStop"
$socialDst = Join-Path $root "KnightLogics-Growth-System\Social"
$tunnelDst = Join-Path $root "KnightLogics-Growth-System\CRM\OutreachEngine\deploy\cloudflare-tunnel"
New-Item -ItemType Directory -Force -Path $bridgeDst | Out-Null
New-Item -ItemType Directory -Force -Path $tunnelDst | Out-Null

$bridgeSrc = Join-Path $GrowthRoot "Social\WhistleStop"
foreach ($f in @(
        "bridge-server.js",
        "demo-scope.js",
        "platforms.json",
        "run_bridge.ps1",
        "README.md"
    )) {
    $p = Join-Path $bridgeSrc $f
    if (Test-Path $p) { Copy-Item $p (Join-Path $bridgeDst $f) -Force }
}

# deploy helpers (watchdog / start)
$deploySrc = Join-Path $bridgeSrc "deploy"
if (Test-Path $deploySrc) {
    $deployDst = Join-Path $bridgeDst "deploy"
    New-Item -ItemType Directory -Force -Path $deployDst | Out-Null
    Copy-Item (Join-Path $deploySrc "*") $deployDst -Recurse -Force -ErrorAction SilentlyContinue
}

$portableEnv = Join-Path $GrowthRoot "Social\portable-env.ps1"
if (Test-Path $portableEnv) {
    Copy-Item $portableEnv (Join-Path $socialDst "portable-env.ps1") -Force
}

$tunnelSrc = Join-Path $GrowthRoot "CRM\OutreachEngine\deploy\cloudflare-tunnel"
foreach ($f in @("run-tunnel.ps1", "setup-tunnel.ps1", "README.md", "config.template.yml")) {
    $p = Join-Path $tunnelSrc $f
    if (Test-Path $p) { Copy-Item $p (Join-Path $tunnelDst $f) -Force }
}

@'
WHISTLE STOP — SOCIAL HOST PACKAGE
==================================

Who this is for
  Staff with owner or editor access in the Whistle Stop admin.
  You were prompted to download this because a Playwright host was not detected.

What you get without this package (cloud only)
  - Facebook Page
  - X (Twitter)
  - Google Business Profile

What this package enables (Playwright on THIS PC)
  - LinkedIn
  - Nextdoor
  - Facebook community groups

Quick start
  1. Unzip anywhere (e.g. Desktop\whistle-stop-social-host)
  2. Right-click START-HOST.ps1 → Run with PowerShell
     (If blocked: Unblock-File .\START-HOST.ps1)
  3. Keep the bridge + tunnel windows open and the PC awake
  4. On any device open:
     https://knight-logics.github.io/Whistle-Stop/admin.html
     Sign in → Social Poster → post

Requirements
  - Windows + PowerShell
  - Node.js (or portable node from Growth System tools if present)
  - cloudflared installed for the public tunnel (ws-social.knightlogics.com)
  - Playwright browsers for LinkedIn/Nextdoor (install once via Growth System / npx playwright)

Notes
  - Demo posts target Knight Logics accounts ONLY
  - Graph platforms do not need this package
  - Before a venue pitch, run PRE-LEAVE-HEALTH.ps1 on the host PC

Admin bookmark (correct URL)
  https://knight-logics.github.io/Whistle-Stop/admin.html
  (not /admin/ and not /site/admin.html)
'@ | Set-Content -Path (Join-Path $root "README.txt") -Encoding UTF8

# Rewrite START-HOST inside package to prefer nested Growth System
@'
# Whistle Stop Social Host — packaged launcher
$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$nestedGrowth = Join-Path $here "KnightLogics-Growth-System"
if (Test-Path (Join-Path $nestedGrowth "Social\WhistleStop\run_bridge.ps1")) {
    $env:KL_GROWTH_ROOT = $nestedGrowth
}

Write-Host ""
Write-Host "=== Whistle Stop Social Host (package) ===" -ForegroundColor Cyan
Write-Host "Unzipped at: $here" -ForegroundColor DarkGray
Write-Host "Growth root: $env:KL_GROWTH_ROOT" -ForegroundColor DarkGray
Write-Host "Admin: https://knight-logics.github.io/Whistle-Stop/admin.html" -ForegroundColor DarkGray
Write-Host ""

$presentation = Join-Path $here "START-PRESENTATION.ps1"
if (-not (Test-Path $presentation)) {
    Write-Host "Missing START-PRESENTATION.ps1 in this package." -ForegroundColor Red
    exit 1
}
& $presentation @args
'@ | Set-Content -Path (Join-Path $root "START-HOST.ps1") -Encoding UTF8

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path $root -DestinationPath $ZipPath -Force

$mb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host "Built $ZipPath ($mb MB)" -ForegroundColor Green
Write-Host "Staging kept at $Staging (safe to delete)" -ForegroundColor DarkGray
