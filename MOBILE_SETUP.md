# Mobile App - Production Setup Guide

## ✅ Current Status
- ✅ Mobile app built with Phase 1 complete (Authentication + Navigation)
- ✅ Connected to **Production API**: `https://tradie-app-web.vercel.app/api`
- ✅ Expo server running locally on your development machine
- ⚠️ **Clerk Authentication Key Required** (see below)

---

## 🔑 Step 1: Add Your Clerk Key

To enable authentication, you need to add your **Clerk Publishable Key** to the mobile app:

### Get Your Clerk Key:
1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your Tradie App project
3. Navigate to **API Keys** in the left sidebar
4. Copy the **Publishable key** (starts with `pk_test_` or `pk_live_`)

### Add to Mobile App:
1. Open: `apps/mobile/.env`
2. Replace `pk_test_placeholder` with your actual Clerk key:
   ```
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
   ```
3. Save the file
4. The app will automatically reload with the new key

---

## 🗄️ Step 2: Verify Production Database Access

The mobile app will authenticate users via Clerk and fetch data from your production database via the Next.js API.

**What works automatically:**
- User authentication (sign in/sign up)
- API calls to `https://tradie-app-web.vercel.app/api/*`
- Production database access via your Next.js backend

**To verify:**
1. Sign in to the mobile app with a production user account
2. The app will make API calls to fetch:
   - Jobs from `/api/jobs`
   - Clients from `/api/clients`
   - Calendar appointments from `/api/calendar/appointments`
   - User profile from Clerk

---

## 📱 Step 3: Test the App

### Current Setup:
- **Development Mode**: Running locally via Expo Go
- **API**: Production (tradie-app-web.vercel.app)
- **Database**: Production (via API)
- **Authentication**: Production Clerk instance

### To Test:
1. Open Expo Go on your phone
2. Scan the QR code from your terminal
3. The app will load and show the Sign In screen
4. Sign in with a production account OR create a new account
5. Once authenticated, you'll see the 4 tabs with real production data!

---

## 🔄 Phase 1: What's Working

### ✅ Authentication Screens
- **Sign In**: Email + password authentication
- **Sign Up**: Email verification with 6-digit code
- **Auto-routing**: Redirects based on auth status

### ✅ Main Navigation (4 Tabs)
1. **Jobs Tab** 📋
   - Currently shows mock data
   - **Next**: Connect to `GET /api/jobs` to fetch real jobs

2. **Calendar Tab** 📅
   - Currently shows mock data
   - **Next**: Connect to `GET /api/calendar/appointments` for real schedule

3. **Clients Tab** 👥
   - Currently shows mock data
   - **Next**: Connect to `GET /api/clients` to fetch real clients

4. **More Tab** ⚙️
   - Shows authenticated user profile (from Clerk)
   - Settings menu structure ready
   - Sign Out works!

---

## 🚀 Next Steps (Phase 2)

### Phase 2: Connect to Real Data
Once your Clerk key is added, we'll implement:

1. **API Integration**
   - Create `useJobs()` hook → `GET /api/jobs`
   - Create `useClients()` hook → `GET /api/clients`
   - Create `useAppointments()` hook → `GET /api/calendar/appointments`
   - Use React Query for caching and refetching

2. **Job Detail Screen**
   - View full job information
   - Time tracking
   - Materials/equipment
   - Photos
   - Notes

3. **Create New Job Flow**
   - Select client
   - Add job details
   - Assign team members
   - Schedule date/time
   - `POST /api/jobs`

4. **Camera Integration**
   - Take job photos
   - Upload to Vercel Blob Storage
   - Associate with jobs

---

## 🛠️ Development Workflow

### Making Changes:
1. Edit files in `apps/mobile/`
2. Save
3. Changes hot-reload instantly on your phone (Fast Refresh)

### Testing with Production Data:
1. Ensure Clerk key is added (Step 1 above)
2. Sign in with a real account
3. App makes real API calls to production
4. See actual data from your database

### Debugging:
- Shake device → Opens developer menu
- "Debug Remote JS" → Opens Chrome debugger
- Expo logs appear in your terminal
- Network requests visible in React Query DevTools (to be added)

---

## 📝 Environment Variables

### Mobile App (.env in apps/mobile/)
```bash
# Clerk Authentication - REQUIRED
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# API - Already configured for production
EXPO_PUBLIC_API_URL=https://tradie-app-web.vercel.app/api
```

### Web App (Vercel Environment Variables)
Your production API is already deployed and configured with:
- `DATABASE_URL` → Neon PostgreSQL
- `CLERK_SECRET_KEY` → For API authentication
- Other production secrets

---

## 🎯 Quick Start Checklist

- [ ] Add Clerk publishable key to `apps/mobile/.env`
- [ ] Restart Expo dev server (or it auto-reloads)
- [ ] Open Expo Go and scan QR code
- [ ] Sign in with production account
- [ ] Confirm you can authenticate successfully
- [ ] Ready for Phase 2: Connect to real API data!

---

## 💡 Tips

**Fast Iteration:**
- Changes to UI reload instantly (Fast Refresh)
- Changes to .env require app restart
- No need to rebuild or deploy for local testing

**Production Testing:**
- You're testing against live production data
- Be careful with create/update/delete operations
- Consider creating test data in production first

**Next Phase Preview:**
Once Clerk is connected, Phase 2 will make the app fully functional with:
- Real jobs from your database
- Real clients
- Real calendar appointments
- Create new jobs that save to production
- All CRUD operations working

---

## 🆘 Troubleshooting

**"Missing Publishable Key" Error:**
- Check `apps/mobile/.env` has correct Clerk key
- Restart Expo server: `Ctrl+C` then `npm start`

**"Network Request Failed":**
- Check API URL is correct in .env
- Verify production API is accessible
- Check Clerk authentication is working

**App Won't Load:**
- Clear Expo cache: `npm start -- --clear`
- Check terminal for errors
- Reload app in Expo Go (shake → Reload)

---

**Ready to continue?** Add your Clerk key and let's test authentication! 🚀
