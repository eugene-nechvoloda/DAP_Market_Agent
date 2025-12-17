# Railway Deployment Guide

This guide walks you through deploying the DAP Market Research Agent to Railway, including both the backend and the React UI web portal.

---

## Overview

Railway is a deployment platform that makes it easy to deploy full-stack applications. We'll deploy:
- ✅ Backend Mastra server (with API and workflows)
- ✅ React UI web portal
- ✅ PostgreSQL database
- ✅ Inngest workflow engine

---

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub account (to connect your repository)
- This repository pushed to GitHub

---

## Step-by-Step Deployment

### 1. Create Railway Account

1. Go to https://railway.app
2. Click **"Start a New Project"** or **"Login with GitHub"**
3. Authorize Railway to access your GitHub repositories

---

### 2. Create New Project

#### Option A: Deploy from GitHub (Recommended)

1. **In Railway Dashboard**:
   - Click **"New Project"**
   - Select **"Deploy from GitHub repo"**
   - Choose your repository: `eugene-nechvoloda/Replit_DAP_Market_Agent`
   - Select the branch: `claude/start-new-chat-qc44T` (or `main` after merging)

2. **Railway will auto-detect** the project and start deployment

#### Option B: Deploy with Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Link to your Railway project
railway link
```

---

### 3. Add PostgreSQL Database

Your application needs a PostgreSQL database:

1. **In your Railway project**:
   - Click **"New"** → **"Database"** → **"Add PostgreSQL"**
   - Railway will provision a PostgreSQL instance
   - Database credentials will be automatically added as environment variables

2. **Database environment variables** (automatically set):
   - `DATABASE_URL` - PostgreSQL connection string
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

---

### 4. Configure Environment Variables

Add all required environment variables in Railway:

1. **Go to your service** → **"Variables"** tab

2. **Add the following variables**:

```bash
# AI API Keys
AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_ANTHROPIC_API_KEY=your_anthropic_api_key
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com

# Search APIs
PERPLEXITY_API_KEY=your_perplexity_api_key
SERPAPI_API_KEY=your_serpapi_api_key

# Google APIs (for Google Docs export)
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_service_account_private_key
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id

# Slack Integration
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
SLACK_SIGNING_SECRET=your_slack_signing_secret

# Inngest
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=your_inngest_signing_key

# Node Environment
NODE_ENV=production
PORT=5000

# Database (automatically set by Railway PostgreSQL)
DATABASE_URL=postgresql://...
```

#### How to Add Variables:

- **Single variable**: Click **"New Variable"** → Enter name and value → Save
- **Bulk import**: Click **"RAW Editor"** → Paste all variables → Save

#### Important Notes:

- **GOOGLE_PRIVATE_KEY**: Must include `\n` for line breaks or use the RAW editor
- **DATABASE_URL**: Automatically set when you add PostgreSQL database
- **PORT**: Railway automatically sets this, but you can override to 5000

---

### 5. Configure Build Settings

Railway needs to know how to build your application:

1. **Go to your service** → **"Settings"** tab

2. **Build Configuration**:
   - **Build Command**:
     ```bash
     npm install && npm run build && npm run build:ui
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Root Directory**: `/` (or leave blank)

3. **Advanced Settings**:
   - **Node Version**: `20.9.0` or higher
   - **Install Command**: `npm install` (default)

---

### 6. Add Start Script to package.json

Railway needs a `start` script to run your production server.

**Add to `package.json`**:

```json
{
  "scripts": {
    "start": "mastra build && node .mastra/index.js",
    "dev": "mastra dev",
    "build": "mastra build",
    "build:ui": "tsc --project tsconfig.ui.json && vite build",
    // ... other scripts
  }
}
```

**Alternative Start Script** (if you want to separate build and start):

```json
{
  "scripts": {
    "start": "node .mastra/index.js",
    "build:all": "npm run build && npm run build:ui",
    // ... other scripts
  }
}
```

Then in Railway Settings, set:
- **Build Command**: `npm install && npm run build:all`
- **Start Command**: `npm start`

---

### 7. Deploy

1. **Push changes to GitHub**:
   ```bash
   git add package.json
   git commit -m "Add start script for Railway deployment"
   git push
   ```

2. **Railway auto-deploys** when you push to the connected branch

3. **Monitor deployment**:
   - Go to **"Deployments"** tab
   - Watch build logs in real-time
   - Check for errors

---

### 8. Access Your Application

Once deployed, Railway provides a public URL:

1. **Get your URL**:
   - Go to **"Settings"** → **"Networking"**
   - Click **"Generate Domain"**
   - You'll get a URL like: `your-app.railway.app`

2. **Access your application**:
   - **React UI**: `https://your-app.railway.app/react-dashboard`
   - **Classic UI**: `https://your-app.railway.app/api/dashboard`
   - **API**: `https://your-app.railway.app/api/*`

---

### 9. Setup Inngest (Workflow Engine)

Inngest is used for workflow orchestration. You have two options:

#### Option A: Use Railway-Hosted Inngest Endpoint

Your app exposes Inngest at `/api/inngest`. Configure Inngest to poll this endpoint:

1. **Go to Inngest Dashboard** (https://app.inngest.com)
2. **Create account** or login
3. **Create new app**
4. **Add event source**:
   - Type: **HTTP**
   - URL: `https://your-app.railway.app/api/inngest`
   - Event Key: (from Railway env `INNGEST_EVENT_KEY`)
   - Signing Key: (from Railway env `INNGEST_SIGNING_KEY`)

#### Option B: Deploy Inngest Dev Server Separately

Deploy Inngest dev server as a separate Railway service (advanced).

---

### 10. Setup Cron Jobs (Weekly Reports)

Your workflow runs on a cron schedule (`0 7 * * 1` = every Monday at 7 AM UTC).

Railway supports cron through Inngest:

1. **In Inngest Dashboard**:
   - Go to your app → **Functions**
   - Find `weeklyMarketResearch` function
   - Ensure cron trigger is registered

2. **Test manually**:
   - Use the React UI at `/react-dashboard`
   - Click **"Generate Report Now"**

---

### 11. Configure Custom Domain (Optional)

1. **In Railway**:
   - Go to **"Settings"** → **"Networking"**
   - Click **"Custom Domain"**
   - Add your domain: `dap-research.yourdomain.com`

2. **In your DNS provider**:
   - Add CNAME record:
     - Name: `dap-research`
     - Value: `your-app.railway.app`
   - Wait for DNS propagation (5-60 minutes)

3. **Access your app**:
   - `https://dap-research.yourdomain.com/react-dashboard`

---

## Environment-Specific Configuration

### Production vs Development

Railway automatically sets `NODE_ENV=production`. Your app should handle this:

```typescript
// In your code
const isProd = process.env.NODE_ENV === 'production';

// Use production logger
if (isProd) {
  logger = new ProductionPinoLogger();
} else {
  logger = new PinoLogger();
}
```

---

## Database Migrations

If you have database migrations, run them after deployment:

### Option 1: Railway CLI

```bash
# Connect to your Railway project
railway link

# Run migrations
railway run npm run db:migrate
```

### Option 2: Add to Build Command

Add migrations to your build command:

```bash
npm install && npm run build && npm run build:ui && npm run db:migrate
```

**Example migration script** in `package.json`:

```json
{
  "scripts": {
    "db:migrate": "drizzle-kit push:pg"
  }
}
```

---

## Monitoring & Debugging

### View Logs

1. **In Railway Dashboard**:
   - Go to your service
   - Click **"Deployments"** → Select deployment
   - View **"Logs"** tab

2. **Using Railway CLI**:
   ```bash
   railway logs
   ```

### Common Issues

#### 1. Build Fails

**Problem**: `npm run build:ui` fails with TypeScript errors

**Solution**:
- Check TypeScript errors locally: `npm run build:ui`
- Fix type errors in React components
- Push fixed code

#### 2. Database Connection Fails

**Problem**: `Error: connect ECONNREFUSED`

**Solution**:
- Ensure PostgreSQL database is added in Railway
- Check `DATABASE_URL` environment variable is set
- Verify database is in same Railway project

#### 3. React UI Shows "Not Built"

**Problem**: Visiting `/react-dashboard` shows setup instructions

**Solution**:
- Ensure build command includes: `npm run build:ui`
- Check `dist/ui/` directory exists in deployment
- Verify Vite build completed successfully

#### 4. API Keys Missing

**Problem**: `Error: API key not configured`

**Solution**:
- Check all environment variables are set in Railway
- Verify variable names match exactly (case-sensitive)
- Redeploy after adding variables

---

## Performance Optimization

### 1. Enable Health Checks

Add a health check endpoint:

```typescript
// In your routes
registerApiRoute('/health', {
  method: 'GET',
  handler: async (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
  },
});
```

Configure in Railway:
- **Settings** → **Healthcheck Path**: `/health`

### 2. Optimize Build

Use caching for faster builds:

```json
{
  "scripts": {
    "build:ui": "tsc --project tsconfig.ui.json --incremental && vite build"
  }
}
```

### 3. Enable Compression

Railway automatically enables gzip compression for responses.

---

## Scaling

### Vertical Scaling

1. **In Railway**:
   - Go to **"Settings"** → **"Resources"**
   - Adjust:
     - **vCPU**: Increase for CPU-intensive tasks
     - **RAM**: Increase for memory-intensive workflows

### Horizontal Scaling

Railway Pro supports multiple instances (replicas) for high availability.

---

## Cost Estimation

**Railway Pricing** (as of 2025):

- **Free Tier**: $5 usage credit/month
  - Good for testing/development
  - 512 MB RAM, shared CPU

- **Pro Plan**: $20/month + usage
  - Up to 8 GB RAM per service
  - Dedicated resources
  - Custom domains

**Estimated Monthly Cost** for this app:
- **Database**: ~$5-10/month
- **Backend Service**: ~$10-15/month
- **Total**: ~$20-30/month (with Pro plan)

---

## Security Best Practices

### 1. Environment Variables

✅ Store all secrets in Railway environment variables
❌ Never commit API keys to Git

### 2. HTTPS

✅ Railway provides free SSL certificates
✅ All traffic is encrypted by default

### 3. API Rate Limiting

Add rate limiting to your API endpoints:

```typescript
// Example: Rate limiting middleware (to implement)
const rateLimit = new Map();

const rateLimitMiddleware = async (c, next) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  const requests = rateLimit.get(ip) || 0;

  if (requests > 100) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }

  rateLimit.set(ip, requests + 1);
  await next();
};
```

---

## Maintenance

### Regular Tasks

1. **Update Dependencies**:
   ```bash
   npm update
   git add package.json package-lock.json
   git commit -m "Update dependencies"
   git push
   ```

2. **Monitor Logs**:
   - Check Railway logs weekly for errors
   - Set up alerts for critical errors

3. **Backup Database**:
   ```bash
   railway run pg_dump $DATABASE_URL > backup.sql
   ```

---

## Troubleshooting

### Check Deployment Status

```bash
# Using Railway CLI
railway status

# View logs
railway logs --tail

# SSH into container (Pro plan)
railway shell
```

### Test Endpoints

```bash
# Health check
curl https://your-app.railway.app/health

# React UI
curl https://your-app.railway.app/react-dashboard

# API endpoint
curl https://your-app.railway.app/api/react/history-list
```

---

## Next Steps

After deployment:

1. ✅ Test React UI at `/react-dashboard`
2. ✅ Generate a test report manually
3. ✅ Verify Google Docs export works
4. ✅ Check Slack notifications
5. ✅ Monitor cron job (Monday 7 AM UTC)
6. ✅ Set up custom domain (optional)
7. ✅ Configure monitoring/alerts

---

## Additional Resources

- [Railway Documentation](https://docs.railway.app)
- [Railway CLI](https://docs.railway.app/develop/cli)
- [Inngest Documentation](https://www.inngest.com/docs)
- [Mastra Documentation](https://mastra.ai/docs)

---

## Support

If you encounter issues:

1. Check Railway deployment logs
2. Review this guide's troubleshooting section
3. Check Railway community: https://railway.app/community
4. Review Mastra docs: https://mastra.ai/docs

---

## Summary

**Quick Deployment Checklist**:

- [ ] Create Railway account
- [ ] Connect GitHub repository
- [ ] Add PostgreSQL database
- [ ] Set environment variables (API keys, etc.)
- [ ] Configure build command: `npm install && npm run build && npm run build:ui`
- [ ] Configure start command: `npm start`
- [ ] Add start script to package.json
- [ ] Push changes to GitHub
- [ ] Wait for deployment to complete
- [ ] Generate Railway domain
- [ ] Test React UI at `/react-dashboard`
- [ ] Configure Inngest event source
- [ ] Set up cron jobs
- [ ] Add custom domain (optional)

You're ready to deploy! 🚀
