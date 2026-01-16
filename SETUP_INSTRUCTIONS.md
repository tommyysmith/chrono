# Chrono Setup Instructions

## Quick Start

Your app now has a clean, working Supabase backend! Here's how to get it running:

## 1. Install Dependencies (Already Done ✅)

```bash
npm install
```

The Supabase client is already installed.

## 2. Set Up Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local`:

```env
# Start with localStorage only (safe default)
NEXT_PUBLIC_USE_SUPABASE=false

# Add these when you're ready to enable Supabase:
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Your existing Clerk credentials
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

## 3. Run Development Server

```bash
npm run dev
```

Your app will run at `http://localhost:3000` using localStorage (no backend needed yet).

## 4. When Ready for Supabase Backend

Follow the comprehensive guide in `SUPABASE_MIGRATION_GUIDE.md`:

1. Create Supabase project (2 minutes)
2. Run database migrations (copy/paste SQL)
3. Configure Clerk JWT template
4. Add credentials to `.env.local`
5. Set `NEXT_PUBLIC_USE_SUPABASE=true`
6. Restart server

That's it! Your data will now sync across devices in real-time.

## What's Different Now?

### ✅ What Works Immediately
- All existing functionality (events, tasks, views, recurring items)
- Offline-first (works without internet)
- localStorage as primary storage
- Zero performance impact

### 🚀 What You Get With Supabase (Optional)
- Real-time sync across devices
- Data persists forever (not just in browser)
- Automatic backups
- Multi-device support
- Collaborative features (future)

### 🗑️ What Was Removed
- Convex (replaced with Supabase)
- Migration complexity (not needed anymore)
- Performance monitoring overhead
- Complex sync services

## File Structure

```
chrono/
├── src/
│   ├── hooks/
│   │   ├── useCalendarData.js ← Updated with Supabase
│   │   └── useTaskManagement.js ← Updated with Supabase
│   ├── lib/
│   │   ├── supabase.js ← NEW: Data access layer
│   │   └── supabaseSync.js ← NEW: Real-time subscriptions
│   └── components/
│       └── SupabaseProvider.jsx ← NEW: Auth integration
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql ← Database schema
├── .env.local.example ← Environment template
├── SUPABASE_MIGRATION_GUIDE.md ← Full setup guide
└── SETUP_INSTRUCTIONS.md ← This file
```

## Development Tips

### Testing Without Supabase
Keep `NEXT_PUBLIC_USE_SUPABASE=false` during development. Your app works perfectly with just localStorage.

### Testing With Supabase
Set `NEXT_PUBLIC_USE_SUPABASE=true` to test backend features:
- Real-time sync
- Cross-device data
- Persistence

### Toggling Between Modes
You can toggle Supabase on/off anytime by changing the environment variable and restarting the server. Your localStorage data is preserved.

## Common Commands

```bash
# Development
npm run dev

# Production build
npm run build
npm start

# Linting
npm run lint
```

## Need Help?

1. Check `SUPABASE_MIGRATION_GUIDE.md` for detailed setup
2. Check browser console for error messages
3. Verify environment variables are set correctly
4. Make sure Supabase project is created (if using backend)

## What's Next?

1. **Now**: Run `npm run dev` and test your app
2. **Soon**: Follow `SUPABASE_MIGRATION_GUIDE.md` to enable backend
3. **Later**: Deploy to production with Vercel

Your frontend logic is untouched and working perfectly! 🎉