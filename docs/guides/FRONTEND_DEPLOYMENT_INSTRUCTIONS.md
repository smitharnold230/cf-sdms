# 🌐 Frontend Deployment Guide

## Option 1: Deploy via Cloudflare Dashboard (Recommended)

### Step 1: Go to Cloudflare Pages
1. Visit: https://dash.cloudflare.com
2. Navigate to "Pages" in the sidebar
3. Click "Create a project"

### Step 2: Connect GitHub Repository  
1. Select "Connect to Git"
2. Choose your GitHub account
3. Select repository: **cf-sdms**
4. Click "Begin setup"

### Step 3: Configure Build Settings
- **Project name**: `sdms-frontend`
- **Production branch**: `main`
- **Framework preset**: Next.js
- **Build command**: `cd frontend && npm ci && npm run build`
- **Build output directory**: `frontend/.next`
- **Root directory**: `/` (leave empty)

### Step 4: Environment Variables
Add this environment variable:
- **Variable name**: `NEXT_PUBLIC_API_URL`
- **Value**: `https://student-db-ms.smitharnold230.workers.dev`

### Step 5: Deploy
Click "Save and Deploy"

---

## Option 2: Deploy via Wrangler CLI

Run these commands in your terminal:

```bash
# Deploy frontend using Wrangler Pages
npx wrangler pages project create sdms-frontend
npx wrangler pages publish frontend/.next --project-name=sdms-frontend
```

---

## What You'll Get

After deployment, you'll have:

### 🎯 **Complete Web Application**
- **Login/Authentication** pages
- **Student Dashboard** with points tracking  
- **Faculty Review Interface** for approvals
- **Admin Analytics** dashboard
- **Notification Center** with real-time updates
- **Responsive Design** that works on all devices

### 🔗 **URLs**
- **Frontend**: https://sdms-frontend.pages.dev (or custom domain)
- **Backend API**: https://student-db-ms.smitharnold230.workers.dev

### 🚀 **Features Working**
- ✅ **User Authentication** with role-based access
- ✅ **Real-time Notifications** via WebSocket
- ✅ **File Upload/Download** with R2 storage  
- ✅ **Certificate Management** workflow
- ✅ **Event Registration** system
- ✅ **Analytics Dashboard** with charts
- ✅ **Mobile-Responsive** design

---

## 🎊 **Your Complete System**

Once deployed, you'll have a **full-stack Student Database Management System**:

1. **Backend**: Cloudflare Workers with D1, KV, R2, Durable Objects
2. **Frontend**: Next.js deployed on Cloudflare Pages  
3. **Database**: D1 SQLite with complete schema
4. **Storage**: R2 for file uploads
5. **Real-time**: Durable Objects for notifications
6. **Security**: JWT authentication with role-based access
7. **CI/CD**: GitHub Actions for automated deployment

**Professional, production-ready system at global scale!** 🌍