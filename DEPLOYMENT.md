# Vercel Preview-First Deployment Guide

Complete step-by-step guide to deploy your Tradie App with preview and production environments.

---

## Step 1: Push to GitHub ✅ (You're doing this now)

```bash
git push -u origin main
```

Once pushed, verify at: https://github.com/ijasonbright/tradie-app

---

## Step 2: Create Neon Database Branches (5 minutes)

### 2.1 Go to Neon Console
Visit: https://console.neon.tech/

### 2.2 Select or Create Your Project
- If you have an existing project for this app, select it
- Or create a new project called "Tradie App"

### 2.3 Create Preview Branch
1. Click **"Branches"** in the left sidebar
2. Click **"Create Branch"** button
3. Fill in the form:
   - **Branch name:** `preview`
   - **Parent branch:** `main`
   - Leave other settings as default
4. Click **"Create"**

### 2.4 Get Connection Strings
You need TWO connection strings:

#### Main Branch (Production)
1. Click on **"main"** branch in the branches list
2. Click **"Connection Details"**
3. Copy the connection string (should look like):
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as **PRODUCTION_DATABASE_URL**

#### Preview Branch (Development)
1. Click on **"preview"** branch in the branches list
2. Click **"Connection Details"**
3. Copy the connection string (should look similar but different endpoint):
   ```
   postgresql://user:password@ep-yyy-yyy.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Save this as **PREVIEW_DATABASE_URL**

**✅ Checkpoint:** You should have two different connection strings saved

---

## Step 3: Set Up Vercel Project (10 minutes)

### 3.1 Go to Vercel
Visit: https://vercel.com/new

### 3.2 Import GitHub Repository
1. Click **"Add New..." → "Project"**
2. Find and select **"ijasonbright/tradie-app"** from the list
   - If you don't see it, click "Adjust GitHub App Permissions" to grant access
3. Click **"Import"**

### 3.3 Configure Project Settings
**IMPORTANT:** Before clicking "Deploy", configure these settings:

#### Framework Preset
- Should auto-detect as **"Next.js"** ✅

#### Root Directory
- Click **"Edit"**
- Select **`apps/web`** from the dropdown
- This is crucial! The Next.js app is in apps/web, not the root

#### Build & Development Settings
Leave as defaults:
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`

### 3.4 Add Environment Variables
Click **"Environment Variables"** section and add these:

#### Add for PRODUCTION only:
```
DATABASE_URL = [Paste your PRODUCTION_DATABASE_URL from Step 2]
```

#### Add for PREVIEW only:
```
DATABASE_URL = [Paste your PREVIEW_DATABASE_URL from Step 2]
```

#### Add for BOTH Production and Preview:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = [Your Clerk publishable key]
CLERK_SECRET_KEY = [Your Clerk secret key]
NEXT_PUBLIC_APP_URL = https://tradie-app.vercel.app
NEXT_PUBLIC_WEB_URL = https://tradie-app.vercel.app
ENABLE_XERO = true
ENABLE_TWO_WAY_SMS = false
ENABLE_SUBSCRIPTIONS = false
```

**How to add for specific environments:**
- Each variable has checkboxes: [ ] Production [ ] Preview [ ] Development
- For DATABASE_URL: Add it twice (once for Production, once for Preview with different values)
- For other variables: Check both Production and Preview

### 3.5 Get Your Clerk Keys

If you don't have them handy:

1. Go to https://dashboard.clerk.com/
2. Select your application
3. Go to **"API Keys"** in sidebar
4. Copy:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)

### 3.6 Deploy
1. After adding all environment variables, click **"Deploy"**
2. Wait ~2-3 minutes for the build
3. You should see "Congratulations!" when it completes

**✅ Checkpoint:** Your app is deployed! You'll get URLs like:
- Production: `https://tradie-app.vercel.app`
- Preview: Auto-generated for each branch

---

## Step 4: Configure Clerk for Vercel Domains (3 minutes)

### 4.1 Add Production Domain to Clerk
1. Go to https://dashboard.clerk.com/
2. Select your Tradie App application
3. Go to **"Domains"** in sidebar
4. Click **"Add domain"**
5. Add your Vercel production URL: `tradie-app.vercel.app`
6. Click **"Add domain"**

### 4.2 Preview Domains
- Clerk automatically allows Vercel preview domains
- Pattern: `*.vercel.app` is already whitelisted
- No action needed! ✅

### 4.3 Enable Organizations (if not already done)
1. In Clerk Dashboard, click **"Organizations"** in sidebar
2. Toggle **"Enable Organizations"** ON
3. Settings:
   - ✅ Enable organizations
   - ✅ Members can leave organizations
   - ✅ Admins can delete organizations
4. Click **"Save"**

**✅ Checkpoint:** Clerk is configured for your Vercel domains

---

## Step 5: Initialize Database Schema (5 minutes)

Now we need to create all the tables in your databases.

### 5.1 Install Dependencies Locally (One-time)
```bash
cd /Users/jasonbright/Documents/tradie-app
npm install
```

### 5.2 Initialize Preview Database
```bash
cd packages/database
DATABASE_URL="[Your PREVIEW_DATABASE_URL]" npm run db:push
```

You should see:
```
✓ Pulling schema from database
✓ Pushing schema to database
Done!
```

### 5.3 Initialize Production Database
```bash
DATABASE_URL="[Your PRODUCTION_DATABASE_URL]" npm run db:push
```

Same output as above.

**✅ Checkpoint:** Both databases now have all tables created

---

## Step 6: Test Your Deployments (2 minutes)

### 6.1 Test Production
1. Visit your production URL: `https://tradie-app.vercel.app`
2. You should see: **"Tradie App API - Backend server is running"**
3. Check the browser console for any errors (should be none)

### 6.2 Test Preview
1. Go to your Vercel dashboard
2. Find the latest deployment (should be from main branch)
3. Click to open the deployment
4. Should see the same page as production

### 6.3 Test Database Connection
Create a test API endpoint to verify database works:

I'll create this for you after the initial deployment is successful.

**✅ Checkpoint:** Both environments are working!

---

## Step 7: Set Up Development Workflow

### 7.1 Your New Workflow

From now on, when working with Claude:

1. **Make changes** in VS Code (Claude helps you code)
2. **Commit changes:**
   ```bash
   git add .
   git commit -m "Description of changes"
   ```
3. **Push to GitHub:**
   ```bash
   git push origin main
   ```
4. **Wait 30 seconds** - Vercel automatically builds and deploys
5. **Test on your URL** - Visit your production URL to see changes

### 7.2 Using Preview Deployments (Feature Branches)

For larger features, use branches:

```bash
# Create feature branch
git checkout -b feature/user-authentication

# Make changes with Claude
[Work on the feature]

# Commit and push
git add .
git commit -m "Add user authentication"
git push origin feature/user-authentication

# Vercel creates preview URL automatically
# Test at: https://tradie-app-git-feature-user-authentication-ijasonbright.vercel.app

# When ready for production:
git checkout main
git merge feature/user-authentication
git push origin main
```

### 7.3 Viewing Deployments

- Go to https://vercel.com/dashboard
- Click on "tradie-app" project
- See all deployments (production + previews)
- Each has its own URL
- Click any deployment to see logs, performance, etc.

---

## Step 8: Configure Mobile App (Next Phase)

Once backend is stable, we'll update the mobile app to point to your Vercel API.

In `apps/mobile/app/_layout.tsx`, we'll add:
```typescript
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-app.vercel.app'
```

Then mobile app can be tested with Expo Go on your phone.

---

## Troubleshooting

### Build Fails on Vercel

**Check build logs:**
1. Go to Vercel dashboard
2. Click on the failed deployment
3. Click "Build Logs"
4. Look for error messages

**Common issues:**
- Missing environment variables
- Wrong root directory (should be `apps/web`)
- TypeScript errors (we'll fix together)

### "Cannot connect to database"

**Check:**
- Environment variable `DATABASE_URL` is set in Vercel
- Connection string includes `?sslmode=require`
- Neon database is active (free tier sleeps after inactivity)

**Fix:**
- Go to Neon console
- Click on your project to wake it up
- Redeploy in Vercel

### Clerk Authentication Errors

**Check:**
- Domain is added in Clerk dashboard
- API keys are correct in Vercel environment variables
- Organizations are enabled in Clerk

### Database Schema Issues

**If you need to update schema:**
1. Make changes to schema files
2. Push to preview branch
3. Run against preview database:
   ```bash
   DATABASE_URL="[preview-url]" npm run db:push
   ```
4. Test on preview deployment
5. Run against production when ready:
   ```bash
   DATABASE_URL="[production-url]" npm run db:push
   ```
6. Merge to main

---

## Summary: What You Have Now

✅ **GitHub Repository** - All code version controlled
✅ **Vercel Production** - Live at tradie-app.vercel.app
✅ **Vercel Previews** - Auto-deployed for every branch
✅ **Neon Production DB** - Separate production data
✅ **Neon Preview DB** - Safe testing environment
✅ **Clerk Authentication** - User management ready
✅ **Fast Workflow** - Push → Wait 30s → Live

---

## Next Steps After Deployment

Once everything is deployed and working:

1. **Build authentication flows**
   - Owner signup
   - Organization creation
   - Team invitations

2. **Create API endpoints**
   - Users API
   - Organizations API
   - Clients API
   - Jobs API

3. **Build mobile screens**
   - Login screen
   - Dashboard
   - Client list
   - Job management

4. **Add integrations**
   - Xero API
   - Stripe payments
   - Tall Bob SMS

---

## Getting Help

If you run into any issues:
1. Check the troubleshooting section above
2. Share the error message with Claude
3. Check Vercel deployment logs
4. Check Neon database status

**Ready to continue?** Complete Steps 2-6 above and let me know when you're done! 🚀
