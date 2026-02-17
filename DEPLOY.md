# Deploy on Beget VPS

## Prerequisites
- Beget VPS with Docker (select Docker profile when creating)
- Domain pointed to VPS IP
- SSH access to server

## Step 1: Connect to VPS
```bash
ssh root@YOUR_VPS_IP
```

## Step 2: Clone repository
```bash
cd /home
git clone YOUR_REPO_URL my-project
cd my-project
```

## Step 3: Configure environment
```bash
cp backend/.env.production backend/.env
cp frontend/.env.production frontend/.env.local
nano backend/.env    # Fill in real values
nano frontend/.env.local  # Fill in real values
```

## Step 4: Set domain in nginx
```bash
sed -i "s/YOUR_DOMAIN.com/yourdomain.com/g" nginx/conf.d/default.conf
```

## Step 5: Deploy
```bash
./deploy.sh deploy
```

## Step 6: Setup SSL
```bash
./deploy.sh ssl yourdomain.com your@email.com
```

## Commands
- `./deploy.sh deploy` - First deploy
- `./deploy.sh update` - Pull and rebuild
- `./deploy.sh ssl domain email` - Setup SSL
- `./deploy.sh logs` - View logs
- `./deploy.sh stop` - Stop all

## Ports
- 80/443 - Nginx (public)
- 3000 - Frontend (internal)
- 8000 - Backend API (internal)
