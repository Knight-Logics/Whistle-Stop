# Resolve Knight Logics + Whistle Stop paths on any drive (flash drive = D:, desktop = E:, etc.)
function Get-KnightLogicsRoots {
    param(
        [string]$ScriptRoot = $PSScriptRoot
    )

    if ($env:KL_GROWTH_ROOT -and (Test-Path (Join-Path $env:KL_GROWTH_ROOT "Social\WhistleStop\run_bridge.ps1"))) {
        $growth = (Resolve-Path $env:KL_GROWTH_ROOT).Path
    }
    else {
        $candidates = @(
            (Join-Path (Split-Path $ScriptRoot -Parent) "KnightLogics-Growth-System")
            (Join-Path $ScriptRoot "KnightLogics-Growth-System")
        )
        foreach ($drive in Get-PSDrive -PSProvider FileSystem | Sort-Object Name) {
            $candidates += Join-Path "$($drive.Name):\" "KnightLogics-Growth-System"
        }
        $growth = $null
        foreach ($c in ($candidates | Select-Object -Unique)) {
            if (Test-Path (Join-Path $c "Social\WhistleStop\run_bridge.ps1")) {
                $growth = (Resolve-Path $c).Path
                break
            }
        }
    }

    if (-not $growth) {
        throw @"
KnightLogics-Growth-System not found. Expected Social\WhistleStop\run_bridge.ps1 on the flash drive.
Plug in the drive (e.g. D:) or set env:KL_GROWTH_ROOT to the Growth System folder.
"@
    }

    $bridge = Join-Path $growth "Social\WhistleStop"
    $tunnel = Join-Path $growth "CRM\OutreachEngine\deploy\cloudflare-tunnel\run-tunnel.ps1"
    $tunnelSetup = Join-Path $growth "CRM\OutreachEngine\deploy\cloudflare-tunnel\setup-tunnel.ps1"
    $logPath = Join-Path $bridge "logs\bridge.log"

    $repo = $ScriptRoot
    if (-not (Test-Path (Join-Path $repo "START-PRESENTATION.ps1"))) {
        $alt = Join-Path (Split-Path $growth -Parent) "Whistle-Stop"
        if (Test-Path (Join-Path $alt "START-PRESENTATION.ps1")) {
            $repo = (Resolve-Path $alt).Path
        }
    }

    return [ordered]@{
        GrowthRoot    = $growth
        BridgeRoot    = $bridge
        TunnelScript  = $tunnel
        TunnelSetup   = $tunnelSetup
        LogPath       = $logPath
        RepoRoot      = $repo
        DriveLetter   = $growth.Substring(0, 1)
    }
}
