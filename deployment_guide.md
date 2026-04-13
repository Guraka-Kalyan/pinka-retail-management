# 🚀 Pinaka Retail Management — AWS Deployment Guide

> **Stack:** React (Vite) + Node.js (Express) + MongoDB Atlas + Docker Compose + Nginx + Let's Encrypt SSL
> **Server:** AWS EC2 t3.small (Ubuntu 22.04 LTS)
> **Domains:** `pinaka.space` (frontend) · `api.pinaka.space` (backend API)

---

## 📋 Architecture Overview

```
User Browser
    │
    ▼
Route 53 DNS (pinaka.space / api.pinaka.space)
    │
    ▼
Elastic IP → EC2 t3.small (Ubuntu 22.04)
    │
    ▼
Security Group (ports 22, 80, 443)
    │
    ▼
Docker Compose
    ├── pinaka_nginx    (nginx:alpine)  → ports 80, 443
    ├── pinaka_frontend (nginx:alpine)  → port 80 (internal)
    └── pinaka_backend  (node:20-alpine) → port 5000 (internal)
            │
            ▼
    MongoDB Atlas (cloud)
```

---

## 🛠️ AWS Services Used

| Service | Purpose | Cost (ap-south-1) |
|---------|---------|-------------------|
| EC2 t3.small | Runs all Docker containers | ~₹1,400/month |
| Elastic IP | Static public IP | Free (when attached) |
| Route 53 | DNS for pinaka.space | ~₹42/month |
| Security Group | Firewall (ports 22, 80, 443) | Free |
| EBS 20GB gp3 | Server storage | ~₹160/month |
| **Total** | | **~₹1,600/month** |

> MongoDB Atlas (M0 Free Tier) and Let's Encrypt SSL are free.

---

## 📦 Prerequisites

- AWS account with billing enabled
- Domain name (`pinaka.space`) purchased from any registrar
- MongoDB Atlas cluster with connection URI
- GitHub repository with project code
- Local machine with Git installed

---

## 🔑 PHASE 1 — AWS Setup

### 1.1 Create Key Pair (SSH Access)

1. AWS Console → **EC2** → **Network & Security** → **Key Pairs**
2. **Create key pair**
   - Name: `pinaka-key`
   - Type: RSA
   - Format: `.pem`
3. Download and save `pinaka-key.pem` — **never lose this file**

### 1.2 Create Security Group

1. EC2 → **Network & Security** → **Security Groups** → **Create security group**
   - Name: `pinaka-sg`
   - VPC: default
2. Add **Inbound Rules:**

| Type | Port | Source | Purpose |
|------|------|--------|---------|
| SSH | 22 | My IP | Server access |
| HTTP | 80 | 0.0.0.0/0 | Web traffic |
| HTTPS | 443 | 0.0.0.0/0 | Secure web traffic |

### 1.3 Launch EC2 Instance

1. EC2 → **Instances** → **Launch instances**

| Setting | Value |
|---------|-------|
| Name | `pinaka-server` |
| AMI | Ubuntu Server 22.04 LTS (HVM), 64-bit x86 |
| Instance type | `t3.small` (2 vCPU / 2GB RAM) |
| Key pair | `pinaka-key` |
| Auto-assign public IP | **Disable** |
| Security group | `pinaka-sg` |
| Storage | **20 GiB gp3** |

2. Click **Launch instance**

### 1.4 Allocate & Associate Elastic IP

1. EC2 → **Network & Security** → **Elastic IPs**
2. **Allocate Elastic IP address** → click **Allocate**
3. Note the IP (e.g., `32.193.50.167`)
4. Select IP → **Actions** → **Associate Elastic IP address**
   - Resource type: Instance
   - Instance: `pinaka-server`
5. Click **Associate**

---

## 🌐 PHASE 2 — Route 53 DNS Setup

### 2.1 Create Hosted Zone

1. AWS Console → **Route 53** → **Hosted zones** → **Create hosted zone**
   - Domain name: `pinaka.space`
   - Type: Public hosted zone

### 2.2 Create DNS Records

Create these **3 A records** all pointing to your Elastic IP:

| Record name | Type | Value |
|-------------|------|-------|
| *(blank)* | A | `32.193.50.167` |
| `www` | A | `32.193.50.167` |
| `api` | A | `32.193.50.167` |

### 2.3 Update Nameservers at Registrar

Route 53 gives you 4 NS records like:
```
ns-1007.awsdns-61.net
ns-1889.awsdns-44.co.uk
ns-1418.awsdns-49.org
ns-17.awsdns-02.com
```

Go to your domain registrar (Namecheap/GoDaddy/etc.) and replace the nameservers with these 4 AWS nameservers.

> ⏳ DNS propagation takes 5–30 minutes (up to 2 hours)

---

## 🖥️ PHASE 3 — Server Setup

### 3.1 SSH Into Server

```bash
# Windows — fix .pem permissions first
icacls "C:\path\to\pinaka-key.pem" /inheritance:r /grant:r "$($env:USERNAME):(R)"

# Connect
ssh -i pinaka-key.pem ubuntu@32.193.50.167
```

> If you see "REMOTE HOST IDENTIFICATION HAS CHANGED" error:
> ```bash
> ssh-keygen -R 32.193.50.167
> ssh -i pinaka-key.pem ubuntu@32.193.50.167
> ```

### 3.2 Install Docker

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Apply group change
exit
```

SSH back in and verify:
```bash
ssh -i pinaka-key.pem ubuntu@32.193.50.167
docker --version        # Docker version 26.x.x
docker compose version  # Docker Compose version v2.x.x
```

### 3.3 Install Git & Clone Repository

```bash
sudo apt install git -y

cd ~
git clone https://github.com/Guraka-Kalyan/pinka-retail-management.git
cd pinka-retail-management
ls  # Should show: backend/ frontend/ nginx/ docker-compose.yml
```

---

## ⚙️ PHASE 4 — Environment Configuration

### 4.1 Create Backend `.env`

```bash
cd ~/pinka-retail-management/backend
nano .env
```

Paste (fill in YOUR values):
```env
PORT=5000
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.mongodb.net/pinaka
JWT_SECRET=your_very_long_random_secret_min_32_chars_here
JWT_EXPIRES_IN=1h
NODE_ENV=production
CORS_ORIGIN=https://pinaka.space,https://www.pinaka.space
```

Save: `Ctrl+X` → `Y` → `Enter`

> ⚠️ Get `MONGO_URI` from MongoDB Atlas → Connect → Drivers

### 4.2 Create Required Directories

```bash
cd ~/pinka-retail-management
mkdir -p nginx/certbot/www
```

---

## 🔒 PHASE 5 — SSL Certificates (Let's Encrypt)

> ⚠️ Run certbot BEFORE starting Docker — port 80 must be free

```bash
# Install certbot
sudo apt install certbot -y

# Get certificate for frontend domain
sudo certbot certonly --standalone \
  -d pinaka.space \
  -d www.pinaka.space \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# Get certificate for API domain
sudo certbot certonly --standalone \
  -d api.pinaka.space \
  --email your@email.com \
  --agree-tos \
  --no-eff-email

# Verify certs exist
sudo ls /etc/letsencrypt/live/
# Should show: pinaka.space/  api.pinaka.space/
```

### 5.1 Setup Auto-Renewal

```bash
sudo crontab -e
```

Add at the bottom:
```
0 3 * * 1 certbot renew --quiet && cd /home/ubuntu/pinka-retail-management && docker compose restart nginx
```

---

## 🐳 PHASE 6 — Deploy with Docker Compose

```bash
cd ~/pinka-retail-management

# Build and start all containers
docker compose up -d --build
```

Build takes ~3–5 minutes. Check status:
```bash
docker compose ps
```

Expected output:
```
NAME               STATUS    PORTS
pinaka_nginx       Up        0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
pinaka_frontend    Up        80/tcp
pinaka_backend     Up        5000/tcp
```

---

## ✅ PHASE 7 — Verification

```bash
# Test backend health
curl https://api.pinaka.space/api/health
# {"status":"ok","timestamp":"..."}

# Test login API
curl https://api.pinaka.space/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"admin","password":"YOUR_PASSWORD"}'
# {"success":true,"token":"eyJ..."}

# Check all container logs
docker compose logs --tail=20
```

Open in browser:
- `https://pinaka.space` → Login page ✅
- `https://api.pinaka.space/api/health` → `{"status":"ok"}` ✅

---

## 🔄 PHASE 8 — Updating Code (Future Deployments)

```bash
# SSH into server
ssh -i pinaka-key.pem ubuntu@32.193.50.167

# Pull latest code
cd ~/pinka-retail-management
git pull origin main

# If only backend changed (no rebuild needed for nginx config changes)
docker compose restart backend

# If frontend or docker-compose changed (full rebuild required)
docker compose up -d --build

# If only nginx config changed (no rebuild, just restart)
docker compose restart nginx
```

---

## 🛟 Useful Commands Reference

```bash
# View real-time logs
docker compose logs -f

# View specific service logs
docker compose logs nginx --tail=50
docker compose logs backend --tail=50
docker compose logs frontend --tail=50

# Restart specific container
docker compose restart nginx
docker compose restart backend
docker compose restart frontend

# Stop everything
docker compose down

# Start everything (no rebuild)
docker compose up -d

# Full rebuild
docker compose up -d --build

# Free up disk (remove old images)
docker system prune -f

# Check disk usage
df -h

# Check memory usage
free -h

# Check container resource usage
docker stats
```

---

## 🗄️ Database Management

### View Collections
```bash
docker exec -it pinaka_backend node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGO_URI).then(async () => {
    const cols = await mongoose.connection.db.listCollections().toArray();
    console.log(cols.map(c => c.name));
    mongoose.disconnect();
  });
"
```

### Clear Specific Collection
```bash
docker exec -it pinaka_backend node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGO_URI).then(async () => {
    await mongoose.connection.db.collection('sales').deleteMany({});
    console.log('Done');
    mongoose.disconnect();
  });
"
```

### Full Database Reset (⚠️ Irreversible)
```bash
docker exec -it pinaka_backend node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGO_URI).then(async () => {
    await mongoose.connection.db.dropDatabase();
    console.log('Database dropped');
    mongoose.disconnect();
  });
"
```

---

## ⚠️ Troubleshooting

### Login fails — 404 on API
- Check `VITE_API_URL=https://api.pinaka.space/api` in `docker-compose.yml`
- Rebuild frontend: `docker compose up -d --build frontend`

### Nginx won't start — SSL cert error
- Verify certs: `sudo ls /etc/letsencrypt/live/`
- Certs missing: Re-run certbot commands from Phase 5

### SSH key error — "REMOTE HOST IDENTIFICATION HAS CHANGED"
```bash
ssh-keygen -R 32.193.50.167
ssh -i pinaka-key.pem ubuntu@32.193.50.167
```

### MongoDB connection fails
- Check `MONGO_URI` in `backend/.env`
- Whitelist EC2 IP in MongoDB Atlas → Network Access → Add IP

### Out of disk space
```bash
docker system prune -f     # Remove unused images
docker volume prune -f     # Remove unused volumes
df -h                      # Check disk usage
```

### Container keeps restarting
```bash
docker compose logs backend --tail=50   # Check error message
```

---

## 📁 Key File Locations

| File | Purpose |
|------|---------|
| `backend/.env` | Backend secrets — NEVER commit to git |
| `docker-compose.yml` | All container configuration |
| `nginx/nginx.conf` | Main nginx settings (performance, gzip) |
| `nginx/conf.d/pinaka.conf` | Domain routing + SSL config |
| `frontend/nginx.conf` | SPA fallback config inside frontend container |
| `frontend/.env.production` | Frontend build-time env vars |
| `backend/Dockerfile` | Backend container build steps |
| `frontend/Dockerfile` | Frontend multi-stage build steps |

---

## 🔐 Security Checklist

- [ ] `backend/.env` is in `.gitignore` — never pushed to GitHub
- [ ] JWT_SECRET is at least 32 random characters
- [ ] JWT expires in 1 hour (`JWT_EXPIRES_IN=1h`)
- [ ] Rate limiting on `/api/auth/login` (10 requests / 15 min)
- [ ] SSH only accessible from your IP (Security Group rule)
- [ ] HTTPS enforced — HTTP redirects to HTTPS
- [ ] MongoDB Atlas IP whitelist has only EC2's Elastic IP
- [ ] HSTS header enabled (6 months)

---

## 💰 Monthly Cost Summary

### ap-south-1 (Mumbai) — Current Region

| Resource | $/month | ₹/month |
|----------|---------|---------|
| EC2 t3.small (2vCPU/2GB) | $16.85 | ~₹1,400 |
| EBS 20GB gp3 | $1.92 | ~₹160 |
| Route 53 hosted zone | $0.50 | ~₹42 |
| Elastic IP (attached) | $0 | ₹0 |
| MongoDB Atlas M0 | $0 | ₹0 |
| Let's Encrypt SSL | $0 | ₹0 |
| **Total** | **~$19.27** | **~₹1,602/month** |

---

### us-east-1 (N. Virginia) — Cost Comparison

> us-east-1 is the cheapest AWS region globally

| Resource | $/month | ₹/month |
|----------|---------|---------|
| EC2 t3.small (2vCPU/2GB) | $14.98 | ~₹1,243 |
| EBS 20GB gp3 | $1.60 | ~₹133 |
| Route 53 hosted zone | $0.50 | ~₹42 |
| Elastic IP (attached) | $0 | ₹0 |
| MongoDB Atlas M0 | $0 | ₹0 |
| Let's Encrypt SSL | $0 | ₹0 |
| **Total** | **~$17.08** | **~₹1,418/month** |

> **Savings vs Mumbai:** ~$2.19/month (~₹182/month cheaper)
> **Downside:** Higher latency for Indian users (~180ms vs ~20ms from Mumbai)

### Region Comparison

| Factor | ap-south-1 (Mumbai) | us-east-1 (Virginia) |
|--------|--------------------|--------------------|
| Monthly cost | ~$19.27 | ~$17.08 |
| Latency (India) | ~10–30ms ✅ | ~150–200ms ❌ |
| AMI availability | All Ubuntu AMIs | All Ubuntu AMIs |
| Best for | Indian users | Cost optimization |
| **Recommendation** | ✅ Use this | Only if no Indian users |

---

## 🏆 Deployment Completion Status

> Completed: April 13, 2026

```
AWS Infrastructure
✅ EC2 t3.small (Ubuntu 22.04)    — Running
✅ Elastic IP 32.193.50.167       — Static & Attached
✅ Route 53 DNS                   — pinaka.space + api.pinaka.space
✅ Security Group                 — Ports 22, 80, 443 open

Server Setup
✅ Docker + Docker Compose        — Installed
✅ Git + Repo cloned              — /home/ubuntu/pinka-retail-management
✅ Backend .env                   — MONGO_URI, JWT_SECRET configured

SSL & Nginx
✅ Let's Encrypt SSL              — pinaka.space + api.pinaka.space
✅ Auto-renewal cron              — Every Monday 3am
✅ Nginx proxy buffer fix         — No buffering warnings
✅ ssl_stapling disabled          — No OCSP warnings
✅ HTTP → HTTPS redirect          — 301 working

Docker Containers
✅ pinaka_nginx                   — Up (ports 80, 443)
✅ pinaka_frontend                — Up (React app served)
✅ pinaka_backend                 — Up (Node.js port 5000)

Application
✅ MongoDB Atlas                  — Connected
✅ Login API                      — Returns JWT token
✅ Frontend                       — https://pinaka.space
✅ Backend API                    — https://api.pinaka.space/api
```

### Live URLs
| URL | Purpose |
|-----|---------|
| https://pinaka.space | Main app (login) |
| https://www.pinaka.space | Redirects to main |
| https://api.pinaka.space/api/health | API health check |
| https://api.pinaka.space/api/auth/login | Login endpoint |

---

*Last deployed: April 2026 | Server: 32.193.50.167 | Repo: Guraka-Kalyan/pinka-retail-management*
