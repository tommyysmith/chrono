# Clerk + Supabase Authentication Setup

This guide will walk you through connecting Clerk authentication with Supabase RLS (Row Level Security).

## ⚠️ IMPORTANT: This Step is Required!

Without this configuration, you'll see:
- ❌ WebSocket connection errors in console
- ❌ Database queries returning no data
- ❌ RLS blocking all requests (because `auth.uid()` returns null)

## What We're Doing

We're telling Supabase to trust Clerk's JWT tokens, so when users authenticate with Clerk, Supabase recognizes them and allows database access through RLS policies.

---

## Step 1: Configure Clerk JWT Template

### 1.1 Go to Clerk Dashboard
1. Open [https://dashboard.clerk.com](https://dashboard.clerk.com)
2. Select your **Chrono** project
3. Navigate to: **JWT Templates** (in the left sidebar)

### 1.2 Create Supabase Template
1. Click **"New template"**
2. Select **"Supabase"** from the list of integrations
   - ℹ️ If you don't see it, choose **"Blank"** and follow Step 1.3
3. Click **"Apply changes"**

### 1.3 If Using Blank Template
If you selected "Blank", configure it manually:

**Name:** `supabase` (lowercase, no spaces)

**Claims:**
```json
{
  "aud": "authenticated",
  "exp": "{{user.created_at | plus: 3600}}",
  "sub": "{{user.id}}",
  "email": "{{user.primary_email_address}}",
  "role": "authenticated"
}
```

**Token Lifetime:** 3600 seconds (1 hour)

### 1.4 Important Notes
- ✅ The template name MUST be exactly `supabase` (all lowercase)
- ✅ The `sub` claim contains the user ID that Supabase will use
- ✅ The `aud` claim must be `authenticated` for RLS to work

---

## Step 2: Configure Supabase to Accept Clerk JWTs

### 2.1 Get Your Clerk JWKS URL
Your JWKS URL follows this format:
```
https://better-octopus-67.clerk.accounts.dev/.well-known/jwks.json
```

Based on your `.env.local`, your Clerk domain is: `better-octopus-67.clerk.accounts.dev`

So your JWKS URL is:
```
https://better-octopus-67.clerk.accounts.dev/.well-known/jwks.json
```

### 2.2 Update Supabase Authentication Settings
1. Go to your Supabase dashboard: [https://app.supabase.com](https://app.supabase.com)
2. Select your **Chrono** project
3. Navigate to: **Authentication** → **Providers**
4. Scroll down to **"Custom"** or **"JWT"** section
5. Enable **"Enable custom access token"**
6. Configure:
   - **JWKS URI**: `https://better-octopus-67.clerk.accounts.dev/.well-known/jwks.json`
   - **JWT Secret**: Leave blank (we're using JWKS)
   - **Issuer**: `https://better-octopus-67.clerk.accounts.dev`
   - **Audience**: `authenticated`

7. Click **"Save"**

### 2.3 Alternative: Using SQL (If UI doesn't have JWT settings)

If your Supabase dashboard doesn't show JWT provider settings, you can configure it via SQL:

1. Go to **SQL Editor** in Supabase
2. Run this query:
```sql
-- Enable JWT verification from Clerk
ALTER DATABASE postgres SET "request.jwt.jwks_url" TO 'https://better-octopus-67.clerk.accounts.dev/.well-known/jwks.json';
```

---

## Step 3: Verify Configuration

### 3.1 Check Clerk Template
1. In Clerk Dashboard → JWT Templates
2. Verify you see a template named **"supabase"**
3. Click on it and verify the claims look correct

### 3.2 Test the Integration
1. Restart your dev server:
   ```bash
   npm run dev
   ```

2. Open your app and sign in

3. Check browser console - you should see:
   ```
   ✅ Supabase session established with Clerk auth
   ```

4. Try creating an event or task

5. Go to Supabase Dashboard → **Table Editor** → **events**
   - You should see your new event!

### 3.3 Check for Errors

**If you see WebSocket errors:**
- The JWT template might not be configured correctly
- Check the template name is exactly `supabase` (lowercase)
- Verify JWKS URL in Supabase settings

**If you see "No rows returned":**
- JWT configuration in Supabase is missing
- Check that Supabase has the JWKS URL set
- Verify the issuer and audience match

**If you see "Error getting Clerk token":**
- The JWT template name doesn't match `supabase`
- Go to Clerk Dashboard and verify the template name

---

## Step 4: How Authentication Works

Here's the flow:

```
1. User signs in with Clerk
   ↓
2. SupabaseProvider gets JWT token from Clerk (using 'supabase' template)
   ↓
3. JWT is sent to Supabase via setSession()
   ↓
4. Supabase verifies JWT using Clerk's JWKS endpoint
   ↓
5. Supabase extracts user_id from JWT's 'sub' claim
   ↓
6. RLS policies check: auth.uid() === user_id
   ↓
7. ✅ Database access granted!
```

---

## Troubleshooting

### Problem: WebSocket connection failed

**Solution:**
1. Verify JWT template exists in Clerk Dashboard
2. Check browser console for "Error getting Clerk token"
3. If you see that error, the template name is wrong - it must be `supabase`

### Problem: Data not syncing to Supabase

**Solution:**
1. Check `NEXT_PUBLIC_USE_SUPABASE=true` in `.env.local`
2. Restart dev server after changing `.env.local`
3. Clear browser cache and sign in again
4. Check Supabase logs: Dashboard → Logs → API Logs

### Problem: "Invalid JWT" errors

**Solution:**
1. Verify JWKS URL is correct in Supabase
2. Check that issuer matches your Clerk domain
3. Make sure audience is `authenticated`

### Problem: RLS still blocking queries

**Solution:**
1. Go to Supabase → SQL Editor
2. Run this to test RLS:
```sql
SELECT auth.uid();
```
3. If it returns `null`, JWT verification isn't working
4. Double-check JWKS URL and Clerk JWT template configuration

---

## Testing Checklist

Before moving on, verify:

- [ ] Clerk JWT template named `supabase` exists
- [ ] Supabase JWKS URL is configured
- [ ] Dev server restarted after changes
- [ ] User can sign in
- [ ] Console shows "✅ Supabase session established with Clerk auth"
- [ ] Can create events/tasks
- [ ] Data appears in Supabase Table Editor
- [ ] Real-time sync works (test in two browser tabs)
- [ ] No WebSocket errors in console

---

## What Changed in the Code

### ✅ Updated Files:
1. **SupabaseProvider.jsx** - Now integrates Clerk tokens with Supabase
2. **supabase.js** - Disabled auto-refresh (Clerk manages tokens)
3. **.env.local** - Removed old Convex variables

### ℹ️ No Changes Needed:
- All your event/task management logic
- Frontend components
- Recurrence handling
- View management

Everything works exactly as before - we just connected the auth properly!

---

## Next Steps

Once authentication is working:
1. ✅ Real-time sync will work across devices
2. ✅ Offline mode will queue operations and sync when online
3. ✅ Data persists securely with RLS
4. ✅ You can deploy to production

Ready to deploy? Check `SUPABASE_MIGRATION_GUIDE.md` for production setup.
