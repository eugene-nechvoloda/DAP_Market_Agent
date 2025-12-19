# How to Access Your API Keys for Railway Deployment

This guide explains how to get your API keys from Replit Secrets and transfer them to Railway.

---

## Understanding the Situation

Your API keys are stored in **Replit Secrets**, which is a secure storage system that:
- ✅ Is accessible to your **running Replit app** (the server process)
- ❌ Is NOT accessible to external tools like Claude Code for security reasons
- ✅ Can be accessed through the **Replit web interface**

You have **two methods** to transfer your keys to Railway:

---

## Method 1: Automated Export (Recommended) ⚡

This method uses a temporary API endpoint to export all your keys in the exact format Railway needs.

### Step 1: Start Your Replit App

1. **In Replit**, click the **"Run"** button to start your application
2. Wait for the server to start (you should see "Server running on port 5000")
3. Your app should be accessible at `https://your-repl-name.your-username.repl.co`

### Step 2: Access the Export Endpoint

1. **Open a new browser tab**
2. Navigate to: `https://your-repl-name.your-username.repl.co/export-secrets`
3. You'll see all your environment variables in Railway format:

```bash
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
PERPLEXITY_API_KEY=pplx-...
SERPAPI_API_KEY=...
GOOGLE_CLIENT_EMAIL=...@...iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_FOLDER_ID=...
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
DATABASE_URL=postgresql://...
```

### Step 3: Copy to Railway

1. **Select ALL the text** on the page (Ctrl+A / Cmd+A)
2. **Copy** it (Ctrl+C / Cmd+C)
3. **Go to Railway Dashboard** → Your Project → Service
4. Click **"Variables"** tab
5. Click **"RAW Editor"** button (top right)
6. **Paste** the copied text
7. Click **"Update Variables"**
8. **Redeploy** (Railway will automatically redeploy with new variables)

### Step 4: Security - Delete the Export Endpoint

⚠️ **IMPORTANT**: After you've copied your keys, delete the temporary export endpoint:

1. Remove the route from `/src/mastra/index.ts`:
   ```typescript
   // DELETE THESE LINES:
   import { exportSecretsRoute } from "../../TEMP_export_secrets";

   // ... and in apiRoutes array:
   exportSecretsRoute,
   ```

2. Delete the file: `/TEMP_export_secrets.ts`

3. Commit and push:
   ```bash
   git add src/mastra/index.ts
   git rm TEMP_export_secrets.ts
   git commit -m "Remove temporary export secrets endpoint"
   git push
   ```

---

## Method 2: Manual Copy from Replit UI 🔧

If you prefer to copy keys manually, follow these steps:

### Step 1: Access Replit Secrets

1. **In your Replit workspace** (left sidebar)
2. Click the **🔒 "Secrets"** icon (looks like a padlock)
3. You'll see a list of all your environment variables

### Step 2: Copy Each Secret

For each secret in the list:

1. Click on the secret name to expand it
2. Copy the **value** (not the key name)
3. Keep a text file open to paste each value with its key name

**Example format to use:**
```bash
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-abc123...
```

### Step 3: Handle Special Cases

#### GOOGLE_PRIVATE_KEY (Multiline Value)

This value contains line breaks (`\n`). In Railway RAW Editor:

```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n...\n-----END PRIVATE KEY-----\n"
```

**Important**:
- Keep the quotes `""`
- Keep the `\n` characters (they represent line breaks)
- Do NOT add actual line breaks

#### DATABASE_URL

⚠️ **Skip copying this** - Railway will automatically provide a DATABASE_URL when you add a PostgreSQL database to your project.

### Step 4: Paste into Railway

1. **Go to Railway Dashboard** → Your Project → Service
2. Click **"Variables"** tab
3. Choose ONE of these methods:

**Option A: RAW Editor (Faster)**
- Click **"RAW Editor"** (top right)
- Paste all your variables at once
- Click **"Update Variables"**

**Option B: Individual Variables (Slower)**
- Click **"New Variable"**
- Enter key name (e.g., `AI_INTEGRATIONS_OPENAI_API_KEY`)
- Paste the value
- Click **"Add"**
- Repeat for each variable

---

## Required Environment Variables Checklist

Use this checklist to ensure you've copied all required variables:

### AI API Keys (Required)
- [ ] `AI_INTEGRATIONS_OPENAI_API_KEY`
- [ ] `AI_INTEGRATIONS_OPENAI_BASE_URL` (default: `https://api.openai.com/v1`)
- [ ] `AI_INTEGRATIONS_ANTHROPIC_API_KEY`
- [ ] `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` (default: `https://api.anthropic.com`)

### Search APIs (Required)
- [ ] `PERPLEXITY_API_KEY`
- [ ] `SERPAPI_API_KEY`

### Google APIs (Required for Google Docs export)
- [ ] `GOOGLE_CLIENT_EMAIL`
- [ ] `GOOGLE_PRIVATE_KEY` (multiline - use quotes!)
- [ ] `GOOGLE_DRIVE_FOLDER_ID`

### Slack Integration (Required for notifications)
- [ ] `SLACK_BOT_TOKEN`
- [ ] `SLACK_SIGNING_SECRET`

### Inngest (Required for workflows)
- [ ] `INNGEST_EVENT_KEY`
- [ ] `INNGEST_SIGNING_KEY`

### Database (Automatically set by Railway)
- [ ] `DATABASE_URL` (Added automatically when you add PostgreSQL database)

### Optional Settings
- [ ] `NODE_ENV=production` (Railway sets this automatically)
- [ ] `PORT=5000` (Railway sets this automatically)

---

## Troubleshooting

### Problem: Export endpoint shows "Cannot read environment variables"

**Cause**: The Replit app is not running or secrets are not loaded.

**Solution**:
1. Stop the Replit app
2. Click **Run** again
3. Wait for "Server running on port 5000"
4. Try accessing `/export-secrets` again

### Problem: GOOGLE_PRIVATE_KEY format error in Railway

**Cause**: Multiline value not properly formatted.

**Solution**:
```bash
# WRONG ❌
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgk...
-----END PRIVATE KEY-----

# CORRECT ✅
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgk...\n-----END PRIVATE KEY-----\n"
```

Use the RAW Editor method and keep it all on one line with `\n` characters.

### Problem: Railway deployment fails with "API key not configured"

**Cause**: Variable name mismatch or value not pasted correctly.

**Solution**:
1. Go to Railway → Variables
2. Check each variable name matches exactly (case-sensitive!)
3. Verify values don't have extra spaces or quotes
4. Click **"Redeploy"** after fixing

### Problem: Database connection fails

**Cause**: DATABASE_URL not set or incorrect.

**Solution**:
1. Ensure you've added PostgreSQL database in Railway:
   - Click **"New"** → **"Database"** → **"Add PostgreSQL"**
2. Railway automatically sets `DATABASE_URL`
3. Verify in Variables tab that `DATABASE_URL` exists
4. Should look like: `postgresql://postgres:password@host:port/railway`

---

## Security Best Practices ✅

1. **Never commit API keys to Git**
   - ✅ Use `.env` files (already in `.gitignore`)
   - ✅ Use Replit Secrets in development
   - ✅ Use Railway Variables in production

2. **Delete the export endpoint after use**
   - ⚠️ The `/export-secrets` endpoint exposes ALL your API keys
   - ✅ Delete `TEMP_export_secrets.ts` file after copying keys
   - ✅ Remove the import from `src/mastra/index.ts`

3. **Use environment-specific keys**
   - Consider using different API keys for development vs production
   - Helps track usage and billing separately

4. **Rotate keys periodically**
   - Change your API keys every 3-6 months
   - Update in both Replit Secrets and Railway Variables

---

## After Setting Variables

Once all variables are set in Railway:

1. ✅ **Verify deployment** - Check Railway deployment logs for errors
2. ✅ **Test the app** - Visit `https://your-app.railway.app/react-dashboard`
3. ✅ **Generate a test report** - Click "Generate Report Now" in UI
4. ✅ **Check integrations**:
   - Google Docs export works
   - Slack notifications sent
   - Database connected
5. ✅ **Delete temporary export endpoint** (if using Method 1)

---

## Quick Reference: Railway Variable Update

```bash
# Method 1: Automated (visit in browser)
https://your-repl-name.your-username.repl.co/export-secrets

# Method 2: Manual
1. Replit → 🔒 Secrets → Copy each value
2. Railway → Variables → RAW Editor → Paste all

# After copying
git rm TEMP_export_secrets.ts
git commit -m "Remove temporary export endpoint"
git push
```

---

## Need Help?

If you encounter issues:

1. **Check Railway deployment logs**: Railway Dashboard → Deployments → Logs
2. **Verify variable names**: Railway Variables tab (must match exactly)
3. **Test each integration**: Use the React UI to generate a test report
4. **Review Railway deployment guide**: See `RAILWAY_DEPLOYMENT.md` for detailed troubleshooting

---

## Summary

**Fastest Method**: Use the `/export-secrets` endpoint (Method 1)
1. Run Replit app
2. Visit `/export-secrets` in browser
3. Copy all text
4. Paste into Railway RAW Editor
5. Delete the export endpoint

**Most Secure Method**: Manual copy (Method 2)
1. Open Replit Secrets panel
2. Copy each value individually
3. Paste into Railway Variables
4. No temporary endpoint needed

Both methods work perfectly - choose the one you're most comfortable with! 🚀
