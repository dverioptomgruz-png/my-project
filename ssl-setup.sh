#!/bin/bash
set -e

# ===========================================
# SSL Setup Script (Let's Encrypt + Certbot)
# ===========================================

DOMAIN=$1
EMAIL=$2
APP_DIR="/opt/neuro-assistant"

if [ -z "$DOMAIN" ]; then
  echo "Usage: bash ssl-setup.sh YOUR_DOMAIN.com your@email.com"
  exit 1
fi

if [ -z "$EMAIL" ]; then
  EMAIL="admin@$DOMAIN"
  echo "Using default email: $EMAIL"
fi

echo "Setting up SSL for: $DOMAIN"
echo "Email: $EMAIL"

# Step 1: Update nginx config with actual domain
echo "Step 1: Updating nginx config with domain..."
sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" "$APP_DIR/nginx/conf.d/default.conf"
sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" "$APP_DIR/backend/.env"
sed -i "s/YOUR_DOMAIN.com/$DOMAIN/g" "$APP_DIR/frontend/.env"

# Step 2: Ensure certbot directories exist
mkdir -p "$APP_DIR/certbot/conf"
mkdir -p "$APP_DIR/certbot/www"

# Step 3: Get SSL certificate
echo "Step 2: Obtaining SSL certificate..."
cd "$APP_DIR"

# Make sure nginx is running for ACME challenge
docker compose -f docker-compose.production.yml up -d nginx
sleep 5

# Request certificate
docker compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

# Step 4: Create SSL nginx config
echo "Step 3: Creating SSL nginx config..."
cat > "$APP_DIR/nginx/conf.d/default.conf" << NGINX_EOF
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\\\$host\\\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api {
        proxy_pass http://backend:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }

    location /docs {
        proxy_pass http://backend:4000;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }

    location /n8n {
        proxy_pass http://n8n:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
NGINX_EOF

# Step 5: Restart all services
echo "Step 4: Restarting services..."
docker compose -f docker-compose.production.yml restart

echo "========================================="
echo "SSL setup completed for $DOMAIN!"
echo "Your site is now accessible at:"
echo "  https://$DOMAIN"
echo "  https://www.$DOMAIN"
echo "========================================="

# Step 6: Setup auto-renewal cron
echo "Step 5: Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 3 * * * cd $APP_DIR && docker compose -f docker-compose.production.yml run --rm certbot renew && docker compose -f docker-compose.production.yml restart nginx") | sort -u | crontab -
echo "SSL auto-renewal cron job added (runs daily at 3 AM)"
