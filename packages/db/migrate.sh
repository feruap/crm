#!/bin/bash
#
# Run all SQL migrations in order against PostgreSQL
#
# Usage:
#   ./migrate.sh                          # uses DATABASE_URL from .env
#   DATABASE_URL=postgres://... ./migrate.sh
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

# Load .env from server if DATABASE_URL not set
if [ -z "$DATABASE_URL" ]; then
    ENV_FILE="$SCRIPT_DIR/../../apps/server/.env"
    if [ -f "$ENV_FILE" ]; then
        export $(grep -v '^#' "$ENV_FILE" | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set. Export it or add to apps/server/.env"
    exit 1
fi

echo "Running migrations against: ${DATABASE_URL%%@*}@***"
echo ""

# Run base schema first (idempotent with IF NOT EXISTS)
echo "==> schema.sql (base tables)"
psql "$DATABASE_URL" -f "$SCRIPT_DIR/schema.sql" 2>&1 | tail -3
echo ""

# Run numbered migrations in order
for migration in "$MIGRATIONS_DIR"/*.sql; do
    name=$(basename "$migration")
    echo "==> $name"
    psql "$DATABASE_URL" -f "$migration" 2>&1 | tail -3
    echo ""
done

echo "All migrations complete."
