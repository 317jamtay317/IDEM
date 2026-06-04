<#
.SYNOPSIS
    Launches the RecordKeeping docker-compose stack on the first free host ports, so several
    stacks (e.g. one per git worktree) can run side by side without colliding.

.DESCRIPTION
    Probes for the first free host port at or above each default - api 8443, mcp 8444,
    sql 14333 - and exports them as API_HOST_PORT / MCP_HOST_PORT / SQL_HOST_PORT before
    running `docker compose up -d --build`. The stack is named after the feature - -Name if
    given, else the current git branch's last segment (e.g. claude/facility-licenses ->
    facility-licenses), else the worktree directory - so every container is named
    <feature>-api-1, <feature>-mcp-1, and so on. That name is written to .env, so plain
    `docker compose` commands in this folder (ps, logs, down) target the same stack.

    The chosen app + MCP URLs are printed at the end. Manage the running stack with plain
    compose commands from this folder, e.g. `docker compose ps`, `docker compose logs api`,
    or `scripts/down.ps1`.

.PARAMETER Name
    Explicit feature/stack name; becomes the container-name prefix. Defaults to the current
    git branch's last segment, then the worktree directory name.

.PARAMETER SkipBuild
    Skip the image rebuild (`docker compose up -d` without `--build`) for a faster inner loop.

.PARAMETER ComposeArgs
    Extra arguments forwarded verbatim to `docker compose up` (e.g. a single service name).

.EXAMPLE
    ./scripts/up.ps1
    Brings the whole stack up on the first free ports and prints the URLs.

.EXAMPLE
    ./scripts/up.ps1 -SkipBuild
    Same, but reuses the existing image instead of rebuilding.

.EXAMPLE
    ./scripts/up.ps1 -Name facility-licenses
    Names the stack 'facility-licenses' (containers facility-licenses-api-1, -mcp-1, ...).
#>
[CmdletBinding()]
param(
    [string]$Name,

    [switch]$SkipBuild,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Run from the repo root (this script lives in ./scripts) so docker compose finds the compose
# file and derives the project name from the worktree directory rather than from ./scripts.
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function ConvertTo-ComposeName {
    # Normalise an arbitrary string into a valid Docker Compose project name: lowercase,
    # only [a-z0-9_-], with a leading letter/digit. Empty input falls back to 'recordkeeping'.
    param([string]$Raw)

    $name = ($Raw.ToLowerInvariant() -replace '[^a-z0-9_-]', '-').TrimStart('-', '_')
    if ([string]::IsNullOrWhiteSpace($name)) { $name = 'recordkeeping' }
    return $name
}

function Resolve-FeatureName {
    # The stack/container name. Priority: explicit -Name, else the current git branch's last
    # segment (the feature), else the worktree directory name.
    param([string]$Explicit)

    if (-not [string]::IsNullOrWhiteSpace($Explicit)) {
        return (ConvertTo-ComposeName $Explicit)
    }

    $branch = $null
    try { $branch = (git rev-parse --abbrev-ref HEAD 2>$null) } catch { }
    if ($branch -and $branch -ne 'HEAD') {
        return (ConvertTo-ComposeName (($branch.Trim() -split '/')[-1]))
    }

    return (ConvertTo-ComposeName (Split-Path -Leaf $repoRoot))
}

function Set-EnvFileVar {
    # Idempotently set KEY=VALUE in a .env file, preserving every other line (so a local .env
    # holding SA_PASSWORD etc. is left intact). Written ASCII/no-BOM so compose parses it.
    param([string]$Path, [string]$Key, [string]$Value)

    # @(...) forces an array even when the file has a single kept line; without it a scalar
    # string would make the '+' below concatenate text instead of appending a line.
    $kept = @()
    if (Test-Path $Path) {
        $kept = @(Get-Content $Path | Where-Object { $_ -notmatch "^\s*$([regex]::Escape($Key))\s*=" })
    }
    (@($kept) + "$Key=$Value") | Set-Content -Path $Path -Encoding ascii
}

function Test-HostPortFree {
    # True if the host can bind the port on every interface. Docker publishes on 0.0.0.0 by
    # default, so a port already published by another stack fails to bind here and reads as
    # in-use - exactly what we want to skip over.
    param([int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) { $listener.Stop() }
    }
}

function Get-FreeHostPort {
    # First free host port at or above $Start, skipping any already claimed in this run.
    param(
        [int]$Start,
        [int[]]$Exclude = @()
    )

    for ($port = $Start; $port -le $Start + 500; $port++) {
        if ($Exclude -notcontains $port -and (Test-HostPortFree -Port $port)) {
            return $port
        }
    }
    throw "No free host port found in [$Start, $($Start + 500)]. Are too many stacks running?"
}

function Get-DockerPublishedPorts {
    # Host ports already published by ANY running container (this or another worktree's stack).
    # Docker Desktop on Windows forwards published ports via its WSL2/Hyper-V backend, so a plain
    # TcpListener bind can still succeed on a port Docker is already using - the host-bind probe
    # alone would hand out a colliding port. Parse the real published ports from `docker ps`.
    $taken = New-Object 'System.Collections.Generic.HashSet[int]'
    $lines = @()
    try { $lines = docker ps --format '{{.Ports}}' } catch { $lines = @() }
    foreach ($line in $lines) {
        foreach ($match in [regex]::Matches([string]$line, ':(\d+)->')) {
            [void]$taken.Add([int]$match.Groups[1].Value)
        }
    }
    return $taken
}

# Name the stack (and therefore every container: <name>-api-1, <name>-mcp-1, ...) after the
# feature. Persisted to .env so plain `docker compose` commands in this folder target it too.
$featureName = Resolve-FeatureName -Explicit $Name
Set-EnvFileVar -Path (Join-Path $repoRoot '.env') -Key 'COMPOSE_PROJECT_NAME' -Value $featureName
$env:COMPOSE_PROJECT_NAME = $featureName

# Ports already published by other running stacks (including other worktrees); excluded on top
# of the per-port host-bind probe so concurrent stacks never collide.
$takenPorts = @(Get-DockerPublishedPorts)

$apiPort = Get-FreeHostPort -Start 8443 -Exclude $takenPorts
$mcpPort = Get-FreeHostPort -Start ([Math]::Max(8444, $apiPort + 1)) -Exclude (@($apiPort) + $takenPorts)
$sqlPort = Get-FreeHostPort -Start 14333 -Exclude (@($apiPort, $mcpPort) + $takenPorts)

$env:API_HOST_PORT = "$apiPort"
$env:MCP_HOST_PORT = "$mcpPort"
$env:SQL_HOST_PORT = "$sqlPort"

Write-Host ""
Write-Host "Starting RecordKeeping stack '$featureName' (containers $featureName-api-1, -mcp-1, ...) on free ports:" -ForegroundColor Cyan
Write-Host "  app : https://localhost:$apiPort        (API_HOST_PORT)"
Write-Host "  mcp : https://localhost:$mcpPort/mcp     (MCP_HOST_PORT)"
Write-Host "  sql : localhost,$sqlPort               (SQL_HOST_PORT, host tools only)"
Write-Host ""

$composeArgsList = @('up', '-d')
if (-not $SkipBuild) {
    $composeArgsList += '--build'
}
$composeArgsList += $ComposeArgs

docker compose @composeArgsList

if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed with exit code $LASTEXITCODE."
}

Write-Host ""
Write-Host "Stack is up. Open the app:" -ForegroundColor Green
Write-Host "  https://localhost:$apiPort" -ForegroundColor Green
Write-Host "MCP endpoint for AI agents:" -ForegroundColor Green
Write-Host "  https://localhost:$mcpPort/mcp" -ForegroundColor Green
Write-Host ""
Write-Host "Manage it from this folder: docker compose ps | docker compose logs <service> | scripts/down.ps1" -ForegroundColor DarkGray
