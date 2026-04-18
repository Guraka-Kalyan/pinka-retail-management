# 🚀 Pinaka Retail Management: Client Infrastructure & IT Handoff

This document is provided to you (the Client) as a formal handover of the cloud infrastructure that powers the Pinaka application. 

Because we built this application to be entirely owned by you, the server runs inside your own AWS account. This means **you retain 100% ownership** of your data and infrastructure. 

This document outlines exactly what AWS will charge your linked credit card each month, and also acts as an "Emergency Troubleshooting Guide" for any future IT personnel you hire to maintain the system if an issue arises years down the line.

---

## 💰 1. Monthly Server Costs (AWS Billing)

Your application is hosted in the AWS Mumbai region (`ap-south-1`). Because the system is highly optimized using Docker containers, the monthly overhead is extremely low. 

You should expect a monthly charge from AWS of approximately **~$21.45 USD (roughly ₹1,790 INR)**. 

Here is exactly what you are paying for on the AWS invoice:

| AWS Service | What It Does For You | Est. Monthly Cost |
| :--- | :--- | :--- |
| **EC2 Instance** (`t3.small`) | The main computer/server running your website 24/7. | ~$15.18 USD |
| **EBS Storage** (`20GB gp3`) | The hard drive holding your code and images. | ~$1.60 USD |
| **Elastic IP** (Public IPv4) | Your static IP address so the domain never breaks. | ~$3.60 USD |
| **Route 53** (DNS) | Routes users safely from your custom domain to the server. | ~$1.07 USD |
| **MongoDB Atlas** (M0) | Where all your sales and inventory data is saved. | **$0.00** (Free Tier) |
| **Let's Encrypt** (SSL) | The secure "HTTPS" padlock on your website. | **$0.00** (Free Tier) |
| **Total Estimated Monthly Cost:** | | **~$21.45 USD / month**|

*(Note: If your business scales to hundreds of branches, your only additional cost will be upgrading your MongoDB Atlas database beyond their Free Tier. You handle this directly with MongoDB, not AWS).*

---

## 🛠️ 2. Emergency IT Runbook (For Future IT Staff)

As the original developers, we will not be conducting active daily maintenance on this AWS server. If the application goes down in the future, please hand this document to your IT Administrator.

### Problem 1: "No space left on device" (Disk Full)
*   **What happens:** Users cannot upload images or log in. The server's 20GB hard drive has filled up entirely with old system logs over the course of 1-2 years.
*   **The Fix:** Your IT admin must SSH into the server and tell Docker to clear out all dead cache space:
    ```bash
    docker system prune -a --volumes -f
    ```

### Problem 2: The "502 Bad Gateway" Error
*   **What happens:** The screen goes white and shows a "502 Bad Gateway" message. This happens if an IT administrator rebuilds the frontend containers, but forgets to restart Nginx. Nginx is looking for the old internal IP address of the container.
*   **The Fix:** Simply restart the Nginx router on the server.
    ```bash
    docker compose restart nginx
    ```

### Problem 3: Server Completely Freezes (Out of Memory)
*   **What happens:** No one can access the site, and the IT admin cannot even SSH into the server. This happens because compiling code updates can use 100% of the server's 2GB RAM, triggering the Linux OOM (Out of Memory) killer.
*   **The Fix:** 
    1. Log into your AWS Console (browser).
    2. Go to **EC2** → Instances.
    3. Select your instance → **Instance State** → **Reboot instance**.

### Problem 4: Security Certificate Warning (HTTPS Expired)
*   **What happens:** Google Chrome blocks users from visiting the site, saying "Connection is not private." Let's Encrypt free SSL certificates only last 90 days. While there is an automatic renewal script running, it may occasionally fail.
*   **The Fix:** Your IT admin must manually force a renewal:
    ```bash
    docker compose stop nginx
    sudo certbot renew --force-renewal
    docker compose start nginx
    ```

### Problem 5: Missing Sales Data or "Network Error" on Login
*   **What happens:** The website loads perfectly, but anyone who tries to log in gets an infinite loading screen or a 500 error. Check the backend logs for `MongooseServerSelectionError`.
*   **What it means:** The MongoDB Database is blocking your AWS Server. MongoDB strictly blocks all IP addresses to protect your data. If you ever detached/replaced your AWS Elastic IP, the database is treating the new IP as a hacker.
*   **The Fix:** Log into **MongoDB Atlas** → Security → **Network Access** → Add your AWS Server's *current* Public IPv4 address to the whitelist.
