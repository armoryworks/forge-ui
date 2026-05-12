#
# reset-simulation-db.ps1 — Resets the database to its freshly-seeded state.
#
# Since simulation data and seed data share the same tables (customers, jobs,
# parts, etc.), the cleanest way to "remove just simulation data" is to drop
# the database entirely and let the API re-seed on startup.
#
# Usage:
#   cd forge-ui\e2e\simulation
#   .\reset-simulation-db.ps1
#

$ErrorActionPreference = "Stop"

# Find repo root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path "$ScriptDir\..\..\..\"
if (-not (Test-Path "$RepoRoot\docker-compose.yml")) {
    Write-Error "Cannot find docker-compose.yml. Run from inside the repo."
    exit 1
}

Set-Location $RepoRoot

$DbContainer = if ($env:DB_CONTAINER) { $env:DB_CONTAINER } else { "forge" }
$ApiContainer = if ($env:API_CONTAINER) { $env:API_CONTAINER } else { "forge-api" }
$DbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "forge" }
$DbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "postgres" }

Write-Host "=== Simulation DB Reset ===" -ForegroundColor Cyan
Write-Host ""

# 1. Stop API
Write-Host "1/4  Stopping API container..." -ForegroundColor Yellow
docker compose stop $ApiContainer 2>$null

# 2. Drop and recreate database
Write-Host "2/4  Dropping and recreating database '$DbName'..." -ForegroundColor Yellow
docker compose exec -T $DbContainer psql -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DbName' AND pid <> pg_backend_pid();" 2>$null | Out-Null
docker compose exec -T $DbContainer psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $DbName;"
docker compose exec -T $DbContainer psql -U $DbUser -d postgres -c "CREATE DATABASE $DbName;"
Write-Host "     Database recreated." -ForegroundColor Green

# 3. Restart API (runs migrations + seeds)
Write-Host "3/4  Starting API container (will migrate + seed)..." -ForegroundColor Yellow
docker compose up -d $ApiContainer

# 4. Wait for API health
Write-Host "4/4  Waiting for API to become healthy..." -ForegroundColor Yellow
$attempts = 0
$maxAttempts = 60
do {
    Start-Sleep -Seconds 1
    $attempts++
    try {
        $result = docker compose exec -T $ApiContainer curl -sf http://localhost:8080/health 2>$null
        if ($LASTEXITCODE -eq 0) { break }
    } catch {}
    if ($attempts -ge $maxAttempts) {
        Write-Error "API did not become healthy after ${maxAttempts}s. Check: docker compose logs -f $ApiContainer"
        exit 1
    }
} while ($true)

Write-Host ""
Write-Host "=== Done! Database reset to freshly-seeded state. ===" -ForegroundColor Green
Write-Host "    Ready to run simulation."
Write-Host ""
Write-Host "    Quick run:  `$env:SIM_START='2020-01-06'; `$env:SIM_END='2020-02-03'; `$env:SIM_MODE='range'; npx playwright test --config=e2e/simulation/playwright.simulation.config.ts"
Write-Host "    Full run:   npx playwright test --config=e2e/simulation/playwright.simulation.config.ts"
