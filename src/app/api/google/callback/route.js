import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/?error=no_code', request.url)
    );
  }

  // Use AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET which are the same credentials as Convex Auth
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'http://localhost:3000';
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${baseUrl}/api/google/callback`;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return NextResponse.redirect(
      new URL('/?error=missing_credentials', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      throw new Error(`Failed to exchange code for tokens: ${errorData}`);
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('User info error:', userResponse.status, errorText);
      // If we can't get user info, try to extract email from token or use a fallback
      // The access token might not have userinfo scope
    }

    let userInfo;
    if (userResponse.ok) {
      userInfo = await userResponse.json();
    } else {
      // Fallback: Try to get email from the calendar list API
      const calListResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      
      if (calListResponse.ok) {
        const calData = await calListResponse.json();
        // Use the first calendar's owner email or generate a placeholder
        const primaryCal = calData.items?.find(c => c.primary) || calData.items?.[0];
        userInfo = { 
          email: primaryCal?.id || `user-${Date.now()}@calendar.google.com`
        };
      } else {
        throw new Error('Failed to get user info and calendar list');
      }
    }

    // Get primary calendar info
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    let calendarName = 'Primary';
    if (calendarResponse.ok) {
      const calendarData = await calendarResponse.json();
      calendarName = calendarData.summary || 'Primary';
    }

    // Redirect with tokens - in production, use secure session storage
    // The frontend will pick these up and store them in Convex
    const params = new URLSearchParams({
      google_auth: 'success',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '',
      email: userInfo.email,
      calendar_name: calendarName,
    });

    return NextResponse.redirect(
      new URL(`/?${params.toString()}`, request.url)
    );
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
