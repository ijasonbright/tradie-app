# Vercel Environment Variables Setup

This document lists all environment variables that need to be configured in Vercel for the app to work properly.

## 🚨 REQUIRED - App won't work without these

### 1. Database
```
DATABASE_URL=postgresql://user:password@host/database
```
- Get this from your Neon dashboard
- Should already be configured in Vercel

### 2. Clerk Authentication
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_...
```
- Get from [Clerk Dashboard](https://dashboard.clerk.com)
- Should already be configured in Vercel

### 3. App URLs
```
NEXT_PUBLIC_APP_URL=https://tradie-app-web.vercel.app
NEXT_PUBLIC_WEB_URL=https://tradie-app-web.vercel.app
```
- ⚠️ **ACTION NEEDED**: Update these to your actual Vercel URL
- Currently may be set to localhost

### 4. AI Document Verification (Anthropic Claude)
```
ANTHROPIC_API_KEY=sk-ant-...
```
- Get from [Anthropic Console](https://console.anthropic.com)
- Required for AI document expiry date extraction
- Should already be configured if document upload works

---

## ✉️ REQUIRED FOR EMAIL - Team invitations won't send without these

### 5. AWS SES Email Service
```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-southeast-2
AWS_SES_FROM_EMAIL=noreply@yourdomain.com
```

**⚠️ CURRENTLY MISSING - Invitations are created but emails won't send**

**To set up AWS SES:**

1. Go to [AWS Console](https://console.aws.amazon.com) → SES
2. Verify your sender email address or domain
3. Create IAM user with SES sending permissions:
   - AmazonSESFullAccess policy
4. Generate access keys for the IAM user
5. Add all 4 variables above to Vercel

**Note:** AWS SES starts in "sandbox mode" - you can only send to verified email addresses. To send to anyone, [request production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html).

---

## 📎 OPTIONAL - Nice to have, but app works without them

### 6. Clerk Webhooks (for user sync)
```
CLERK_WEBHOOK_SECRET=whsec_...
```
- Get from Clerk Dashboard → Webhooks
- Only needed if using Clerk webhooks

### 7. File Storage (Vercel Blob)
```
BLOB_READ_WRITE_TOKEN=...
```
- Get from Vercel Dashboard → Storage → Blob
- Required for document uploads (photos, receipts, compliance docs)
- Likely already configured if you're uploading files

---

## 🔮 FUTURE FEATURES - Not needed yet

### Stripe (SMS credit purchases)
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Tall Bob SMS (two-way SMS)
```
TALLBOB_API_KEY=...
TALLBOB_API_URL=https://...
TALLBOB_WEBHOOK_SECRET=...
```

### Xero Integration
```
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback
```

---

## 📋 How to Add Variables to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: `tradie-app-web`
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - Name: (e.g., `AWS_ACCESS_KEY_ID`)
   - Value: (paste your value)
   - Environment: Select **Production**, **Preview**, and **Development**
5. Click **Save**
6. **Redeploy** your app for changes to take effect

---

## ✅ Verification Checklist

After setting up, verify everything works:

- [ ] App loads: https://tradie-app-web.vercel.app
- [ ] Can log in with Clerk
- [ ] Can access dashboard
- [ ] Database queries work (team members load)
- [ ] **Can send team invitation** (email should be received)
- [ ] Can upload documents (requires Blob storage)
- [ ] AI document verification works (requires Anthropic API)

---

## 🔍 Current Status (Check Vercel Dashboard)

Go to your Vercel project settings and verify which of these are configured:

**Definitely Configured:**
- ✅ DATABASE_URL (app wouldn't work at all without it)
- ✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (auth wouldn't work)
- ✅ CLERK_SECRET_KEY (auth wouldn't work)

**Probably Configured:**
- ❓ ANTHROPIC_API_KEY (check if document AI verification works)
- ❓ BLOB_READ_WRITE_TOKEN (check if file uploads work)

**Likely NOT Configured (need to add):**
- ❌ AWS_ACCESS_KEY_ID
- ❌ AWS_SECRET_ACCESS_KEY
- ❌ AWS_REGION
- ❌ AWS_SES_FROM_EMAIL
- ❌ NEXT_PUBLIC_APP_URL (might be set to localhost)

---

## 🆘 Troubleshooting

**Invitation created but email not sent:**
- Check Vercel logs for: "AWS SES not configured"
- Add all 4 AWS SES variables listed above

**"Database not configured" error:**
- DATABASE_URL is missing or invalid
- Check Neon dashboard for correct connection string

**Authentication not working:**
- Check Clerk publishable key and secret key
- Verify they match your Clerk project

**Document upload failing:**
- BLOB_READ_WRITE_TOKEN is missing
- Create Blob storage in Vercel dashboard

**AI verification not working:**
- ANTHROPIC_API_KEY is missing or invalid
- Check API key in Anthropic console
