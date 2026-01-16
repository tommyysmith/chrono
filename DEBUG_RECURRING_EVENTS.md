# Debug: Recurring Events Not Saving to Supabase

## Issue Summary
User reports:
- Only **1 event** appears in Supabase (should be ~52 instances)
- `is_repeat` is **FALSE** (should be TRUE)  
- `repeat` field shows **'daily'** (correct)

## Root Cause Analysis

### What SHOULD Happen

When creating a daily repeating event:

```javascript
// 1. Create base event with series info
const newEvent = {
  id: "evt-123",
  title: "Daily Standup",
  repeat: "daily",
  seriesId: "series-456",
  isRepeat: true,  // Boolean(seriesId) = true
  start: today,
  end: today + 1hr
};

// 2. Generate instances (52 by default)
const recurringEvents = generateRecurringEvents(newEvent);
// Returns: [
//   { id: "evt-001", seriesId: "evt-123", isRepeat: true, start: day1... },
//   { id: "evt-002", seriesId: "evt-123", isRepeat: true, start: day2... },
//   ...
// ]

// 3. Save ALL instances to Supabase
await Promise.all(
  recurringEvents.map(instance => 
    supabaseDataAccess.createEvent(userId, instance)
  )
);
```

### What's ACTUALLY Happening

Based on the symptoms (only 1 event, isRepeat=false), one of these is occurring:

#### Hypothesis 1: Silent Failures
The `Promise.all` is failing, but errors are being swallowed by `.catch()`:

```javascript
supabaseDataAccess.createEvent(userId, instance).catch(err => {
  console.error('Failed to sync event instance:', instance.id, err);
  // Error is logged but not re-thrown, so Promise.all continues
})
```

**Check:** Look in browser console for error messages like "Failed to sync event instance"

#### Hypothesis 2: RLS Policy Issue
The Clerk JWT token might not be properly set, causing RLS to reject the inserts:

```sql
CREATE POLICY "Users can insert their own events"
  ON events FOR INSERT
  WITH CHECK (auth.jwt()->>'sub' = user_id);
```

**Check:** If `auth.jwt()->>'sub'` doesn't match `user_id`, insert fails silently

#### Hypothesis 3: generateRecurringEvents Returns Empty/Single Item
Maybe the function isn't generating instances correctly:

```javascript
// Possible early return
if ((!baseEvent.repeat || baseEvent.repeat === 'none') && !baseEvent.rruleOptions) {
  return [baseEvent]; // Only returns base event!
}
```

**Check:** Add console.log to see how many events are generated

#### Hypothesis 4: Wrong Event Being Saved
Maybe the base `newEvent` is being saved instead of the generated instances:

```javascript
// WRONG:
await supabaseDataAccess.createEvent(userId, newEvent);  // Only saves base

// RIGHT:
const recurringEvents = generateRecurringEvents(newEvent);
await Promise.all(
  recurringEvents.map(instance => supabaseDataAccess.createEvent(userId, instance))
);
```

## Debugging Steps

### Step 1: Add Detailed Logging

Update `useEventManagement.js` line 165-187:

```javascript
// Sync with Supabase in background (non-blocking)
if (shouldUseSupabase) {
  (async () => {
    try {
      if (seriesId) {
        console.log('[DEBUG] Creating recurring event series for:', newEvent.id);
        console.log('[DEBUG] SeriesId:', seriesId);
        console.log('[DEBUG] Repeat pattern:', newEvent.repeat);
        
        const recurringEvents = generateRecurringEvents(newEvent);
        console.log('[DEBUG] Generated', recurringEvents.length, 'instances');
        console.log('[DEBUG] First instance:', recurringEvents[0]);
        console.log('[DEBUG] Last instance:', recurringEvents[recurringEvents.length - 1]);
        
        // Create all instances
        const results = await Promise.allSettled(
          recurringEvents.map((instance, index) => 
            supabaseDataAccess.createEvent(userId, instance)
              .then(result => {
                console.log(`[DEBUG] Instance ${index + 1} created successfully:`, instance.id);
                return result;
              })
              .catch(err => {
                console.error(`[DEBUG] Instance ${index + 1} FAILED:`, instance.id, err);
                throw err; // Re-throw to see in Promise.allSettled
              })
          )
        );
        
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[DEBUG] Sync complete: ${succeeded} succeeded, ${failed} failed`);
        
        if (failed > 0) {
          console.error('[DEBUG] Failed results:', results.filter(r => r.status === 'rejected'));
        }
      } else {
        await supabaseDataAccess.createEvent(userId, newEvent);
      }
    } catch (error) {
      console.error('[DEBUG] Top-level error in recurring event creation:', error);
    }
  })();
}
```

### Step 2: Check Supabase Auth

Verify the JWT token is set correctly:

```javascript
import { useAuth } from '@clerk/nextjs';

// In your component:
const { getToken } = useAuth();

// Before creating events:
const token = await getToken({ template: 'supabase' });
console.log('[DEBUG] Clerk JWT token:', token ? 'Present' : 'MISSING!');
```

### Step 3: Check Database Directly

Query Supabase to see what's actually stored:

```sql
-- Check if multiple events exist but aren't being returned
SELECT id, title, repeat, is_repeat, series_id, start
FROM events
WHERE series_id = '<your-series-id>'
ORDER BY start;

-- Check for any events with this repeat pattern
SELECT id, title, repeat, is_repeat, series_id, start
FROM events  
WHERE repeat = 'daily'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 4: Test with Console

In browser console, manually test the generation:

```javascript
// Import the function (if exposed globally, or add temporary global)
const testEvent = {
  id: 'test-123',
  title: 'Test Daily',
  repeat: 'daily',
  start: new Date(),
  end: new Date(Date.now() + 3600000)
};

const instances = generateRecurringEvents(testEvent);
console.log('Generated instances:', instances.length);
console.log('First:', instances[0]);
console.log('Last:', instances[instances.length - 1]);
```

## Expected Findings

### If it's a Silent Failure:
You'll see console errors like:
```
[DEBUG] Generated 52 instances
[DEBUG] Instance 1 created successfully
[DEBUG] Instance 2 FAILED: <error message>
...
[DEBUG] Sync complete: 1 succeeded, 51 failed
```

### If it's an RLS Issue:
Errors will show:
```
new row violates row-level security policy for table "events"
```

### If it's a Generation Issue:
You'll see:
```
[DEBUG] Generated 1 instances
```

## Likely Fix

Based on symptoms, the most likely fix is to change from `Promise.all` with `.catch()` to `Promise.allSettled()` without catch, so we can see all failures:

```javascript
const results = await Promise.allSettled(
  recurringEvents.map(instance => 
    supabaseDataAccess.createEvent(userId, instance)
  )
);

// Check results
const failed = results.filter(r => r.status === 'rejected');
if (failed.length > 0) {
  console.error('Some instances failed to create:', failed);
  // Optionally notify user
}
```

## Temporary Workaround

If Supabase sync is failing, you can temporarily disable it:

```javascript
// In .env.local
NEXT_PUBLIC_USE_SUPABASE=false
```

This will use only localStorage, but at least recurring events will work in the frontend.

## Next Steps

1. Add the detailed logging above
2. Create a test recurring event
3. Check browser console for the debug output
4. Share the console output to identify the exact issue


