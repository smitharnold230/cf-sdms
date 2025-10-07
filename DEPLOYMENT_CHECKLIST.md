# ✅ Cloudflare Deployment Checklist

## 🎯 Quick Start (30 minutes)

### Step 1: Prerequisites (5 minutes)
- [ ] Create Cloudflare account at [cloudflare.com](https://cloudflare.com)
- [ ] Install Wrangler CLI: `npm install -g wrangler`
- [ ] Login to Cloudflare: `wrangler login`
- [ ] Verify login: `wrangler whoami`

### Step 2: Automated Deployment (20 minutes)
Run the automated deployment script:

```powershell
# Run the deployment script
.\scripts\deploy-cloudflare.ps1

# Or with dry run to see what it would do:
.\scripts\deploy-cloudflare.ps1 -DryRun
```

The script will:
- ✅ Create D1 database
- ✅ Create KV namespaces 
- ✅ Create R2 bucket
- ✅ Update wrangler.toml automatically
- ✅ Run database migrations
- ✅ Prompt for secrets setup
- ✅ Deploy your application

### Step 3: Get API Keys (5 minutes)

#### SendGrid (Email notifications):
1. Go to [sendgrid.com](https://sendgrid.com) → Sign up free
2. Settings → API Keys → Create API Key
3. Choose "Full Access" → Create & Review
4. Copy the key when prompted by deployment script

#### VirusTotal (File scanning - optional):
1. Go to [virustotal.com](https://virustotal.com) → Sign up free  
2. Profile → API Key
3. Copy the key when prompted by deployment script

### Step 4: Test Deployment
- [ ] Visit your deployed URL (script will show it)
- [ ] Test API: `curl https://your-worker.workers.dev/`
- [ ] Check health: `curl https://your-worker.workers.dev/monitoring/health`

## 🎉 That's it! Your app is live!

---

## 📋 Manual Steps (if you prefer)

### 1. Create Resources

```bash
# Create database
wrangler d1 create student_db

# Create KV namespaces
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
wrangler kv:namespace create "CACHE_KV"  
wrangler kv:namespace create "CACHE_KV" --preview

# Create R2 bucket
wrangler r2 bucket create student-certificates
```

### 2. Update wrangler.toml
Copy the IDs from the output above and paste them into `wrangler.toml`:

```toml
# Replace the empty IDs with actual IDs:
database_id = "your-actual-database-id"
id = "your-actual-kv-id"
preview_id = "your-actual-preview-id"
```

### 3. Run Migrations
```bash
wrangler d1 execute student_db --file=./migrations/001_init.sql
wrangler d1 execute student_db --file=./migrations/002_expand_schema.sql
wrangler d1 execute student_db --file=./migrations/003_file_management.sql
wrangler d1 execute student_db --file=./migrations/004_notification_system.sql
```

### 4. Set Secrets
```bash
wrangler secret put JWT_SECRET
wrangler secret put SENDGRID_API_KEY
wrangler secret put VIRUS_SCAN_API_KEY
```

### 5. Deploy
```bash
wrangler deploy
```

---

## 🚨 Troubleshooting

### Common Issues:

❌ **"Command not found: wrangler"**
```bash
npm install -g wrangler
```

❌ **"Not authenticated"**
```bash
wrangler login
```

❌ **"Unknown binding" errors**
- Check wrangler.toml has correct IDs
- Redeploy: `wrangler deploy`

❌ **Database errors**
```bash
# Check tables exist:
wrangler d1 execute student_db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

❌ **Secrets not working**
```bash
# List current secrets:
wrangler secret list

# Re-add if missing:
wrangler secret put SECRET_NAME
```

### Need Help?
- 📖 Full guide: See `CLOUDFLARE_DEPLOYMENT_GUIDE.md`
- 💬 Cloudflare Discord: [discord.gg/cloudflaredev](https://discord.gg/cloudflaredev)
- 📚 Docs: [developers.cloudflare.com](https://developers.cloudflare.com)

---

## 🎯 What You'll Have After Deployment

- **🌍 Global API**: Your backend running on Cloudflare's edge
- **🗄️ Database**: SQLite database with all your tables
- **📦 File Storage**: R2 bucket for certificate uploads
- **⚡ Caching**: KV namespaces for performance
- **📧 Email**: SendGrid integration for notifications
- **🛡️ Security**: File scanning and authentication
- **📊 Monitoring**: Built-in health checks and metrics

**Total deployment time: ~30 minutes** ⚡

## 🚀 Ready to Deploy?

Choose your method:
- **🤖 Automated**: Run `.\scripts\deploy-cloudflare.ps1`
- **👤 Manual**: Follow the manual steps above
- **📖 Detailed**: Read the full `CLOUDFLARE_DEPLOYMENT_GUIDE.md`