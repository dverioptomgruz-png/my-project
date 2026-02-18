#!/bin/bash
set -e

# ===========================================
# Database Migration Script
# Supabase PostgreSQL -> Beget Cloud PostgreSQL
# ===========================================

echo "========================================="
echo "  Database Migration Tool"
echo "  Supabase -> Beget Cloud PostgreSQL"
echo "========================================="

# Source (Supabase) - fill in your credentials
SOURCE_HOST="${1:-db.YOUR_SUPABASE_PROJECT.supabase.co}"
SOURCE_PORT="${2:-5432}"
SOURCE_DB="${3:-postgres}"
SOURCE_USER="${4:-postgres}"
SOURCE_PASSWORD="${5}"

# Target (Beget) - fill in your credentials
TARGET_HOST="${6:-YOUR_BEGET_HOST}"
TARGET_PORT="${7:-5432}"
TARGET_DB="${8:-neuro_assistant}"
TARGET_USER="${9:-YOUR_BEGET_USER}"
TARGET_PASSWORD="${10}"

BACKUP_DIR="./db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/supabase_backup_$TIMESTAMP.sql"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
  echo "Installing postgresql-client..."
  apt-get update && apt-get install -y postgresql-client
fi

mkdir -p "$BACKUP_DIR"

echo ""
echo "Source: $SOURCE_HOST:$SOURCE_PORT/$SOURCE_DB"
echo "Target: $TARGET_HOST:$TARGET_PORT/$TARGET_DB"
echo ""

# Step 1: Dump from Supabase
echo "Step 1: Dumping data from Supabase..."
export PGPASSWORD="$SOURCE_PASSWORD"
pg_dump -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" \
  --no-owner --no-privileges --clean --if-exists \
  --exclude-schema=auth --exclude-schema=storage --exclude-schema=realtime \
  --exclude-schema=supabase_functions --exclude-schema=extensions \
  --exclude-schema=graphql --exclude-schema=graphql_public \
  --exclude-schema=pgsodium --exclude-schema=pgsodium_masks \
  --exclude-schema=vault --exclude-schema=supabase_migrations \
  -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Dump completed: $BACKUP_FILE"
  echo "File size: $(du -h $BACKUP_FILE | cut -f1)"
else
  echo "ERROR: Dump failed!"
  exit 1
fi

# Step 2: Restore to Beget
echo ""
echo "Step 2: Restoring data to Beget PostgreSQL..."
export PGPASSWORD="$TARGET_PASSWORD"
psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$TARGET_DB" \
  -f "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "Restore completed successfully!"
else
  echo "WARNING: Restore completed with some errors (this may be normal)"
fi

# Step 3: Run Prisma migrations on new DB
echo ""
echo "Step 3: Running Prisma migrations..."
if [ -d "/opt/neuro-assistant" ]; then
  cd /opt/neuro-assistant
  docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
  echo "Prisma migrations applied!"
else
  echo "App directory not found. Run Prisma migrations manually:"
  echo "  npx prisma migrate deploy"
fi

# Step 4: Verify
echo ""
echo "Step 4: Verifying migration..."
export PGPASSWORD="$TARGET_PASSWORD"
TABLE_COUNT=$(psql -h "$TARGET_HOST" -p "$TARGET_PORT" -U "$TARGET_USER" -d "$TARGET_DB" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
echo "Tables in target database: $TABLE_COUNT"

echo ""
echo "========================================="
echo "  Migration completed!"
echo "========================================="
echo ""
echo "Backup file saved: $BACKUP_FILE"
echo "Don't forget to update DATABASE_URL in backend/.env"
