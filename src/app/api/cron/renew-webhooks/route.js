// Cron job to renew expiring webhooks
// This can be called by Vercel Cron or any external cron service
import { NextResponse } from 'next/server';
import { supabaseDataAccess } from '@/lib/supabase';
import { googleCalendarSync } from '@/lib/googleCalendarSync';

export async function GET(request) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('Running webhook renewal cron job');

    // This is a simplified version - in production you'd need to:
    // 1. Get all connected calendars from all users
    // 2. Check which ones have expiring webhooks
    // 3. Renew them

    // For now, we'll create a webhook URL
    const webhookUrl = process.env.GOOGLE_WEBHOOK_URL || 
                       `${process.env.NEXT_PUBLIC_APP_URL}/api/google/webhook`;

    // Get all connected calendars with expiring webhooks
    // This would require a custom query in production
    const results = {
      checked: 0,
      renewed: 0,
      failed: 0,
      errors: [],
    };

    // Since we don't have a method to get all calendars across all users,
    // this is a placeholder that shows the structure
    // In production, you'd add a method to supabaseDataAccess like:
    // getAllConnectedCalendarsWithExpiringWebhooks()

    console.log('Webhook renewal completed:', results);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error in webhook renewal cron:', error);
    return NextResponse.json(
      { error: 'Failed to renew webhooks', details: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';


