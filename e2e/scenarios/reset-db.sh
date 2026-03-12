#!/bin/bash
# Reset the database to a fresh seeded state.
#
# Usage:
#   ./e2e/scenarios/reset-db.sh
#   # Then run scenarios:
#   npm run scenario:stop-at-3
#
# This restarts the API container with RECREATE_DB=true, which:
#   1. Drops the entire database
#   2. Recreates the schema
#   3. Seeds roles, users, track types, reference data, 43 jobs, 27 reports
#
# After the API restarts, the DB is in the "base seed" state — ready
# for scenarios to build on top of.

set -e

COMPOSE_DIR="$(cd "$(dirname "$0")/../.." && cd .. && pwd)"

echo "═══════════════════════════════════════════════"
echo "  Resetting database to fresh seed state..."
echo "═══════════════════════════════════════════════"

# Set RECREATE_DB=true for this restart only
cd "$COMPOSE_DIR"
RECREATE_DB=true docker compose up -d --build qb-engineer-api

echo ""
echo "Waiting for API to be healthy..."

# Wait for the health check endpoint
for i in $(seq 1 30); do
  if curl -sf http://localhost:5000/api/v1/health > /dev/null 2>&1; then
    echo "✓ API is healthy and database is freshly seeded."
    echo ""
    echo "Ready to run scenarios:"
    echo "  npm run scenario              # All 6 scenarios"
    echo "  npm run scenario:stop-at-3    # Scenarios 1-3 only"
    echo "  npm run scenario:headed       # With visible browser"
    exit 0
  fi
  echo "  ...waiting ($i/30)"
  sleep 2
done

echo "✗ API did not become healthy within 60 seconds."
echo "  Check logs: docker compose logs -f qb-engineer-api"
exit 1
