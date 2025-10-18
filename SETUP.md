# Setup Instructions

## Step 1: Database Setup (Neon)

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project or use an existing one
3. Create a new database called `tradie-app`
4. Copy the connection string
5. Add it to `.env` as `DATABASE_URL`

Example:
```
DATABASE_URL=postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/tradie-app?sslmode=require
```

## Step 2: Clerk Setup

### Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Create a new application called "Tradie App"
3. Enable **Email** authentication
4. Enable **Organizations** feature:
   - Go to "Organizations" in the sidebar
   - Click "Enable Organizations"
   - Set up organization settings

### Get API Keys

1. Go to "API Keys" in your Clerk dashboard
2. Copy the following keys to your `.env` file:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)
   - `CLERK_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
   - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (same as NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

### Configure Organization Settings

1. In Clerk Dashboard → Organizations:
   - Enable "Organizations"
   - Set "Maximum number of memberships" to "Unlimited"
   - Enable "Admin delete organizations"
   - Enable "Members can leave organizations"

### Configure User Metadata

1. In Clerk Dashboard → User & Authentication → Email, Phone, Username:
   - Require Email
   - Optional Phone number

## Step 3: Initialize Database Schema

After setting up the database connection:

```bash
# Install dependencies if not done
npm install

# Generate database migrations
cd packages/database
npm run db:push

# This will create all tables in your Neon database
```

## Step 4: Run the Development Servers

### Backend (Next.js)

```bash
cd apps/web
npm run dev
```

The backend will be available at http://localhost:3000

### Mobile App (Expo)

```bash
cd apps/mobile
npm start
```

This will open Expo DevTools. You can:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app on your phone

## Step 5: Verify Setup

### Check Database Connection

1. Run the database studio:
   ```bash
   cd packages/database
   npm run db:studio
   ```

2. This opens Drizzle Studio in your browser where you can view/edit database tables

### Check Backend

1. Visit http://localhost:3000
2. You should see "Tradie App API - Backend server is running"

### Check Mobile App

1. The app should load and show "Tradie App - Mobile App"
2. Authentication status should show "Not Signed In"

## Next Steps

Once everything is running:

1. We'll implement the owner signup flow
2. Create the organization onboarding process
3. Build the team invitation system
4. Start developing core features

## Troubleshooting

### Database Connection Issues

- Ensure your Neon database is active (free tier databases sleep after inactivity)
- Check that the connection string includes `?sslmode=require`
- Verify the database name matches

### Clerk Issues

- Make sure you copied the correct API keys (test vs live)
- Verify Organizations are enabled in Clerk dashboard
- Check that publishable key starts with `pk_` and secret starts with `sk_`

### Mobile App Issues

- Make sure you have Expo Go installed on your phone
- Or have iOS Simulator / Android Emulator set up
- Check that node_modules are installed in apps/mobile

## Optional: Database Migrations

If you prefer migrations over push:

```bash
cd packages/database
npm run db:generate  # Generate migration files
npm run db:migrate   # Apply migrations
```

Push is simpler for development, migrations are better for production.
