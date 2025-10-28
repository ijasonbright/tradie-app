# Vercel Deployment Issue - React Version Conflict

## Problem

The Vercel deployment is failing due to React version conflicts between the mobile and web apps in the monorepo:

- **Mobile App** (`apps/mobile`): Uses React 19.1.0 (required by Expo SDK 54)
- **Web App** (`apps/web`): Uses React 18.3.0 (required by Next.js 15)

When Vercel builds at the root level, npm hoists dependencies and React 19 from mobile conflicts with the web app's React 18 requirement.

Error:
```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentDispatcher')
```

## Solution: Configure Vercel Root Directory

To fix this, we need to tell Vercel to build only the web app directory:

### Steps:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Select your project**: `tradie-app-web` (or whatever your project is named)
3. **Go to Settings → General** (in the left sidebar)
4. **Scroll down to "Root Directory"**
5. **Click "Edit"** button
6. **Enter**: `apps/web`
7. **Click "Save"**
8. **Go to Deployments tab** (top navigation)
9. **Click the ⋯ menu** on the latest failed deployment
10. **Select "Redeploy"**

This will make Vercel build only the web app, isolating it from the mobile app's React 19 dependencies.

### Visual Guide:

```
Vercel Dashboard
└── Your Project
    └── Settings (sidebar)
        └── General (tab)
            └── Root Directory section
                ├── Current: . (or empty)
                └── Change to: apps/web
```

### Important Note

The root `vercel.json` has build commands that try to isolate the web app, but this **doesn't work** because:
- Vercel still runs `npm install` at the root first
- This installs ALL workspace dependencies (including mobile's React 19)
- npm hoists dependencies, causing conflicts
- The `cd` commands run after dependencies are already installed

**The ONLY solution is to change the Root Directory in Vercel Dashboard.**

### Alternative: If Dashboard Option Not Available

If you can't find the Root Directory option in your Vercel dashboard:

1. The project might need to be recreated with `apps/web` as the source
2. Or contact Vercel support to enable Root Directory configuration

## Why This Happened

The mobile app was developed with Expo SDK 54, which requires React 19. However, `@clerk/clerk-expo` doesn't support React 19 yet, so we:

1. Created a custom authentication system for mobile
2. Built backend JWT endpoints for mobile authentication
3. This works great for mobile!

BUT - the presence of React 19 in the monorepo causes Vercel to fail when building the web app at the root level.

## After Fixing Vercel

Once Vercel is configured to build from `apps/web`:

1. Deployment will succeed
2. Mobile auth endpoints will be live at:
   - `/api/mobile-auth/sign-in`
   - `/api/mobile-auth/verify`
3. You can sign in from your mobile app with production credentials
4. Full access to production database from mobile!

## Current Mobile App Status

✅ **Mobile app is working perfectly** on your phone
✅ Custom authentication implemented
✅ All screens functional
✅ Ready to connect once Vercel deploys

Just waiting for Vercel to build with the correct React version! 🚀
