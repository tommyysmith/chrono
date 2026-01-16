# Supabase Migration Guide

This guide will walk you through migrating your Chrono app from localStorage-only to Supabase backend.

## What You Get

✅ **Real-time sync** across all devices
✅ **Offline-first** - works without internet, syncs when back online
✅ **Zero frontend changes** - your existing logic works exactly the same
✅ **Progressive rollout** - toggle backend on/off with environment variable
✅ **Data persistence** - no more lost data on browser clear

## Prerequisites

1. A Supabase account (free tier works great)
2. Your existing Chrono app with Clerk authentication

## Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name**: chrono
   - **Database Password**: (generate a secure password, save it)
   - **Region**: Choose closest to your users
4. Wait for project to be created (~2 minutes)

## Step 2: Get Supabase Credentials

1. In your Supabase project, click "Settings" (gear icon) → "API"
2. Copy these values:
   - **Project URL** (looks like: `https://xxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Configure Environment Variables

Create/edit `.env.local` in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Start with Supabase disabled (localStorage only)
NEXT_PUBLIC_USE_SUPABASE=false

# Your existing Clerk config
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

## Step 4: Run Database Migrations

1. In Supabase dashboard, go to "SQL Editor"
2. Click "New Query"
3. Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
4. Paste into SQL Editor
5. Click "Run"
6. You should see: "Success. No rows returned"

This creates:
- `events` table
- `tasks` table
- `views` table
- `user_settings` table
- Proper indexes for performance
- Row Level Security (RLS) policies
- Real-time subscriptions
- Auto-created default views for new users

## Step 5: Configure Clerk → Supabase Auth

In your Supabase dashboard:

1. Go to "Authentication" → "Providers" → "JWT"
2. Enable JWT
3. Add Clerk JWT template:
   - **JWKS URL**: `https://clerk.YOUR_DOMAIN.com/.well-known/jwks.json`
   - Replace `YOUR_DOMAIN` with your Clerk frontend API domain

In your Clerk dashboard:

1. Go to "JWT Templates"
2. Create new template named "Supabase"
3. Set claims:
```json
{
  "aud": "authenticated",
  "exp": {{user.created_at}},
  "sub": "{{user.id}}"
}
```

## Step 6: Test in Development

1. Restart your dev server: `npm run dev`
2. Open your app - it should work exactly as before (using localStorage)
3. Check console - you should see: "Supabase not enabled, running in localStorage-only mode"

## Step 7: Enable Supabase Backend

Once you're ready to test with Supabase:

1. Set environment variable:
```env
NEXT_PUBLIC_USE_SUPABASE=true
```

2. Restart dev server
3. Sign in to your app
4. Create a test event/task
5. Check Supabase dashboard → "Table Editor" → "events" or "tasks"
6. You should see your data!

## Step 8: Verify Real-time Sync

1. Open your app in two browser tabs
2. Create an event in Tab 1
3. Watch it appear instantly in Tab 2
4. Delete from Tab 2
5. Watch it disappear from Tab 1

✨ Real-time sync working!

## Step 9: Test Offline Mode

1. Open Dev Tools → Network tab
2. Set "Throttling" to "Offline"
3. Create/edit events - they work!
4. Set back to "Online"
5. Data syncs automatically to Supabase

## Step 10: Migrate Existing Data (Optional)

If you have existing data in localStorage you want to keep:

1. With `NEXT_PUBLIC_USE_SUPABASE=false`, export your data:
   - Open browser console
   - Run: `console.log(JSON.stringify({events: JSON.parse(localStorage.getItem('calendarEvents')), tasks: JSON.parse(localStorage.getItem('tasks')), views: JSON.parse(localStorage.getItem('calendarViews'))}))`
   - Copy the output

2. Create migration script (coming soon) or:
   - Set `NEXT_PUBLIC_USE_SUPABASE=true`
   - Manually re-create your most important events/tasks
   - Old data stays in localStorage as backup

## Troubleshooting

### "No rows returned" error
- Check RLS policies are enabled
- Verify Clerk JWT template is configured correctly
- Make sure user is authenticated (check `useUser()` hook)

### Data not syncing
- Check browser console for errors
- Verify `NEXT_PUBLIC_USE_SUPABASE=true`
- Confirm Supabase URL and key are correct
- Check internet connection

### Events appear twice
- Clear localStorage: `localStorage.clear()`
- Refresh page
- This happens if you toggle Supabase on/off

## What Changed?

### Frontend Logic: ZERO changes
Your event management, task management, recurrence logic, view management - all stays exactly the same!

### What's New:
- `useCalendarData` now syncs to Supabase (when enabled)
- `useTaskManagement` now syncs to Supabase (when enabled)
- Real-time subscriptions automatically update UI
- Offline queue handles failed requests

### What Was Removed:
- All Convex code (`convex/` directory)
- Migration complexity (MigrationModal, MigrationBanner, etc.)
- Optimistic update managers (not needed with Supabase real-time)
- Background sync services (Supabase handles this)

## Production Deployment

1. Add environment variables to Vercel/your host:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   NEXT_PUBLIC_USE_SUPABASE=true
   ```

2. Deploy: `git push` (if using Vercel auto-deploy)

3. Supabase free tier includes:
   - 500MB database
   - 1GB file storage
   - 2GB bandwidth
   - Unlimited API requests
   - Perfect for getting started!

## Cost Estimation

**Free Tier**: Perfect for up to ~1,000 active users

**Pro Tier** ($25/month): 8GB database, 100GB bandwidth - handles ~50,000+ active users

Compare this to managing your own PostgreSQL instance = huge savings!

## Need Help?

- Supabase Docs: https://supabase.com/docs
- Chrono GitHub Issues: [link]
- Check browser console for detailed error messages

## Next Steps

Once comfortable with Supabase:
1. Remove Convex dependency from `package.json`
2. Delete `convex/` directory
3. Delete migration-related components
4. Celebrate your working backend! 🎉