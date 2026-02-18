#!/bin/bash
set -e

# ===========================================
# Neuro-Assistant Deploy Script for Beget VPS
# ===========================================

echo "========================================="
echo "  Neuro-Assistant Deploy Script"
echo "  Beget VPS + Cloud PostgreSQL"
echo "========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Configuration
APP_DIR="/opt/neuro-assistant"
REPO_URL="https://github.com/dverioptomgruz-png/my-project.git"
BRANCH="main"

echo -e "${YELLOW}Step 1: Installing system dependencies...${NC}"

# Update system
apt-get update && apt-get upgrade -y

# Install required packages
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  ufw

# Install Docker
if ! command -v docker &> /dev/null; then
  echo -e "${YELLOW}Installing Docker...${NC}"
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  systemctl enable docker
  systemctl start docker
else
  echo -e "${GREEN}Docker already installed${NC}"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
  echo -e "${YELLOW}Installing Docker Compose...${NC}"
  COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
else
  echo -e "${GREEN}Docker Compose already installed${NC}"
fi

echo -e "${GREEN}Step 1 completed!${NC}"

echo -e "${YELLOW}Step 2: Setting up firewall...${NC}"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 5678/tcp  # n8n
ufw --force enable
echo -e "${GREEN}Step 2 completed!${NC}"

echo -e "${YELLOW}Step 3: Cloning/updating repository...${NC}"
if [ -d "$APP_DIR" ]; then
  echo "Directory exists, pulling latest changes..."
  cd "$APP_DIR"
  git pull origin $BRANCH
else
  echo "Cloning repository..."
  git clone -b $BRANCH $REPO_URL $APP_DIR
  cd "$APP_DIR"
fi
echo -e "${GREEN}Step 3 completed!${NC}"

echo -e "${YELLOW}Step 4: Setting up environment files...${NC}"

# Check if .env files exist
if [ ! -f "$APP_DIR/backend/.env" ]; then
  if [ -f "$APP_DIR/backend/.env.production" ]; then
    cp "$APP_DIR/backend/.env.production" "$APP_DIR/backend/.env"
    echo -e "${YELLOW}IMPORTANT: Edit backend/.env with your actual database credentials!${NC}"
    echo -e "${YELLOW}  nano $APP_DIR/backend/.env${NC}"
  else
    echo -e "${RED}backend/.env.production not found!${NC}"
    exit 1
  fi
fi

if [ ! -f "$APP_DIR/frontend/.env" ]; then
  if [ -f "$APP_DIR/frontend/.env.production" ]; then
    cp "$APP_DIR/frontend/.env.production" "$APP_DIR/frontend/.env"
    echo -e "${YELLOW}IMPORTANT: Edit frontend/.env with your actual domain!${NC}"
    echo -e "${YELLOW}  nano $APP_DIR/frontend/.env${NC}"
  else
    echo -e "${RED}frontend/.env.production not found!${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Step 4 completed!${NC}"

echo -e "${YELLOW}Step 5: Creating SSL certificates directory...${NC}"
mkdir -p "$APP_DIR/certbot/conf"
mkdir -p "$APP_DIR/certbot/www"
echo -e "${GREEN}Step 5 completed!${NC}"

echo -e "${YELLOW}Step 6: Building and starting containers...${NC}"
cd "$APP_DIR"

# Build images
docker compose -f docker-compose.production.yml build --no-cache

# Start containers
docker compose -f docker-compose.production.yml up -d

echo -e "${GREEN}Step 6 completed!${NC}"

echo -e "${YELLOW}Step 7: Running database migrations...${NC}"
# Wait for backend to be ready
sleep 10
docker compose -f docker-compose.production.yml exec backend npx prisma migrate deploy
echo -e "${GREEN}Step 7 completed!${NC}"

echo "========================================="
echo -e "${GREEN}  Deployment completed successfully!${NC}"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Edit backend/.env with your Beget PostgreSQL credentials"
echo "  2. Edit frontend/.env with your domain"
echo "  3. Run: bash ssl-setup.sh YOUR_DOMAIN.com"
echo "  4. Restart: docker compose -f docker-compose.production.yml restart"
echo ""
