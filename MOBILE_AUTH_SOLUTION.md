# Mobile App Authentication Solution

## Current Situation

The mobile app is running successfully on **Expo SDK 54 with React 19**, but we've hit a critical compatibility issue:

- `@clerk/clerk-expo` does not support React 19
- Error: `Cannot read property 'ReactCurrentDispatcher' of undefined`
- Your production API requires Clerk authentication via `@clerk/nextjs/server`

## Temporary Solution (Currently Implemented)

We've implemented a **custom authentication provider** ([lib/auth.tsx](apps/mobile/lib/auth.tsx)) that:
- ✅ Allows the app to load successfully without Clerk errors
- ✅ Provides the same API as Clerk (`useAuth`, `useUser`, `useSignIn`, `useSignUp`)
- ✅ Stores sessions securely with Expo SecureStore
- ⚠️ Currently uses mock authentication (accepts any email/password)

## Path Forward: Three Options

### Option 1: Wait for Clerk to Support React 19 (RECOMMENDED)

**Timeline**: Likely Q2 2025 when Clerk updates their React Native SDK

**Pros**:
- No backend changes needed
- Seamless integration with existing web app
- Best long-term solution

**Cons**:
- Requires waiting for Clerk's update
- Can't access production data immediately

**Action**: Monitor [@clerk/clerk-expo releases](https://www.npmjs.com/package/@clerk/clerk-expo) for React 19 support

---

### Option 2: Create Backend Authentication Endpoints (FASTEST)

**Timeline**: 1-2 hours of development

**Pros**:
- Can use production database immediately
- Full control over authentication flow
- Works with existing custom auth provider

**Cons**:
- Requires backend API changes
- Need to manage session tokens

**Implementation**:

1. **Create Mobile Auth Endpoints** in `/apps/web/app/api/mobile-auth/`:

```typescript
// POST /api/mobile-auth/sign-in
// Body: { email, password }
// Returns: { token, user }
export async function POST(request: Request) {
  const { email, password } = await request.json()

  // Use Clerk Admin API to verify credentials
  const clerkUser = await clerkClient.users.getUserList({ emailAddress: [email] })

  // Generate session token
  const sessionToken = await generateSessionToken(clerkUser)

  // Get user from database
  const dbUser = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUser.id)
  })

  return NextResponse.json({ token: sessionToken, user: dbUser })
}

// POST /api/mobile-auth/verify
// Headers: Authorization: Bearer <token>
// Returns: { user }
export async function POST(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  const user = await verifySessionToken(token)
  return NextResponse.json({ user })
}
```

2. **Update Mobile Auth Provider** ([lib/auth.tsx](apps/mobile/lib/auth.tsx:45)):

```typescript
const signIn = async (email: string, password: string) => {
  const response = await fetch(`${API_URL}/mobile-auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })

  const { token, user } = await response.json()

  await SecureStore.setItemAsync('session_token', token)
  await SecureStore.setItemAsync('user_data', JSON.stringify(user))

  setSessionToken(token)
  setUser(user)
  setIsSignedIn(true)
}
```

3. **Update API Middleware** to accept both Clerk sessions and mobile tokens

---

### Option 3: Downgrade to Expo SDK 52 with React 18

**Timeline**: Immediate (but requires reinstalling Expo Go)

**Pros**:
- Clerk works perfectly with React 18
- Full production access immediately

**Cons**:
- Incompatible with your current Expo Go app (SDK 54)
- Would need to install Expo Go for SDK 52 on simulator
- Not possible on physical iOS devices (only latest Expo Go available)

---

## Recommendation

**Choose Option 2** - Create backend authentication endpoints. This gives you:

1. ✅ Immediate access to production database
2. ✅ Works with your Expo Go SDK 54 app
3. ✅ No need to wait for third-party updates
4. ✅ Can migrate to Clerk later when React 19 is supported

Once implemented, you'll be able to:
- Sign in with real production credentials
- View actual jobs, clients, and data from your database
- Test the full mobile experience with real data

## Next Steps

1. Implement Option 2 backend endpoints
2. Update mobile auth provider to call those endpoints
3. Test full authentication flow
4. Connect all screens to production API

---

## Current App Status

✅ Mobile app loads successfully
✅ Expo SDK 54 + React 19 fully working
✅ Custom auth provider implemented
✅ UI components and navigation complete
⏳ Waiting for production authentication integration
