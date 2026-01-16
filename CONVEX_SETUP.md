# Convex Setup Guide

This guide walks you through setting up Convex authentication with Google Sign-In for Chrono.

## 1. Create a Convex Project

1. Go to [Convex Dashboard](https://dashboard.convex.dev)
2. Sign in or create an account
3. Click "Create a project" and name it "chrono"
4. Copy the deployment URL (looks like `https://something-something-123.convex.cloud`)

## 2. Set Up Google OAuth Credentials

### In Google Cloud Console:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth client ID**
5. Select **Web application** as the application type
6. Configure the OAuth client:

   **Name:** Chrono Calendar
   
   **Authorized JavaScript origins:**
   - `http://localhost:3000` (for development)
   - Your production domain (e.g., `https://chrono.yourdomain.com`)
   
   **Authorized redirect URIs:**
   - `https://<your-convex-deployment>.convex.site/api/auth/callback/google`
   - Replace `<your-convex-deployment>` with your actual Convex deployment slug
   - You can find this in the Convex dashboard URL

7. Click **Create** and note your:
   - **Client ID** (ends with `.apps.googleusercontent.com`)
   - **Client Secret**

## 3. Configure Convex Environment Variables

In your [Convex Dashboard](https://dashboard.convex.dev):

1. Select your project
2. Go to **Settings > Environment Variables**
3. Add these environment variables:

| Variable | Value |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Your Google Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google Client Secret |
| `SITE_URL` | `http://localhost:3000` (dev) or your production URL |

## 4. Configure Local Environment

Create or update `.env.local` in your project root:

```env
# Convex
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud

# Google OAuth (for reference - actual values are in Convex dashboard)
# GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=your-client-secret
```

## 5. Start Development

```bash
# Start Convex development server (this syncs your functions)
npx convex dev

# In another terminal, start Next.js
npm run dev
```

## 6. Test Authentication

1. Open `http://localhost:3000`
2. You should see the "Sign in with Google" button
3. Click it to authenticate with your Google account
4. After signing in, you'll see the calendar interface

## Troubleshooting

### "redirect_uri_mismatch" error
- Ensure your Convex deployment URL is added to the **Authorized redirect URIs** in Google Cloud Console
- The exact format is: `https://<your-convex-deployment>.convex.site/api/auth/callback/google`

### "invalid_client" error
- Double-check your Client ID and Client Secret in Convex environment variables
- Ensure there are no extra spaces or characters

### Auth not working locally
- Make sure `NEXT_PUBLIC_CONVEX_URL` is set correctly in `.env.local`
- Run `npx convex dev` to sync your functions to Convex

### Events/Tasks not showing
- Check browser console for errors
- Verify you're signed in (user menu should show your name/avatar)
- Check Convex dashboard "Data" tab to see if data is being stored

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ConvexClientProvider (auth context)                  │  │
│  │    ├── AuthWrapper (checks auth state)               │  │
│  │    │     └── SignIn or Calendar                      │  │
│  │    └── UserMenu (sign out)                           │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Convex Backend                           │
│  ┌────────────────┐  ┌────────────────┐                    │
│  │   Auth Tables  │  │  App Tables    │                    │
│  │  (users, etc.) │  │  (events,      │                    │
│  │                │  │   tasks, etc.) │                    │
│  └────────────────┘  └────────────────┘                    │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Functions                              │ │
│  │  auth.ts (currentUser)                                  │ │
│  │  events.ts (CRUD for events)                            │ │
│  │  tasks.ts (CRUD for tasks)                              │ │
│  │  views.ts (CRUD for views)                              │ │
│  │  userSettings.ts (user preferences)                     │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Google OAuth                             │
│  (Authentication only - Calendar API integration separate)  │
└────────────────────────────────────────────────────────────┘
```

## Google Calendar Sync Setup

To enable Google Calendar sync (separate from sign-in):

### 1. Update Google Cloud Console

Add the following redirect URI to your Google OAuth credentials:
- `http://localhost:3000/api/google/callback` (development)
- `https://yourdomain.com/api/google/callback` (production)

### 2. Add Environment Variables

In your **local** `.env.local`:
```env
# Google Calendar OAuth (for calendar sync)
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
SITE_URL=http://localhost:3000
```

In your **Convex Dashboard** Environment Variables, add:
- `AUTH_GOOGLE_ID` - Your Google Client ID
- `AUTH_GOOGLE_SECRET` - Your Google Client Secret
- `SITE_URL` - Your site URL (http://localhost:3000 for dev)

### 3. Enable Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services > Library**
3. Search for "Google Calendar API"
4. Click **Enable**

### 4. Connect Your Calendar

1. Sign in to Chrono
2. Go to **Settings > Calendars**
3. Click **Connect Google Calendar**
4. Authorize the calendar permissions
5. Your events will sync automatically

## Next Steps

After basic auth is working:

1. ✅ **Google Calendar Integration** - Implemented in Settings > Calendars
2. **Real-time Updates** - Convex automatically provides real-time subscriptions
3. **Production Deployment** - Update environment variables for production URLs
