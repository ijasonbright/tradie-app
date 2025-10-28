# Mobile OAuth Authentication - Apple Sign-In Support

## Overview

Your mobile app now supports **Apple Sign-In** (and any other OAuth providers configured in Clerk), providing a consistent authentication experience across web and mobile platforms.

## How It Works

### Flow Diagram:
```
1. User taps "Sign in with Apple" in mobile app
2. Mobile app opens web browser → https://tradie-app-web.vercel.app/api/mobile-auth/oauth-callback
3. User signs in with Apple ID (same as web app)
4. Backend generates JWT token
5. Redirects to tradieapp://auth-callback?token=xxx&user={...}
6. Mobile app receives deep link → Saves token → User signed in!
```

## What's Been Implemented

### ✅ Backend (Deployed to Vercel)
- **`/api/mobile-auth/oauth-callback`** - New endpoint that:
  - Checks if user is authenticated via Clerk
  - If not, redirects to sign-in page
  - If yes, generates JWT token for mobile
  - Redirects back to mobile app with token

### ✅ Mobile App Auth Provider
- **`signInWithOAuth()`** method added
- Opens web browser for OAuth flow
- Handles deep link callback (`tradieapp://auth-callback`)
- Extracts token and user data from URL
- Saves to secure storage
- User is signed in!

### ✅ Deep Link Configuration
- App scheme configured: `tradieapp://`
- Deep link listener active
- Handles auth callbacks automatically

## What's Left To Do

### 🔲 Add "Sign in with Apple" Button

You need to update the sign-in screen to add the OAuth button:

**File**: `/apps/mobile/app/(auth)/sign-in.tsx`

Add this button after the existing "Sign In" button:

```tsx
<Button
  mode="outlined"
  onPress={onOAuthSignIn}
  loading={oauthLoading}
  disabled={oauthLoading}
  style={styles.button}
  icon="apple"
>
  Sign in with Apple
</Button>
```

And add the handler function:

```tsx
const [oauthLoading, setOAuthLoading] = useState(false)

const onOAuthSignIn = async () => {
  setOAuthLoading(true)
  setError('')

  try {
    await signInWithOAuth()
    // Deep link handler will redirect to jobs after sign-in
    router.replace('/(tabs)/jobs')
  } catch (err: any) {
    setError(err.message || 'Sign in failed')
  } finally {
    setOAuthLoading(false)
  }
}
```

Don't forget to get `signInWithOAuth` from the hook:

```tsx
const { signIn, signInWithOAuth, setActive, isLoaded } = useSignIn()
```

## Testing Instructions

### Once Button is Added:

1. **Restart Expo** (if running):
   ```bash
   cd apps/mobile
   npx expo start --tunnel
   ```

2. **Scan QR code** with Expo Go

3. **On sign-in screen**:
   - Tap "Sign in with Apple" button
   - Browser opens with your web app's sign-in page
   - Sign in with Apple ID (same as web app)
   - Browser closes automatically
   - You're signed in! ✅

4. **You should see**:
   - Real jobs from your database
   - Real clients
   - Real calendar data
   - Your profile information from Clerk

## Benefits of This Approach

✅ **Consistent UX**: Same sign-in method on web and mobile
✅ **No React 19 Issues**: Bypasses `@clerk/clerk-expo` incompatibility
✅ **Secure**: Uses JWT tokens with 30-day expiration
✅ **Flexible**: Supports all OAuth providers (Apple, Google, etc.)
✅ **Standard**: Industry-standard OAuth flow with deep links

## Troubleshooting

### "Sign in cancelled" error
- User closed browser before completing sign-in
- Try again

### Deep link not working
- Make sure Expo dev server is running
- Check that app.json has `"scheme": "tradieapp"`
- Restart Expo: `npx expo start --clear`

### "Authentication failed" error
- Check Vercel deployment is successful
- Verify JWT_SECRET is set in Vercel environment variables
- Check browser console for errors

## Current Status

- ✅ Backend OAuth endpoint deployed
- ✅ Mobile auth provider updated
- ✅ Deep link handling implemented
- 🔲 Sign-in button UI (you need to add)
- 🔲 Testing (after button added)

Once you add the button, you'll have a fully functional OAuth authentication flow that matches your web app!
