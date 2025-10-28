# Mobile Authentication Deployment Instructions

## ✅ Completed Steps

1. ✅ Created mobile authentication endpoints:
   - `/api/mobile-auth/sign-in` - Authenticates users and returns JWT token
   - `/api/mobile-auth/verify` - Verifies JWT token

2. ✅ Updated mobile auth provider to call production API

3. ✅ Pushed code to GitHub (commit: ee38fab)

4. ✅ Vercel is automatically deploying

## 🔐 Required: Add JWT Secret to Vercel

To complete the deployment, you need to add the JWT_SECRET environment variable to Vercel:

### Steps:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Select your project**: `tradie-app-web`

3. **Go to Settings → Environment Variables**

4. **Add new variable**:
   - **Name**: `JWT_SECRET`
   - **Value**: `JSHunlqrtA6YhCaWxboePVVpsoDlrW/H+VpjRH1/pa0=`
   - **Environments**: Select all (Production, Preview, Development)

5. **Click "Save"**

6. **Redeploy** (Vercel will prompt you, or go to Deployments → Latest → Redeploy)

## 🧪 Testing After Deployment

Once deployed with the JWT_SECRET, test authentication:

### 1. Test the Sign-In Endpoint

```bash
curl -X POST https://tradie-app-web.vercel.app/api/mobile-auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}'
```

Expected response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "your@email.com",
    "fullName": "Your Name",
    ...
  }
}
```

### 2. Test in Mobile App

1. **Restart the mobile app** (if needed)
2. **Enter your production credentials** from the web app
3. **Sign in**
4. You should now be authenticated with your production database!

## 📱 Current Mobile App Status

✅ **App is running successfully** on your phone via Expo Go
✅ **Custom auth provider** ready to connect to production
✅ **All screens** functional (Jobs, Calendar, Clients, More)
⏳ **Waiting for** JWT_SECRET to be added to Vercel

## 🔧 Troubleshooting

### If sign-in fails:

1. **Check Vercel logs**:
   - Go to Vercel Dashboard → Your Project → Deployments
   - Click latest deployment → View Function Logs
   - Look for errors in `/api/mobile-auth/sign-in`

2. **Verify JWT_SECRET is set**:
   - Settings → Environment Variables
   - Make sure JWT_SECRET exists and is the correct value

3. **Check mobile app is using production URL**:
   - Should be: `https://tradie-app-web.vercel.app/api`
   - Verify in `apps/mobile/.env`

### Common Errors:

- **"User not found"**: The email doesn't exist in Clerk. Sign up via web app first.
- **"Invalid token"**: JWT_SECRET not set or incorrect in Vercel.
- **"Authentication failed"**: Check Vercel function logs for details.

## 🎯 Next Steps After Authentication Works

1. Update Jobs screen to fetch real data from `/api/jobs`
2. Update Clients screen to fetch from `/api/clients`
3. Implement job detail view
4. Add time tracking functionality
5. Enable photo upload

## 📞 Need Help?

If you encounter any issues:
1. Check Vercel deployment logs
2. Check mobile app console (Expo Go will show errors)
3. Verify JWT_SECRET is set correctly
4. Ensure you're using valid Clerk credentials
