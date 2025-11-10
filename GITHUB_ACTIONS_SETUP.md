# GitHub Actions Setup for iOS Build

This guide will help you set up automated iOS builds using GitHub Actions.

## Step 1: Get Your Expo Access Token

1. Go to https://expo.dev/accounts/ijasonbright/settings/access-tokens
2. Click "Create Token"
3. Name it: "GitHub Actions"
4. Copy the token (you'll only see it once!)

## Step 2: Add Secret to GitHub

1. Go to your GitHub repository: https://github.com/ijasonbright/tradie-app
2. Click "Settings" tab
3. Click "Secrets and variables" → "Actions" (in left sidebar)
4. Click "New repository secret"
5. Name: `EXPO_TOKEN`
6. Value: Paste the token you copied from Expo
7. Click "Add secret"

## Step 3: Trigger the Build

1. Go to the "Actions" tab in your GitHub repository
2. Click "Build iOS App for TestFlight" workflow (left sidebar)
3. Click "Run workflow" button (right side)
4. Click the green "Run workflow" button in the dropdown
5. Wait 20-30 minutes for the build to complete

## What Happens

The GitHub Actions workflow will:
1. ✅ Check out your code
2. ✅ Install Node.js and dependencies
3. ✅ Build your iOS app on EAS servers (from GitHub, not your Mac)
4. ✅ Automatically submit to TestFlight
5. ✅ Send you an email when complete

## After Build Completes

1. Go to https://appstoreconnect.apple.com/
2. Navigate to "My Apps" → "Taskforce" → "TestFlight"
3. The build will appear (may take 10-30 mins for Apple to process)
4. Add your employees to a test group
5. They'll receive TestFlight invitations via email

## Benefits of GitHub Actions

- ✅ No need to upload 948MB monorepo - GitHub clones it quickly
- ✅ Builds run in the cloud (macOS servers)
- ✅ Can be automated (e.g., build on every push to `main`)
- ✅ Free for your repository size
- ✅ Much more reliable than local builds

## Troubleshooting

If the build fails, check the Actions tab for error logs. Common issues:
- **EXPO_TOKEN not set**: Make sure you added the secret correctly
- **Apple credentials**: EAS will prompt for credentials on first run
- **Build errors**: Check the logs for specific errors

## Future: Automatic Builds

Once this works, you can change the workflow trigger to:

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'apps/mobile/**'
```

This will automatically build whenever you push changes to the mobile app!
