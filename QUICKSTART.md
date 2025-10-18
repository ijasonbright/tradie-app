# Quick Start Guide

This guide will get you up and running in 5 minutes!

## Prerequisites

- ✅ Node.js 20+ installed
- ✅ Clerk account (you have this)
- ✅ Neon account (you have this)
- ✅ Vercel account (you have this)

## 1. Get Your Credentials

### Neon Database (2 minutes)

1. Go to https://console.neon.tech/
2. Select your project or create a new one
3. Click "Connection Details" or "Dashboard"
4. Copy the connection string (it looks like this):
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
5. Paste it into `.env` as `DATABASE_URL`

### Clerk API Keys (2 minutes)

1. Go to https://dashboard.clerk.com/
2. Select your application or create a new one called "Tradie App"
3. Go to "API Keys" in the sidebar
4. Copy these three values into your `.env` file:
   - **Publishable Key** (starts with `pk_test_` or `pk_live_`)
     - Add as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
     - Add as `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - **Secret Key** (starts with `sk_test_` or `sk_live_`)
     - Add as `CLERK_SECRET_KEY`

### Enable Clerk Organizations (1 minute)

1. In Clerk Dashboard, click "Organizations" in sidebar
2. Click "Enable Organizations"
3. Keep default settings for now
4. Click "Save"

## 2. Initialize the Database (1 minute)

```bash
# Make sure you're in the project root
cd /Users/jasonbright/Documents/tradie-app

# Initialize database schema
cd packages/database
npm run db:push
```

You should see output like:
```
✓ Generated schema
✓ Pushing schema to database
✓ Done!
```

## 3. Start Development Servers

### Terminal 1 - Backend

```bash
cd apps/web
npm run dev
```

Visit http://localhost:3000 - you should see "Tradie App API - Backend server is running"

### Terminal 2 - Mobile (optional for now)

```bash
cd apps/mobile
npm start
```

This opens Expo DevTools. You can:
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Scan QR code with Expo Go app

## 4. Verify Database (optional)

Open Drizzle Studio to view your database:

```bash
cd packages/database
npm run db:studio
```

This opens a web interface at http://localhost:4983 where you can browse tables.

## 5. You're Ready! 🎉

You now have:
- ✅ Backend API running on localhost:3000
- ✅ Mobile app ready to run
- ✅ Database initialized with all tables
- ✅ Authentication configured

## What's Next?

Let me know you've completed the setup and I'll help you:

1. **Build the authentication flow**
   - Sign up screen
   - Sign in screen
   - Organization creation

2. **Create the owner onboarding experience**
   - Business details form
   - Logo upload
   - Initial setup wizard

3. **Start building features**
   - Client management
   - Job tracking
   - Invoicing

## Common Issues

### "Cannot connect to database"
- Check that your DATABASE_URL is correct in `.env`
- Make sure your Neon database is active (free tier sleeps after inactivity)
- Verify the connection string includes `?sslmode=require`

### "Invalid Clerk credentials"
- Make sure you copied the correct keys (test vs live)
- Verify you're using the right Clerk application
- Check that keys don't have extra spaces

### "Module not found"
- Run `npm install` in the root directory
- Make sure all workspaces are installed

### Mobile app won't start
- Make sure you're in the `apps/mobile` directory
- Run `npm install` if you haven't already
- For iOS: Make sure Xcode Command Line Tools are installed
- For Android: Make sure Android Studio is set up

## Your .env Should Look Like This

```env
# Database
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/tradie-app?sslmode=require

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_WEBHOOK_SECRET=

# Expo Mobile App
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# Feature Flags
ENABLE_SUBSCRIPTIONS=false
ENABLE_XERO=true
ENABLE_TWO_WAY_SMS=true
```

---

**Ready to continue building?** Let me know when you're set up! 🚀
