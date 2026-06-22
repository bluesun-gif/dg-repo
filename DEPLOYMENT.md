# DG Repo (Branded Paperless-ngx) Deployment Guide

This guide explains how to deploy, run, and administer **DG Repo** (your custom branded Document Management System) using Docker Compose.

---

## 📋 Prerequisites

Ensure the deployment server has the following installed:
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)

---

## 📁 Files Included in Repository

- **`docker-compose.yml`**: Configures the multi-container stack (webserver, PostgreSQL database, and Redis broker).
- **`docker-compose.env`**: Houses environment parameters, database connections, and custom branding settings.
- **`dg-media/logo-dg.svg`**: Your custom high-fidelity company logo, mounted directly into the container.

---

## 🚀 Step-by-Step Deployment

### Step 1: Spin Up Containers
Open a terminal in the folder containing `docker-compose.yml` and run:
```bash
docker compose up -d
```
This will automatically download the necessary images and start the PostgreSQL database, Redis task queue, and Paperless-ngx web application in detached mode.

### Step 2: Create Administrator Account
To create your first superuser account for logging in, run the following command:
```bash
docker compose run --rm webserver createsuperuser
```
Follow the prompts in the terminal to set:
1. **Username** (e.g. `admin`)
2. **Email address** (e.g. `admin@dg-repo.com`)
3. **Password** (must be secure)

### Step 3: Access the Interface
Once the containers are running and the superuser is created:
1. Open your web browser.
2. Navigate to **`http://localhost:8010`** (or the server's IP address on port `8010`).
3. Log in using the credentials you created in Step 2.
4. You will see the application header reads **"DG Repo"** with your custom folder/monogram logo in the top-left!

---

## 🎨 Custom Branding & Variables

To modify the branding in the future, open **`docker-compose.env`** and edit these variables:

- **`PAPERLESS_APP_TITLE`**: Controls the text shown in the browser tabs, headers, and metadata (currently set to `"DG Repo"`).
- **`PAPERLESS_APP_LOGO`**: Points to the absolute file path of your company logo SVG inside the container (currently mapped to `/usr/src/paperless/media/logo-dg.svg`).

*Note: After making changes to `docker-compose.env`, restart the stack using `docker compose down && docker compose up -d` to apply modifications.*

---

## 🔒 OneID SSO Configuration (Future Phase)

Paperless-ngx supports **OpenID Connect (OIDC)** and **OAuth2** authentication out-of-the-box using Django Allauth. When your IT team is ready to wire up your company's SSO, append these lines to `docker-compose.env`:

```ini
# Enable Social Login / OIDC
PAPERLESS_SOCIALACCOUNT_PROVIDERS='{"openid_connect": {"APPS": [{"provider_id": "oneid", "name": "OneID SSO", "client_id": "<YOUR_CLIENT_ID>", "secret": "<YOUR_CLIENT_SECRET>", "settings": {"server_url": "<YOUR_ONEID_REALM_URL>"}}]}}'
PAPERLESS_SOCIALACCOUNT_ONLY=true # Forces logins to go through SSO
```
This will replace the traditional login form with a secure single-sign-on redirect to your company's identity provider.
