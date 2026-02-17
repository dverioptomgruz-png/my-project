#!/bin/bash
set -e

echo "=== Neuro-Assistant Deploy Script ==="
echo "Target: Beget VPS"
echo ""

# Colors
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

# Check if .env files exist
check_env() {
    if [ ! -f backend/.env ]; then
        echo -e "${RED}ERROR: backend/.env not found!${NC}"
        echo "Copy backend/.env.production to backend/.env and fill in values"
        exit 1
    fi
    if [ ! -f frontend/.env.local ]; then
        echo -e "${RED}ERROR: frontend/.env.local not found!${NC}"
        echo "Copy frontend/.env.production to frontend/.env.local and fill in values"
        exit 1
    fi
    echo -e "${GREEN}ENV files OK${NC}"
}
# Build and start containers
deploy() {
    echo -e "${YELLOW}Building containers...${NC}"
    docker compose -f docker-compose.production.yml build --no-cache
    echo -e "${YELLOW}Starting containers...${NC}"
    docker compose -f docker-compose.production.yml up -d
    echo -e "${GREEN}Containers started!${NC}"
}

# Setup SSL with certbot
setup_ssl() {
    echo -e "${YELLOW}Setting up SSL...${NC}"
    docker compose -f docker-compose.production.yml run --rm certbot certonly --webroot -w /var/www/certbot -d $1 -d www.$1 --email $2 --agree-tos --no-eff-email
    echo -e "${GREEN}SSL certificates obtained!${NC}"
}
# Update deployment
update() {
    echo -e "${YELLOW}Pulling latest code...${NC}"
    git pull origin main
    echo -e "${YELLOW}Rebuilding containers...${NC}"
    docker compose -f docker-compose.production.yml build
    docker compose -f docker-compose.production.yml up -d
    echo -e "${GREEN}Update complete!${NC}"
}

# Show logs
logs() {
    docker compose -f docker-compose.production.yml logs -f
}

# Main
case "$1" in
    deploy)
        check_env
        deploy
        ;;
    update)
        update
        ;;
    ssl)
        setup_ssl $2 $3
        ;;
    logs)
        logs
        ;;
    stop)
        docker compose -f docker-compose.production.yml down
        ;;
    *)
        echo "Usage: ./deploy.sh {deploy|update|ssl|logs|stop}"
        echo "  deploy  - First deploy (build and start)"
        echo "  update  - Pull and rebuild"
        echo "  ssl     - Setup SSL: ./deploy.sh ssl domain.com email"
        echo "  logs    - Show logs"
        echo "  stop    - Stop all containers"
        ;;
esac
