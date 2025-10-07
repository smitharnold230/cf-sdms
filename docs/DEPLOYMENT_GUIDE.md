# Production Deployment Guide

This guide walks you through deploying the Student Database Management System to production.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with access to:
   - Workers (paid plan for production)
   - D1 Database
   - R2 Storage
   - KV Storage

2. **Wrangler CLI**: Install globally
   ```bash
   npm install -g wrangler
   ```

3. **Authentication**: Log in to Cloudflare
   ```bash
   wrangler login
   ```

## Automated Deployment

### Using PowerShell Script (Windows)
```powershell
.\scripts\deploy.ps1
```

### Using Bash Script (Linux/macOS)
```bash
./scripts/deploy.sh
```

### Dry Run (Preview changes without applying)
```powershell
.\scripts\deploy.ps1 -DryRun
```

## Manual Deployment Steps

### 1. Create Cloudflare Resources

#### D1 Database
```bash
wrangler d1 create student_db
```
Copy the database ID and update `wrangler.toml`:
```toml
database_id = "your-database-id-here"
```

#### R2 Bucket
```bash
wrangler r2 bucket create student-certificates
```

#### KV Namespace
```bash
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```
Update `wrangler.toml` with the namespace IDs.

### 2. Apply Database Migrations
```bash
wrangler d1 migrations apply student_db
```

### 3. Set Environment Secrets
Set the following secrets using `wrangler secret put <KEY>`:

#### Required Secrets
- `JWT_SECRET`: Strong random key (256-bit recommended)
  ```bash
  # Generate a secure key
  openssl rand -base64 32
  wrangler secret put JWT_SECRET
  ```

#### Optional but Recommended
- `SENDGRID_API_KEY`: For email notifications
- `TWILIO_ACCOUNT_SID`: For SMS notifications  
- `TWILIO_AUTH_TOKEN`: For SMS notifications
- `VIRUS_SCAN_API_KEY`: VirusTotal API key for file scanning

### 4. Deploy the Worker
```bash
wrangler deploy
```

### 5. Deploy the Frontend

#### Build the Frontend
```bash
cd frontend
npm install
npm run build
```

#### Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy dist --project-name sdms-frontend
```

#### Or Deploy to Other Platforms
- **Vercel**: `npx vercel`
- **Netlify**: `npx netlify deploy --prod`
- **AWS S3**: Use AWS CLI or console

## Environment Configuration

### Backend Environment Variables (wrangler.toml)
```toml
[vars]
JWT_ALG = "HS256"
TOKEN_TTL_SECONDS = 3600
SENDGRID_FROM_EMAIL = "noreply@yourdomain.com"
SENDGRID_FROM_NAME = "Student Development Management System"
APP_BASE_URL = "https://your-worker.your-subdomain.workers.dev"
ENVIRONMENT = "production"
LOG_LEVEL = "info"
VIRUS_SCAN_ENABLED = "true"
```

### Frontend Environment Variables (.env.production)
```env
NEXT_PUBLIC_API_URL=https://your-worker.your-subdomain.workers.dev
NEXT_PUBLIC_APP_NAME=Student Development Management System
NEXT_PUBLIC_ENVIRONMENT=production
```

## Post-Deployment Verification

### 1. Test API Endpoints
```bash
node test-endpoints.js
```

### 2. Check Worker Logs
```bash
wrangler tail
```

### 3. Test Database Connection
```bash
# List tables to verify migrations
wrangler d1 execute student_db --command "SELECT name FROM sqlite_master WHERE type='table';"
```

### 4. Test File Upload
```bash
# Upload a test file
curl -X POST "https://your-worker.workers.dev/certificates/upload" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/pdf" \
  --data-binary @test-certificate.pdf
```

## Security Checklist

- [ ] All secrets are set and secure
- [ ] JWT secret is strong and unique
- [ ] Database is not publicly accessible
- [ ] R2 bucket has proper access controls
- [ ] Rate limiting is enabled
- [ ] Virus scanning is configured
- [ ] CORS is properly configured
- [ ] Error messages don't leak sensitive information

## Monitoring and Maintenance

### Set Up Alerting
Configure webhooks for system alerts:
```bash
wrangler secret put ALERT_WEBHOOK_URL
```

### Monitor Performance
- Use Cloudflare Analytics
- Set up custom dashboards
- Monitor error rates and response times

### Regular Maintenance
- Review and rotate secrets monthly
- Update dependencies regularly
- Monitor storage usage (D1/R2/KV)
- Review access logs for security

## Troubleshooting

### Common Issues

1. **Database Migration Failures**
   ```bash
   # Check migration status
   wrangler d1 migrations list student_db
   
   # Manually apply a specific migration
   wrangler d1 execute student_db --file=migrations/001_init.sql
   ```

2. **Secret Not Found Errors**
   ```bash
   # List all secrets
   wrangler secret list
   
   # Update a secret
   wrangler secret put SECRET_NAME
   ```

3. **CORS Issues**
   - Verify CORS headers in the worker
   - Check frontend API URL configuration

4. **File Upload Issues**
   - Verify R2 bucket permissions
   - Check file size limits
   - Ensure virus scanning is configured

### Getting Help

- Check worker logs: `wrangler tail`
- Review Cloudflare dashboard
- Check GitHub issues
- Review API documentation

## Rollback Plan

### Worker Rollback
```bash
# List deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

### Database Rollback
- Keep backups of your D1 database
- Test migrations on staging first
- Have rollback SQL scripts ready

### Frontend Rollback
- Keep previous build artifacts
- Use your hosting platform's rollback features
- Maintain staging environments for testing

## Performance Optimization

### Worker Optimization
- Enable compression in R2
- Use proper caching headers
- Optimize database queries
- Use batch operations where possible

### Frontend Optimization
- Enable CDN caching
- Optimize bundle sizes
- Use proper image formats
- Implement service workers for offline support

## Scaling Considerations

### Database Scaling
- Monitor D1 usage limits
- Optimize queries and indexes
- Consider read replicas for heavy read workloads

### Storage Scaling
- Monitor R2 usage and costs
- Implement file cleanup policies
- Use R2 lifecycle rules

### Worker Scaling
- Workers auto-scale, but monitor costs
- Optimize cold start performance
- Consider Durable Objects for stateful operations