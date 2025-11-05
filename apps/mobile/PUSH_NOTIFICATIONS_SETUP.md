# Push Notifications Setup Instructions

## Initial Setup (One-time)

To enable push notifications in the mobile app, you need to set up an Expo project:

### 1. Log in to Expo

```bash
cd apps/mobile
npx expo login
```

Enter your Expo account credentials. If you don't have an account, create one at https://expo.dev/signup

### 2. Initialize EAS (Expo Application Services)

```bash
npx eas init --id
```

This will:
- Create a new project on Expo servers
- Add the `projectId` to your `app.json` automatically

### 3. Verify Setup

After running `eas init`, check that `app.json` has been updated with your real `projectId`:

```json
{
  "expo": {
    "projectId": "abc123-def456-...",  // Real UUID
    ...
  }
}
```

### 4. Test Push Notifications

Restart the app and you should see the push notification permission prompt. The app will automatically register your device token with the backend.

## Alternative: Manual Setup

If you prefer not to use EAS, you can manually set the project ID:

1. Create a project at https://expo.dev/accounts/[your-account]/projects/create
2. Copy the project ID from the project settings
3. Add it to `app.json`:
   ```json
   {
     "expo": {
       "projectId": "your-copied-project-id"
     }
   }
   ```

## Testing Push Notifications

Once setup is complete:

1. Open the mobile app (it will request push notification permissions)
2. Grant permissions
3. The app will register your device token automatically
4. Test by calling the backend API:

```bash
curl -X POST https://tradie-app-web.vercel.app/api/push/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "message": "This is a test push notification!"
  }'
```

## Troubleshooting

### Error: "No projectId found"
- Run `npx eas init --id` in the mobile app directory
- OR manually add projectId to app.json as shown above

### Error: "Invalid credentials"
- Make sure you're logged in: `npx expo whoami`
- If not logged in: `npx expo login`

### Notifications not received
- Check that permissions were granted in device settings
- Check the backend logs for push send errors
- Verify the push token was registered: Check the `users.expo_push_token` column in the database
