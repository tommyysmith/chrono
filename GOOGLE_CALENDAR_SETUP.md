# Google Calendar Sync Setup Guide

This guide will help you set up Google Calendar sync for your Chrono calendar application.

## Prerequisites

1. A Google Cloud Platform (GCP) account
2. Access to Google Cloud Console
3. A deployed instance of your application (for production webhooks)

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID for later use

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, navigate to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Choose **External** (or Internal if using Google Workspace)
3. Fill in the required information:
   - App name: "Chrono Calendar"
   - User support email: Your email
   - Developer contact email: Your email
4. Add the following scopes:
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
5. Save and continue

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. Choose **Web application**
4. Add authorized redirect URIs:
   - For development: `http://localhost:3000/api/google/callback`
   - For production: `https://yourdomain.com/api/google/callback`
5. Click **Create**
6. Copy the **Client ID** and **Client Secret**

## Step 5: Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Google Calendar OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/callback

# Encryption Key for tokens (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=your_encryption_key_here

# Google Calendar Webhook URL (for production)
GOOGLE_WEBHOOK_URL=https://yourdomain.com/api/google/webhook

# Cron Secret (for webhook renewal)
CRON_SECRET=your_cron_secret_here
```

To generate an encryption key, run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Step 6: Install Required Dependencies

Install the Google APIs client library:

```bash
npm install googleapis
```

## Step 7: Run Database Migration

Apply the Google Calendar sync migration to your Supabase database:

```bash
# If using Supabase CLI
supabase db push

# Or manually run the migration file:
# supabase/migrations/005_google_calendar_sync.sql
```

## Step 8: Configure Webhook URL (Production Only)

For real-time sync to work in production:

1. Ensure your production URL is publicly accessible
2. Set `GOOGLE_WEBHOOK_URL` to your production webhook endpoint
3. Configure Vercel Cron (or similar) for webhook renewal:
   - The cron job at `/api/cron/renew-webhooks` runs every 12 hours
   - Set `CRON_SECRET` environment variable to secure the endpoint

## Step 9: Test the Integration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open your app and navigate to Settings > Calendars

3. Click "Connect Google Calendar"

4. Authorize the application

5. Select calendars to sync

6. Events should start syncing automatically!

## Features

### Two-Way Sync
- Events created in Chrono sync to Google Calendar
- Events created in Google Calendar sync to Chrono
- Updates are synced in both directions
- Deletions are synced in both directions

### Real-Time Updates
- Webhook notifications from Google Calendar
- Automatic sync when changes occur
- Webhook renewal every 12 hours to maintain connection

### Manual Sync
- Trigger manual sync from the UI
- Sync all connected calendars at once
- View sync status and last sync time

## Troubleshooting

### OAuth Error: redirect_uri_mismatch
- Ensure your redirect URI in Google Cloud Console exactly matches your app URL
- Check that you're using the correct protocol (http vs https)

### Events Not Syncing
- Check that sync is enabled for the calendar
- Verify webhook is properly configured (check logs)
- Try manual sync from Settings

### Token Expired
- The app automatically refreshes tokens
- If issues persist, disconnect and reconnect the calendar

### Webhook Not Receiving Updates
- Ensure `GOOGLE_WEBHOOK_URL` is publicly accessible
- Check that the URL uses HTTPS in production
- Verify the webhook channel hasn't expired (check database)

## Security Notes

1. **Never commit** your `.env.local` file
2. Store tokens encrypted in the database
3. Use HTTPS in production
4. Rotate encryption keys periodically
5. Use environment-specific OAuth credentials

## API Rate Limits

Google Calendar API has the following limits:
- 1,000,000 queries per day
- 100 queries per 100 seconds per user

The sync engine is designed to work within these limits by:
- Using sync tokens for incremental updates
- Batching operations where possible
- Implementing exponential backoff on errors

## Support

For issues or questions:
- Check the console logs for detailed error messages
- Review the Google Calendar API documentation
- Check the Supabase logs for database issues

## Next Steps

- Implement calendar color mapping
- Add support for calendar-specific settings
- Implement conflict resolution strategies
- Add support for multiple Google accounts
- Implement event reminders sync


