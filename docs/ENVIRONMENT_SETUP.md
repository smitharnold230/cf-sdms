# Environment Variables Configuration Guide

This document outlines the required environment variables for each deployment environment.

## Required Secrets in GitHub Actions

### Core Cloudflare Configuration
```
CLOUDFLARE_API_TOKEN=your-api-token-here
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
```

### JWT Configuration (per environment)
```
JWT_SECRET_DEV=your-dev-jwt-secret
JWT_SECRET_STAGING=your-staging-jwt-secret  
JWT_SECRET_PRODUCTION=your-production-jwt-secret
```

### SendGrid Email Service (per environment)
```
SENDGRID_API_KEY_DEV=your-dev-sendgrid-key
SENDGRID_API_KEY_STAGING=your-staging-sendgrid-key
SENDGRID_API_KEY_PRODUCTION=your-production-sendgrid-key
```

### Twilio SMS Service (per environment)
```
TWILIO_ACCOUNT_SID_DEV=your-dev-twilio-sid
TWILIO_AUTH_TOKEN_DEV=your-dev-twilio-token
TWILIO_ACCOUNT_SID_STAGING=your-staging-twilio-sid
TWILIO_AUTH_TOKEN_STAGING=your-staging-twilio-token
TWILIO_ACCOUNT_SID_PRODUCTION=your-production-twilio-sid
TWILIO_AUTH_TOKEN_PRODUCTION=your-production-twilio-token
```

### Optional Monitoring & Notifications
```
SLACK_WEBHOOK_URL=your-slack-webhook-for-notifications
ALERT_WEBHOOK_URL=your-alert-webhook-for-critical-issues
ANALYTICS_TOKEN=your-analytics-service-token
```

## Setting up GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with the corresponding name and value

## Environment-specific Configuration

### Development Environment
- Uses separate database: `student-db-dev`
- Uses separate KV namespace: `RATE_LIMIT_KV_DEV`
- Uses separate R2 bucket: `student-certificates-dev`
- Relaxed rate limits for testing
- Detailed logging enabled

### Staging Environment  
- Uses separate database: `student-db-staging`
- Production-like configuration
- Integration testing enabled
- Performance monitoring active

### Production Environment
- Uses main database: `student-db`
- Strict rate limits
- Full monitoring and alerting
- Manual approval required for deployment

## Local Development Setup

Create a `.env` file in your project root:

```bash
# Copy from .env.example
cp .env.example .env

# Edit with your local values
JWT_SECRET=your-local-jwt-secret
SENDGRID_API_KEY=your-sendgrid-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
APP_BASE_URL=http://localhost:8787
```

## Cloudflare Dashboard Configuration

### D1 Database IDs
Update `wrangler.toml` with actual database IDs after creation:

```toml
[[d1_databases]]
binding = "DB"
database_name = "student_db"
database_id = "your-actual-database-id"
```

### KV Namespace IDs
Update with actual KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-actual-kv-id"
preview_id = "your-actual-preview-kv-id"
```

## Security Best Practices

1. **Rotate Secrets Regularly**: Update all secrets quarterly
2. **Use Different Keys per Environment**: Never share secrets between environments
3. **Limit API Token Permissions**: Only grant necessary Cloudflare permissions
4. **Monitor Secret Usage**: Track when secrets are accessed
5. **Use GitHub Environment Protection**: Require reviews for production deployments

## Troubleshooting

### Common Issues

1. **API Token Permissions**: Ensure Cloudflare API token has:
   - Zone:Zone:Read
   - Account:Cloudflare Workers:Edit
   - Account:D1:Edit
   - Account:R2:Edit

2. **Database ID Mismatch**: Check that database IDs in wrangler.toml match actual database IDs

3. **Environment Variable Not Found**: Verify secret names match exactly (case-sensitive)

4. **Rate Limit Issues**: Check KV namespace is properly configured and accessible

### Getting Resource IDs

```bash
# Get database ID
wrangler d1 list

# Get KV namespace ID
wrangler kv:namespace list

# Get R2 bucket list
wrangler r2 bucket list

# Get account ID
wrangler whoami
```