# Production Deployment Guide: Pinaka Retail Management

This guide outlines the updated architecture and exactly how to deploy the updated Docker stack to a fresh or existing AWS EC2 instance.

## 🏗️ Architecture Overview

We have restructured the application to use a robust, production-ready architecture:

1.  **Nginx Reverse Proxy (Entrypoint)**
    *   Listens on ports `80` (HTTP) and `443` (HTTPS) exposed to the host.
    *   Redirects all HTTP traffic to HTTPS.
    *   Routes `https://pinaka.space` → **Frontend Container**.
    *   Routes `https://api.pinaka.space` → **Backend Container**.
    *   Handles SSL termination.
2.  **Frontend Container (`pinaka_frontend`)**
    *   Serves compiled Vite static files using its own lightweight internal Nginx.
    *   Only accessible via the internal Docker network.
3.  **Backend Container (`pinaka_backend`)**
    *   Runs the Node.js Express server.
    *   Only accessible via the internal Docker network.
4.  **Database (External)**
    *   Connects to MongoDB Atlas via the `.env` file credentials.

---

## 🚀 Deployment Steps (EC2)

The main challenge with SSL reverse proxies is the "chicken-or-egg" problem: Nginx won't start if the SSL certificates are missing, but Certbot needs a running web server to verify domain ownership.

Follow these steps exactly to deploy for the first time:

### Step 1: DNS Configuration
Ensure your DNS records in Route 53 (or your registrar) point to the Elastic IP of your EC2 instance:
*   `A` Record: `pinaka.space` → `<EC2_IP>`
*   `A` Record: `www.pinaka.space` → `<EC2_IP>`
*   `A` Record: `api.pinaka.space` → `<EC2_IP>`

### Step 2: Install Docker & Docker Compose
*(If not already installed on your EC2 instance)*
```bash
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
```
*Note: Log out and log back in for the `docker` group changes to take effect.*

### Step 3: Initial Certificate Provisioning
Since Nginx needs certificates to start, we will use a standalone Certbot container temporarily just to fetch the initial certificates.

1.  Stop any services that might be using port 80:
    ```bash
    docker compose down
    sudo systemctl stop nginx # if you have host nginx running
    ```

2.  Run the Certbot standalone container for the **Frontend domain**:
    ```bash
    sudo docker run -it --rm --name certbot \
      -v "/etc/letsencrypt:/etc/letsencrypt" \
      -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
      -p 80:80 \
      certbot/certbot certonly --standalone -d pinaka.space -d www.pinaka.space
    ```
    *Enter your email and agree to the Terms of Service when prompted.*

3.  Run the Certbot standalone container for the **Backend domain**:
    ```bash
    sudo docker run -it --rm --name certbot \
      -v "/etc/letsencrypt:/etc/letsencrypt" \
      -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
      -p 80:80 \
      certbot/certbot certonly --standalone -d api.pinaka.space
    ```

### Step 4: Configure Environment Variables
Ensure your `backend/.env` file exists and contains the necessary production variables:
```bash
NODE_ENV=production
MONGO_URI=mongodb+srv://<user>:<password>@cluster...
JWT_SECRET=your_super_secret_key
# The docker-compose overrides CORS_ORIGIN and PORT, so you only strictly need the secrets here.
```

### Step 5: Start the Architecture
Now that the certificates exist in `/etc/letsencrypt` (which our `docker-compose.yml` mounts), Nginx can start successfully!

```bash
docker compose up -d --build
```

---

## 🔄 SSL Renewal Setup
Let's Encrypt certificates expire every 90 days. We've configured Nginx to serve `.well-known/acme-challenge` from `/var/www/certbot`. 

To automatically renew, create a cron job running on the host EC2:

1. Open crontab:
   ```bash
   sudo crontab -e
   ```
2. Add this line to run Certbot daily and tell Nginx to reload if the cert was updated:
   ```bash
   0 3 * * * docker run --rm -v "/etc/letsencrypt:/etc/letsencrypt" -v "/var/lib/letsencrypt:/var/lib/letsencrypt" -v "$(pwd)/nginx/certbot/www:/var/www/certbot" certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker exec pinaka_nginx nginx -s reload
   ```

## 🛠️ Summary of Files Changed

*   **`docker-compose.yml`**: Added `nginx` service. Pushed `frontend` and `backend` to isolated internal networks (removed port 5000/80 bindings to host).
*   **`nginx/nginx.conf`**: Main Global configuration.
*   **`nginx/conf.d/pinaka.conf`**: The heavy lifter. Maps subdomains, terminates SSL, enforces HTTPS, sets correct HTTP headers for proxy paths (`X-Forwarded-Proto`, etc.). Uses `proxy_pass` to reach internal Docker DNS names.
