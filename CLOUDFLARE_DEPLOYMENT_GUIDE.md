# 🚀 Complete Cloudflare Deployment Guide

## 📋 Prerequisites

### 1. Cloudflare Account Setup
1. **Create Account**: Go to [https://cloudflare.com](https://cloudflare.com) and sign up
2. **Verify Email**: Check your email and verify your account
3. **Choose Plan**: Free plan is sufficient for development/testing

### 2. Install Wrangler CLI
```bash
# Install Wrangler globally
npm install -g wrangler

# Verify installation
wrangler --version
```

### 3. Login to Cloudflare
```bash
# This will open a browser to authenticate
wrangler login

# Verify you're logged in
wrangler whoami
```

## 🗃️ Step 1: Create D1 Database

D1 is Cloudflare's SQLite database service.

```bash
# Create the database
wrangler d1 create student_db

# This will output something like:
# ✅ Successfully created DB 'student_db' in region WEUR
# Created your database using D1's new storage backend.
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "student_db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy the `database_id` - you'll need it!**

### Initialize Database Schema
```bash
# Run migrations to create tables
wrangler d1 execute student_db --file=./migrations/001_init.sql
wrangler d1 execute student_db --file=./migrations/002_expand_schema.sql
wrangler d1 execute student_db --file=./migrations/003_file_management.sql
wrangler d1 execute student_db --file=./migrations/004_notification_system.sql
```

## 🗂️ Step 2: Create KV Namespaces

KV is Cloudflare's key-value storage for caching and rate limiting.

```bash
# Create rate limiting KV namespace
wrangler kv:namespace create "RATE_LIMIT_KV"
# Output: 🌀 Creating namespace with title "student-db-ms-RATE_LIMIT_KV"
# ✅ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "RATE_LIMIT_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }

# Create caching KV namespace  
wrangler kv:namespace create "CACHE_KV"
# Output: 🌀 Creating namespace with title "student-db-ms-CACHE_KV"
# ✅ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "CACHE_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }

# Create preview namespaces for development
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
wrangler kv:namespace create "CACHE_KV" --preview
```

**Copy all the IDs - you'll need them for wrangler.toml!**

## 📦 Step 3: Create R2 Bucket

R2 is Cloudflare's object storage for files.

```bash
# Create the bucket for certificate storage
wrangler r2 bucket create student-certificates

# Verify bucket was created
wrangler r2 bucket list
```

## 🔧 Step 4: Update wrangler.toml Configuration

Open your `wrangler.toml` file and update it with the IDs you copied:

```toml
name = "student-db-ms"
main = "src/index.ts"
compatibility_date = "2025-10-05"

# D1 database binding
[[d1_databases]]
binding = "DB"
database_name = "student_db"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID

# R2 bucket binding
[[r2_buckets]]
binding = "CERT_BUCKET"
bucket_name = "student-certificates"

# KV namespace for rate limiting
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "YOUR_RATE_LIMIT_KV_ID_HERE"      # Replace with actual ID
preview_id = "YOUR_RATE_LIMIT_PREVIEW_ID_HERE"  # Replace with actual ID

# KV namespace for caching
[[kv_namespaces]]
binding = "CACHE_KV"
id = "YOUR_CACHE_KV_ID_HERE"           # Replace with actual ID
preview_id = "YOUR_CACHE_PREVIEW_ID_HERE"     # Replace with actual ID

# Durable Objects
[[durable_objects.bindings]]
name = "NOTIFICATION_MANAGER"
class_name = "NotificationManager"

# Environment variables (non-sensitive)
[vars]
JWT_ALG = "HS256"
TOKEN_TTL_SECONDS = 3600
SENDGRID_FROM_EMAIL = "noreply@yourdomain.com"  # Update with your domain
SENDGRID_FROM_NAME = "Student Development Management System"
TWILIO_FROM_NUMBER = "+1234567890"
APP_BASE_URL = "https://student-db-ms.YOUR_SUBDOMAIN.workers.dev"  # Will be updated after deploy
ENVIRONMENT = "production"
LOG_LEVEL = "info"

# Durable Object migrations
[[migrations]]
tag = "v1"
new_classes = ["NotificationManager"]
```

## 🔐 Step 5: Set Up Secrets

Secrets are sensitive data that shouldn't be in your code.

### Required Secrets:

```bash
# JWT Secret (generate a strong random key)
wrangler secret put JWT_SECRET
# When prompted, enter a strong random string (64+ characters)

# SendGrid API Key (for email notifications)
wrangler secret put SENDGRID_API_KEY
# Enter your SendGrid API key (get from https://sendgrid.com)

# VirusTotal API Key (for file scanning - optional)
wrangler secret put VIRUS_SCAN_API_KEY
# Enter your VirusTotal API key (get from https://virustotal.com)

# Optional: Twilio for SMS (if you want SMS notifications)
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
```

### How to get API keys:

#### SendGrid (Email):
1. Go to [https://sendgrid.com](https://sendgrid.com)
2. Sign up for free account
3. Go to Settings → API Keys
4. Create new API key with "Full Access"
5. Copy the key and use it in `wrangler secret put SENDGRID_API_KEY`

#### VirusTotal (File Scanning):
1. Go to [https://virustotal.com](https://virustotal.com)
2. Sign up for free account
3. Go to your profile → API Key
4. Copy the key and use it in `wrangler secret put VIRUS_SCAN_API_KEY`

## 🌐 Step 6: Deploy to Cloudflare Workers

```bash
# First, test the deployment locally
wrangler dev

# If everything works locally, deploy to production
wrangler deploy

# You should see output like:
# Total Upload: 532.84 KiB / gzip: 121.45 KiB
# Uploaded student-db-ms (2.34 sec)
# Published student-db-ms (6.21 sec)
#   https://student-db-ms.YOUR_SUBDOMAIN.workers.dev
```

**Copy the deployed URL - this is your API endpoint!**

## 🌍 Step 7: Set Up Custom Domain (Optional)

### If you have a domain:
1. **Add Domain to Cloudflare**:
   - Go to Cloudflare Dashboard
   - Click "Add Site"
   - Enter your domain
   - Follow DNS setup instructions

2. **Add Worker Route**:
   ```bash
   # Add a route for your worker
   wrangler route add "api.yourdomain.com/*" student-db-ms
   ```

### Update Configuration:
Update your `APP_BASE_URL` in wrangler.toml:
```bash
wrangler secret put APP_BASE_URL
# Enter: https://api.yourdomain.com (or your workers.dev URL)
```

## 🖥️ Step 8: Deploy Frontend (Cloudflare Pages)

Your frontend is in the `/frontend` directory.

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build the frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=student-db-frontend

# Or using the Pages dashboard:
# 1. Go to Cloudflare Dashboard > Pages
# 2. Connect your GitHub repository
# 3. Set build command: npm run build
# 4. Set build output directory: dist
# 5. Deploy
```

### Configure Frontend Environment:
Create `frontend/.env.production`:
```env
NEXT_PUBLIC_API_URL=https://student-db-ms.YOUR_SUBDOMAIN.workers.dev
NEXT_PUBLIC_APP_NAME=Student Database Management System
```

## 🔍 Step 9: Verify Deployment

### Test API Endpoints:
```bash
# Test health check
curl https://student-db-ms.YOUR_SUBDOMAIN.workers.dev/

# Test monitoring
curl https://student-db-ms.YOUR_SUBDOMAIN.workers.dev/monitoring/health

# Test database connection
curl https://student-db-ms.YOUR_SUBDOMAIN.workers.dev/users
```

### Check Logs:
```bash
# View real-time logs
wrangler tail

# Or view logs in Cloudflare Dashboard > Workers > student-db-ms > Logs
```

## 📊 Step 10: Set Up Monitoring

### Cloudflare Analytics:
1. Go to Cloudflare Dashboard
2. Navigate to Workers > student-db-ms
3. Check the Analytics tab for usage metrics

### Custom Monitoring:
Your app includes built-in monitoring endpoints:
- Health: `https://your-worker.workers.dev/monitoring/health`
- Metrics: `https://your-worker.workers.dev/monitoring/metrics`

## 🛠️ Useful Commands

### Development:
```bash
# Run locally with real Cloudflare resources
wrangler dev

# Run with local database
wrangler dev --local

# View logs
wrangler tail
```

### Database Management:
```bash
# Query database
wrangler d1 execute student_db --command="SELECT * FROM users LIMIT 5"

# Backup database
wrangler d1 export student_db --output=backup.sql

# Restore database
wrangler d1 execute student_db --file=backup.sql
```

### KV Management:
```bash
# List keys
wrangler kv:key list --binding=RATE_LIMIT_KV

# Get value
wrangler kv:key get "some-key" --binding=RATE_LIMIT_KV

# Set value
wrangler kv:key put "some-key" "some-value" --binding=RATE_LIMIT_KV
```

### R2 Management:
```bash
# List objects
wrangler r2 object list student-certificates

# Upload file
wrangler r2 object put student-certificates/test.pdf --file=./test.pdf

# Download file
wrangler r2 object get student-certificates/test.pdf --file=./downloaded.pdf
```

## 🔧 Troubleshooting

### Common Issues:

1. **"Unknown binding" errors**:
   - Make sure all IDs in wrangler.toml are correct
   - Redeploy: `wrangler deploy`

2. **Database errors**:
   - Check if migrations ran: `wrangler d1 execute student_db --command="SELECT name FROM sqlite_master WHERE type='table'"`
   - Re-run migrations if needed

3. **Permission errors**:
   - Make sure you're logged in: `wrangler whoami`
   - Check account permissions in Cloudflare Dashboard

4. **Secret errors**:
   - List secrets: `wrangler secret list`
   - Re-add missing secrets: `wrangler secret put SECRET_NAME`

### Getting Help:
- Cloudflare Discord: [https://discord.gg/cloudflaredev](https://discord.gg/cloudflaredev)
- Documentation: [https://developers.cloudflare.com](https://developers.cloudflare.com)
- Community Forum: [https://community.cloudflare.com](https://community.cloudflare.com)

## 🎉 Congratulations!

Once deployed, you'll have a fully functional Student Database Management System running on Cloudflare's edge network with:

- ✅ **Global CDN** - Fast worldwide access
- ✅ **Serverless Database** - D1 SQLite database
- ✅ **File Storage** - R2 object storage
- ✅ **Caching** - KV for performance
- ✅ **Real-time Features** - Durable Objects for WebSockets
- ✅ **Email Notifications** - SendGrid integration
- ✅ **File Scanning** - VirusTotal integration
- ✅ **Monitoring** - Built-in health checks and metrics

Your application will be available at:
- **API**: `https://student-db-ms.YOUR_SUBDOMAIN.workers.dev`
- **Frontend**: `https://student-db-frontend.pages.dev`

**Total deployment time: ~30 minutes** ⚡