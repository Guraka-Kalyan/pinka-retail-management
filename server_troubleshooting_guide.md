# 🚨 Pinaka AWS Server: Future Troubleshooting Guide

This document catalogs the most common server and infrastructure issues that may occur in a production AWS environment over the course of months or years. Keep this on hand as your emergency runbook.

---

## 1. 🌐 The "502 Bad Gateway" Error
**Symptoms:** You deploy new code, and suddenly `pinaka.space` shows a white screen saying "502 Bad Gateway".
**Why it happens:** 
Nginx (the web server) never stops running, but your Frontend and Backend containers get destroyed and recreated when you rebuild them. Docker assigns them *new* internal IP addresses, but Nginx is still stubbornly remembering the *old* IP addresses.
**The Solution:** 
Log into the server and force Nginx to refresh its memory by restarting it.
```bash
docker compose restart nginx
```

---

## 2. 💻 Server Becomes Completely Unresponsive (Out of Memory)
**Symptoms:** You run `docker compose up -d --build`, and the terminal completely freezes. You cannot SSH into the server, and the live application goes down.
**Why it happens:** 
Your server (`t3.small`) has 2GB of RAM. The process of compiling React (Frontend) requires a massive spike in memory. Sometimes, this spike uses more than 2GB, invoking Linux's "OOM Killer" (Out of Memory Killer), which crashes the server.
**The Solution:**
1. Go to the **AWS Console** → EC2 → Instances.
2. Select your instance (`pinaka-server`) → Instance State → **Reboot instance**.
3. Wait 2 minutes, then SSH back in.
4. *Prevention:* To prevent this, run `docker system prune -f` before building to clear up system resources.

---

## 3. 💽 Out of Disk Space (No space left on device)
**Symptoms:** You try to upload an image, log in, or rebuild the server, and you get an error saying `No space left on device`.
**Why it happens:**
Your AWS hard drive (EBS volume) only has 20GB. Over 6-12 months, Docker accumulates old, dead images, stopped containers, and massive log files that eventually fill up exactly 100% of the drive.
**The Solution:**
Log into the server and tell Docker to aggressively delete all unused, dangling images and cache:
```bash
# Deletes all dead images, stopped containers, and cache (Safe to run)
docker system prune -a --volumes -f
```
*To verify it worked, check your disk space:*
```bash
df -h
# Look at the /dev/root line. It should be below 80%.
```

---

## 4. 🔒 SSL / HTTPS Warnings (Certificate Expired)
**Symptoms:** Users visit `pinaka.space` and their browser flashes a bright red screen warning: "Your connection is not private."
**Why it happens:**
Let's Encrypt SSL certificates expire strictly every 90 days. While there is a cron job set up to auto-renew them, auto-renewals can fail if Docker is hogging port 80 or the server was down during the renewal attempt.
**The Solution (Manual Force Renew):**
```bash
# 1. Stop Nginx to free up Port 80 for the verifier
docker compose stop nginx

# 2. Force Certbot to renew the certificates
sudo certbot renew --force-renewal

# 3. Start Nginx immediately to bring the site back online
docker compose start nginx
```

---

## 5. 🗄️ Backend Stops Working (MongooseServerSelectionError)
**Symptoms:** You can load the login page, but trying to log in constantly shows "Loading..." or returns a 500 Network Error.
**Why it happens:**
The Backend Node.js container lost connection to MongoDB Atlas. This usually happens if:
1. You accidentally detached your Elastic IP in AWS, changing your server's public IP.
2. The MongoDB Atlas free cluster is undergoing mandatory maintenance.
**The Solution:**
1. Run `docker compose logs backend --tail=50` to confirm the error says "MongooseServerSelectionError".
2. Check your AWS EC2 console to ensure your Public IPv4 address is absolutely still `52.66.172.29`.
3. If your IP changed, you MUST log into MongoDB Atlas → Network Access → Address → and Add the *new* Server IP address to the whitelist.

---

## 6. 🐳 Docker Engine Crashes
**Symptoms:** You try to run a `docker` command, but the terminal replies: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`
**Why it happens:**
The core Docker service running on the Ubuntu machine crashed unexpectedly.
**The Solution:**
Restart the background docker service on Ubuntu:
```bash
sudo systemctl restart docker
# Then bring back up your app
cd ~/pinka-retail-management
docker compose up -d
```

---

## 7. 🏷️ Domain DNS Fails / Site Cannot Be Reached
**Symptoms:** Typing `pinaka.space` into the browser instantly fails with `ERR_NAME_NOT_RESOLVED`.
**Why it happens:**
You either forgot to renew your domain name at your Registrar (Namecheap, GoDaddy), OR your AWS Route 53 Hosted Zone was deleted.
**The Solution:**
1. Check your Registrar account to ensure the domain is paid for and active.
2. Verify that the 4 "Nameservers" in your Registrar still EXACTLY match the 4 Nameservers listed inside AWS Route 53.
