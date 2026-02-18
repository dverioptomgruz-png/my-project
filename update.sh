#!/bin/bash
set -e

# Quick update script for production
APP_DIR="/opt/neuro-assistant"

echo "Updating Neuro-Assistant..."
cd "$APP_DIR"

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d

# Run migrations
sleep 10
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy

echo "Update completed!"
docker compose -f docker-compose.production.yml ps
