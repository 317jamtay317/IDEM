<#
.SYNOPSIS
    Stops this worktree's RecordKeeping docker-compose stack.

.DESCRIPTION
    Thin wrapper over `docker compose down`, run from the repo root so it targets the same
    stack scripts/up.ps1 started (the feature name persisted in .env as COMPOSE_PROJECT_NAME).
    Extra arguments are forwarded verbatim.

.PARAMETER ComposeArgs
    Extra arguments forwarded to `docker compose down` (e.g. `-v` to also drop the SQL volume).

.EXAMPLE
    ./scripts/down.ps1
    Stops and removes the stack's containers and network.

.EXAMPLE
    ./scripts/down.ps1 -v
    Same, and also removes the SQL data volume (wipes the local database).
#>
[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ComposeArgs = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location (Split-Path -Parent $PSScriptRoot)

docker compose down @ComposeArgs

if ($LASTEXITCODE -ne 0) {
    throw "docker compose down failed with exit code $LASTEXITCODE."
}
