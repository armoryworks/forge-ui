#!/usr/bin/env bash
#
# reset-simulation-db.sh — Resets the database to its freshly-seeded state.
#
# Since simulation data and seed data share the same tables (customers, jobs,
# parts, etc.), the cleanest way to "remove just simulation data" is to drop
# the database entirely and let the API re-seed on startup.
#
# Usage:
#   cd forge-ui/e2e/simulation
#   bash reset-simulation-db.sh
#
# What it does:
#   1. Stops the API container (so nothing writes during reset)
#   2. Drops and recreates the forge database
#   3. Restarts the API container (which auto-runs migrations + seeds)
#   4. Waits for the API to become healthy
#
# Prerequisites:
#   - Docker Compose stack running (at least db container)
#   - Run from anywhere inside the forge-wrapper repo

set -euo pipefail

# Find repo root (walk up until we find docker-compose.yml)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR/../../.."
if [ ! -f "$REPO_ROOT/docker-compose.yml" ]; then
  echo "Error: Cannot find docker-compose.yml. Run from inside the repo."
  exit 1
fi

cd "$REPO_ROOT"

DB_CONTAINER="${DB_CONTAINER:-forge}"
API_CONTAINER="${API_CONTAINER:-forge-api}"
DB_NAME="${POSTGRES_DB:-forge}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "=== Simulation DB Reset ==="
echo ""

# 1. Stop API so nothing writes during reset
echo "1/4  Stopping API container..."
docker compose stop "$API_CONTAINER" 2>/dev/null || true

# 2. Drop and recreate the database
echo "2/4  Dropping and recreating database '$DB_NAME'..."
docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity
  WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker compose exec -T "$DB_CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

echo "     Database recreated."

# 3. Restart the API (runs migrations + seeds automatically)
echo "3/4  Starting API container (will migrate + seed)..."
docker compose up -d "$API_CONTAINER"

# 4. Wait for API health
echo "4/4  Waiting for API to become healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until docker compose exec -T "$API_CONTAINER" curl -sf http://localhost:8080/health > /dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "     API did not become healthy after ${MAX_ATTEMPTS}s. Check logs:"
    echo "     docker compose logs -f $API_CONTAINER"
    exit 1
  fi
  sleep 1
done

echo ""
echo "=== Done! Database reset to freshly-seeded state. ==="
echo "    Ready to run simulation."
echo ""
echo "    Quick run:  SIM_START=2020-01-06 SIM_END=2020-02-03 SIM_MODE=range npx playwright test --config=e2e/simulation/playwright.simulation.config.ts"
echo "    Full run:   npx playwright test --config=e2e/simulation/playwright.simulation.config.ts"
