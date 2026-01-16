# Chrono Backend - Quick Reference

## Start Development

```bash
npm run dev
# App runs on http://localhost:3000
```

## Environment Variables

```env
# Toggle backend on/off
NEXT_PUBLIC_USE_SUPABASE=false  # localStorage only
NEXT_PUBLIC_USE_SUPABASE=true   # Supabase backend

# Supabase credentials (when enabled)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Clerk (required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase.js` | Database operations (CRUD) |
| `src/lib/supabaseSync.js` | Real-time subscriptions |
| `src/hooks/useCalendarData.js` | Calendar data management |
| `src/hooks/useTaskManagement.js` | Task operations |
| `supabase/migrations/001_initial_schema.sql` | Database schema |

## Common Tasks

### Enable Supabase Backend
1. Create Supabase project at https://app.supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
3. Add credentials to `.env.local`
4. Set `NEXT_PUBLIC_USE_SUPABASE=true`
5. Restart dev server

### Disable Supabase Backend
1. Set `NEXT_PUBLIC_USE_SUPABASE=false`
2. Restart dev server
3. App uses localStorage only

### Migrate Existing Data
```javascript
// In browser console after enabling Supabase:
import { migrateLocalStorageToSupabase } from './src/lib/migrationScript';
await migrateLocalStorageToSupabase(user.id);
```

### Check If Supabase Is Working
```javascript
// Browser console:
console.log('Supabase enabled:', process.env.NEXT_PUBLIC_USE_SUPABASE);
```

### Backup localStorage Data
```javascript
// Browser console:
import { createMigrationBackup } from './src/lib/migrationScript';
await createMigrationBackup();
```

## Database Schema

### Tables
- `events` - Calendar events with recurrence support
- `tasks` - Tasks with tags and recurrence
- `views` - Calendar views (Personal, Work, etc.)
- `user_settings` - User preferences

### Key Features
- Row Level Security (RLS) - users only see their own data
- Real-time subscriptions - changes sync instantly
- Automatic timestamps - `created_at`, `updated_at`
- JSONB columns - flexible schema for complex data

## Troubleshooting

### App won't start
```bash
rm -rf .next node_modules/.cache
npm install
npm run dev
```

### Supabase not syncing
1. Check env vars are set correctly
2. Verify `NEXT_PUBLIC_USE_SUPABASE=true`
3. Check browser console for errors
4. Test with `NEXT_PUBLIC_USE_SUPABASE=false` first

### Data appears twice
```bash
# Clear localStorage:
localStorage.clear()
# Refresh page
```

### "No rows returned" from Supabase
- Check RLS policies are enabled
- Verify Clerk JWT template configured
- Ensure user is authenticated

## Useful Commands

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm start                      # Run production build
npm run lint                   # Check code quality

# Database (in Supabase dashboard)
# SQL Editor → New Query → Run migration
```

## File Structure

```
chrono/
├── src/
│   ├── lib/
│   │   ├── supabase.js           # Supabase client & CRUD
│   │   ├── supabaseSync.js       # Real-time sync
│   │   └── migrationScript.js    # Data migration
│   ├── hooks/
│   │   ├── useCalendarData.js    # Calendar data
│   │   └── useTaskManagement.js  # Task data
│   └── components/
│       ├── SupabaseProvider.jsx  # Auth integration
│       └── DataMigrationPanel.jsx # Migration UI
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Database schema
├── .env.local                    # Environment variables
├── .env.local.example            # Template
├── SUPABASE_MIGRATION_GUIDE.md   # Full setup guide
├── SETUP_INSTRUCTIONS.md         # Quick start
├── MIGRATION_COMPLETE.md         # What was done
└── QUICK_REFERENCE.md            # This file
```

## Important Notes

1. **Frontend Logic Unchanged**: All your event/task management logic works exactly the same
2. **Offline First**: App works without internet, syncs when back online
3. **Progressive**: Can toggle Supabase on/off anytime
4. **Safe**: localStorage data preserved when switching modes

## Next Steps

1. ✅ Run `npm run dev` - test app works
2. 📖 Read `SETUP_INSTRUCTIONS.md` - 5 min quick start
3. 🚀 Read `SUPABASE_MIGRATION_GUIDE.md` - full setup when ready
4. 🎉 Deploy and enjoy real-time sync!

## Links

- Supabase Dashboard: https://app.supabase.com
- Supabase Docs: https://supabase.com/docs
- Clerk Dashboard: https://dashboard.clerk.com
- Clerk Docs: https://clerk.com/docs