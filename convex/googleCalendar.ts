import { v } from "convex/values";
import { action, mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper function to refresh Google OAuth access token using refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  
  if (!clientId || !clientSecret) {
    console.error("[refreshAccessToken] Missing Google OAuth credentials in environment");
    return null;
  }
  
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[refreshAccessToken] Failed to refresh token:", response.status, errorText);
      return null;
    }
    
    const data = await response.json();
    console.log("[refreshAccessToken] Successfully refreshed access token");
    
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600, // Default 1 hour
    };
  } catch (error) {
    console.error("[refreshAccessToken] Error refreshing token:", error);
    return null;
  }
}

// Helper to get current user ID (for mutations/queries only)
async function getCurrentUserId(ctx: any) {
  // Try getAuthUserId first
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    return authUserId;
  }
  
  // Fallback: check identity directly
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }
  
  // Try to find user by email or subject
  const email = identity.email;
  const subject = identity.subject;
  
  if (email) {
    // Look up user by email in the users table created by Convex Auth
    const user = await ctx.db
      .query("users")
      .filter((q: any) => q.eq(q.field("email"), email))
      .first();
    if (user) {
      return user._id;
    }
  }
  
  // Return the subject as a fallback (this is the Convex Auth user ID)
  return subject;
}

// Internal query to get Google OAuth tokens from authAccounts table
export const getGoogleAuthTokens = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Query authAccounts table for Google account
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q: any) => q.eq(q.field("userId"), args.userId))
      .collect();
    
    // Find the Google account
    const googleAccount = accounts.find((acc: any) => acc.provider === "google");
    
    if (!googleAccount) {
      return null;
    }
    
    return {
      accessToken: googleAccount.accessToken,
      refreshToken: googleAccount.refreshToken,
      expiresAt: googleAccount.expiresAt,
      providerAccountId: googleAccount.providerAccountId,
    };
  },
});

// Debug query to check all auth data
export const debugAuthData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return { 
        status: "not_authenticated",
        identity: identity ? { 
          email: identity.email,
          name: identity.name,
          subject: identity.subject,
        } : null,
      };
    }
    
    // Get user from users table
    const user = await ctx.db.get(userId);
    
    // Get all authAccounts for this user
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    
    // Get connected calendars
    const calendars = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    return {
      status: "authenticated",
      userId: userId,
      identity: identity ? {
        email: identity.email,
        name: identity.name,
        subject: identity.subject,
        pictureUrl: identity.pictureUrl,
        // Include all identity fields for debugging
        allFields: Object.keys(identity),
        rawIdentity: JSON.parse(JSON.stringify(identity)),
      } : null,
      user: user ? {
        _id: user._id,
        email: (user as any).email,
        name: (user as any).name,
      } : null,
      authAccountsCount: accounts.length,
      authAccounts: accounts.map((acc: any) => ({
        provider: acc.provider,
        providerAccountId: acc.providerAccountId,
        hasAccessToken: !!acc.accessToken || !!(acc as any).access_token,
        tokenFields: Object.keys(acc).filter(k => k.toLowerCase().includes('token')),
        allFields: Object.keys(acc),
      })),
      connectedCalendars: calendars.length,
      calendarDetails: calendars.map(c => ({
        id: c._id,
        email: c.accountEmail,
        hasTokens: !!c.accessTokenEncrypted,
      })),
    };
  },
});

// Mutation to manually setup calendar connection from auth session
export const setupCalendarConnection = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Get identity for email - try multiple sources
    const identity = await ctx.auth.getUserIdentity();
    const user = await ctx.db.get(userId);
    
    // Try to get email from identity or user record
    const email = identity?.email || 
                  (identity as any)?.tokenIdentifier?.split('|')[1] ||
                  (user as any)?.email;
    
    
    if (!email) {
      // Try to get email from authAccounts
      const accounts = await ctx.db
        .query("authAccounts")
        .filter((q: any) => q.eq(q.field("userId"), userId))
        .collect();
      
      const googleAccount = accounts.find((acc: any) => acc.provider === "google");
      const accountEmail = googleAccount?.providerAccountId; // Often the email for Google
      
      if (!accountEmail) {
        throw new Error("No email found - please ensure you're signed in with Google");
      }
      
      // Use providerAccountId as email
      return await createCalendarConnection(ctx, userId, accountEmail, accounts);
    }
    
    // Check if calendar connection already exists
    const existingCalendar = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (existingCalendar) {
      return { success: true, action: "already_exists", calendarId: existingCalendar._id };
    }
    
    // Try to get access token from authAccounts
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    
    return await createCalendarConnection(ctx, userId, email, accounts);
  },
});

// Helper function to create calendar connection
async function createCalendarConnection(ctx: any, userId: any, email: string, accounts: any[]) {
  // Check if calendar connection already exists
  const existingCalendar = await ctx.db
    .query("connectedCalendars")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  
  if (existingCalendar) {
    return { success: true, action: "already_exists", calendarId: existingCalendar._id };
  }
  
  const googleAccount = accounts.find((acc: any) => acc.provider === "google");
  
  // Try different token field names that Convex Auth might use
  let accessToken = null;
  let refreshToken = null;
  
  if (googleAccount) {
    accessToken = (googleAccount as any).accessToken || 
                  (googleAccount as any).access_token ||
                  (googleAccount as any).token;
    refreshToken = (googleAccount as any).refreshToken || 
                   (googleAccount as any).refresh_token;
  }
  
  // If no token found, we'll create a placeholder connection
  if (!accessToken) {
  }
  
  // Create calendar connection
  const calendarId = await ctx.db.insert("connectedCalendars", {
    userId,
    provider: "google",
    accountEmail: email,
    googleCalendarId: email, // Primary calendar uses email as ID
    googleCalendarName: "Primary Calendar",
    syncEnabled: true,
    accessTokenEncrypted: accessToken || "pending_oauth", // Placeholder if no token
    refreshTokenEncrypted: refreshToken || undefined,
    lastSyncedAt: Date.now(),
  });
  
  return { success: true, action: "created", calendarId, hasToken: !!accessToken };
}

// Query to check if user has Google Calendar connected (via authAccounts)
export const hasGoogleCalendarAccess = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { connected: false, reason: "not_authenticated" };
    }
    
    // Check if we have tokens in connectedCalendars
    const calendars = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    if (calendars.length > 0) {
      return { connected: true, calendars: calendars.length };
    }
    
    // Check authAccounts for Google tokens
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    
    const googleAccount = accounts.find((acc: any) => acc.provider === "google");
    
    // Try different token field names
    const hasAccessToken = googleAccount && (
      googleAccount.accessToken || 
      (googleAccount as any).access_token
    );
    
    if (hasAccessToken) {
      return { 
        connected: false, 
        hasAuthTokens: true,
        reason: "tokens_in_auth_not_calendars",
        accountsFound: accounts.length,
      };
    }
    
    return { 
      connected: false, 
      hasAuthTokens: false, 
      reason: "no_tokens",
      accountsFound: accounts.length,
      hasGoogleAccount: !!googleAccount,
      accountKeys: googleAccount ? Object.keys(googleAccount) : [],
    };
  },
});

// Get Google OAuth URL for Calendar access
export const getGoogleAuthUrl = action({
  args: {
    // Pass the origin from the frontend so we use the correct redirect URI
    origin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use AUTH_GOOGLE_ID (same as sign-in) or fall back to GOOGLE_CLIENT_ID
    const clientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
    
    // Use the origin passed from frontend, or fall back to env vars
    const siteUrl = args.origin || process.env.SITE_URL || "http://localhost:3000";
    const redirectUri = `${siteUrl}/api/google/callback`;
    
    
    if (!clientId) {
      throw new Error("Google OAuth not configured - missing AUTH_GOOGLE_ID");
    }
    
    // Request calendar scopes plus email/profile for user info
    const scopes = [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ].join(" ");
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scopes)}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    return { authUrl, redirectUri }; // Return redirectUri for debugging
  },
});

// Setup calendar connection from auth tokens (call after sign-in)
export const setupCalendarFromAuth = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { success: false, reason: "not_authenticated" };
    }
    
    // Get identity for email
    const identity = await ctx.auth.getUserIdentity();
    const email = identity?.email;
    
    if (!email) {
      return { success: false, reason: "no_email" };
    }
    
    // Check authAccounts for Google tokens
    const accounts = await ctx.db
      .query("authAccounts")
      .filter((q: any) => q.eq(q.field("userId"), userId))
      .collect();
    
    
    // Debug: log all accounts and their fields
    accounts.forEach((acc: any, idx: number) => {
      console.log(`[refreshGoogleTokens] Account ${idx}:`, {
        provider: acc.provider,
        providerAccountId: acc.providerAccountId,
        hasAccessToken: !!acc.accessToken,
        hasAccess_token: !!(acc as any).access_token,
        keys: Object.keys(acc),
      });
    });
    
    const googleAccount = accounts.find((acc: any) => acc.provider === "google");
    
    if (!googleAccount) {
      return { success: false, reason: "no_google_account" };
    }
    
    // Try different token field names
    const accessToken = googleAccount.accessToken || (googleAccount as any).access_token;
    const refreshToken = googleAccount.refreshToken || (googleAccount as any).refresh_token;
    const expiresAt = googleAccount.expiresAt || (googleAccount as any).expires_at;
    
    console.log("[refreshGoogleTokens] Token info:", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      expiresAt,
    });
    
    if (!accessToken) {
      return { success: false, reason: "no_access_token", accountKeys: Object.keys(googleAccount) };
    }
    
    
    // Check if calendar connection already exists
    const existing = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    
    if (existing) {
      // Update tokens
      await ctx.db.patch(existing._id, {
        accessTokenEncrypted: accessToken,
        refreshTokenEncrypted: refreshToken,
        tokenExpiry: expiresAt ? expiresAt * 1000 : undefined,
        lastSyncedAt: Date.now(),
      });
      return { success: true, action: "updated" };
    }
    
    // Create new calendar connection
    await ctx.db.insert("connectedCalendars", {
      userId,
      provider: "google",
      accountEmail: email,
      googleCalendarId: email,
      googleCalendarName: "Primary Calendar",
      syncEnabled: true,
      accessTokenEncrypted: accessToken,
      refreshTokenEncrypted: refreshToken,
      tokenExpiry: expiresAt ? expiresAt * 1000 : undefined,
      lastSyncedAt: Date.now(),
    });
    
    return { success: true, action: "created" };
  },
});

// Store Google Calendar connection
export const storeCalendarConnection = mutation({
  args: {
    accountEmail: v.string(),
    googleCalendarId: v.string(),
    googleCalendarName: v.string(),
    googleCalendarDescription: v.optional(v.string()),
    googleCalendarTimezone: v.optional(v.string()),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      const identity = await ctx.auth.getUserIdentity();
      throw new Error("Not authenticated");
    }

    // Check if connection already exists
    const existing = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_google_calendar", (q) => 
        q.eq("userId", userId).eq("googleCalendarId", args.googleCalendarId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accountEmail: args.accountEmail,
        googleCalendarName: args.googleCalendarName,
        googleCalendarDescription: args.googleCalendarDescription,
        googleCalendarTimezone: args.googleCalendarTimezone,
        accessTokenEncrypted: args.accessTokenEncrypted,
        refreshTokenEncrypted: args.refreshTokenEncrypted,
        tokenExpiry: args.tokenExpiry,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    const connectionId = await ctx.db.insert("connectedCalendars", {
      userId,
      provider: "google",
      accountEmail: args.accountEmail,
      googleCalendarId: args.googleCalendarId,
      googleCalendarName: args.googleCalendarName,
      googleCalendarDescription: args.googleCalendarDescription,
      googleCalendarTimezone: args.googleCalendarTimezone,
      syncEnabled: true,
      accessTokenEncrypted: args.accessTokenEncrypted,
      refreshTokenEncrypted: args.refreshTokenEncrypted,
      tokenExpiry: args.tokenExpiry,
      lastSyncedAt: Date.now(),
    });

    return connectionId;
  },
});

// Fix calendar ID to use "primary" instead of email
export const fixCalendarId = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const calendars = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const cal of calendars) {
      if (cal.googleCalendarId !== "primary") {
        await ctx.db.patch(cal._id, {
          googleCalendarId: "primary",
        });
      }
    }

    return { fixed: calendars.length };
  },
});

// List connected calendars
export const listConnectedCalendars = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      return [];
    }

    const calendars = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Log token status for debugging
    for (const cal of calendars) {
      const token = cal.accessTokenEncrypted;
      console.log("[listConnectedCalendars] Calendar:", cal._id,
        "CalendarId:", cal.googleCalendarId,
        "Token status:", token === "pending_oauth" ? "PLACEHOLDER" : token ? `Valid (${token.length} chars)` : "MISSING");
    }

    // Return raw data - timestamps stay as numbers (Convex can't serialize Date objects)
    return calendars;
  },
});

// Fetch all calendars from Google Calendar API that the user has access to
export const fetchGoogleCalendarList = action({
  args: {},
  handler: async (ctx) => {
    // Get connected calendars to get access token
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("No calendars connected - please sign in first");
    }
    
    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, connection[0]);
    
    if (!accessToken || accessToken === "pending_oauth") {
      throw new Error("Invalid access token. Please sign out and sign back in.");
    }
    
    // Fetch calendar list from Google
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[fetchGoogleCalendarList] API error:", response.statusText, errorText);
      throw new Error(`Google Calendar API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    const calendars = data.items || [];
    
    console.log("[fetchGoogleCalendarList] Found", calendars.length, "calendars");
    
    // Return calendar info
    return calendars.map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      accessRole: cal.accessRole,
      backgroundColor: cal.backgroundColor,
      selected: cal.selected,
    }));
  },
});

// Helper to parse Google Calendar RRULE to our rruleOptions format
function parseGoogleRecurrence(recurrence: string[] | undefined, startDate: Date): { repeat: string; rruleOptions: any } | null {
  if (!recurrence || recurrence.length === 0) {
    return null;
  }
  
  // Find the RRULE line
  const rruleLine = recurrence.find(r => r.startsWith('RRULE:'));
  if (!rruleLine) {
    return null;
  }
  
  const rruleStr = rruleLine.replace('RRULE:', '');
  const parts = rruleStr.split(';');
  const rruleMap: Record<string, string> = {};
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      rruleMap[key] = value;
    }
  }
  
  // Map frequency
  const freqMap: Record<string, number> = {
    'DAILY': 3,    // RRule.DAILY
    'WEEKLY': 2,   // RRule.WEEKLY
    'MONTHLY': 1,  // RRule.MONTHLY
    'YEARLY': 0,   // RRule.YEARLY
  };
  
  const freq = freqMap[rruleMap.FREQ] ?? 3;
  const interval = parseInt(rruleMap.INTERVAL || '1', 10);
  
  // Build rruleOptions
  const rruleOptions: any = {
    freq,
    interval,
    dtstart: startDate.getTime(),
  };
  
  // Parse UNTIL if present
  if (rruleMap.UNTIL) {
    // UNTIL format: YYYYMMDDTHHMMSSZ or YYYYMMDD
    const untilStr = rruleMap.UNTIL;
    let untilDate: Date;
    if (untilStr.includes('T')) {
      untilDate = new Date(
        untilStr.slice(0, 4) + '-' + untilStr.slice(4, 6) + '-' + untilStr.slice(6, 8) +
        'T' + untilStr.slice(9, 11) + ':' + untilStr.slice(11, 13) + ':' + untilStr.slice(13, 15) + 'Z'
      );
    } else {
      untilDate = new Date(untilStr.slice(0, 4) + '-' + untilStr.slice(4, 6) + '-' + untilStr.slice(6, 8));
    }
    rruleOptions.until = untilDate.getTime();
  }
  
  // Parse COUNT if present
  if (rruleMap.COUNT) {
    rruleOptions.count = parseInt(rruleMap.COUNT, 10);
  }
  
  // Parse BYDAY if present (for weekly recurrence)
  if (rruleMap.BYDAY) {
    const dayMap: Record<string, number> = {
      'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6
    };
    const days = rruleMap.BYDAY.split(',').map(d => dayMap[d.replace(/[0-9-]/g, '')]).filter(d => d !== undefined);
    if (days.length > 0) {
      rruleOptions.byweekday = days;
    }
  }
  
  // Parse BYMONTHDAY if present
  if (rruleMap.BYMONTHDAY) {
    rruleOptions.bymonthday = rruleMap.BYMONTHDAY.split(',').map(d => parseInt(d, 10));
  }
  
  // Parse BYMONTH if present
  if (rruleMap.BYMONTH) {
    rruleOptions.bymonth = rruleMap.BYMONTH.split(',').map(m => parseInt(m, 10));
  }
  
  // Determine simple repeat value
  let repeat = 'custom';
  if (freq === 3 && interval === 1) {
    repeat = 'daily';
  } else if (freq === 2 && interval === 1) {
    // Check if it's weekdays only
    if (rruleOptions.byweekday && 
        rruleOptions.byweekday.length === 5 &&
        [0, 1, 2, 3, 4].every((d: number) => rruleOptions.byweekday.includes(d))) {
      repeat = 'weekdays';
    } else {
      repeat = 'weekly';
    }
  } else if (freq === 2 && interval === 2) {
    repeat = 'biweekly';
  } else if (freq === 1 && interval === 1) {
    repeat = 'monthly';
  } else if (freq === 0 && interval === 1) {
    repeat = 'yearly';
  }
  
  return { repeat, rruleOptions };
}

// Helper to convert our rruleOptions to Google Calendar RRULE format
function buildGoogleRecurrence(repeat: string, rruleOptions: any, startDate: Date): string[] | undefined {
  if (repeat === 'none' && !rruleOptions) {
    return undefined;
  }
  
  const freqMap: Record<number, string> = {
    0: 'YEARLY',
    1: 'MONTHLY',
    2: 'WEEKLY',
    3: 'DAILY',
  };
  
  const dayMap: Record<number, string> = {
    0: 'MO', 1: 'TU', 2: 'WE', 3: 'TH', 4: 'FR', 5: 'SA', 6: 'SU'
  };
  
  let rruleParts: string[] = [];

  const normalizeNumberArray = (value: any) => {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => (typeof item === 'string' ? parseInt(item, 10) : item))
      .filter((item) => Number.isFinite(item));
  };

  const normalizeByweekday = (value: any) => {
    if (!Array.isArray(value)) return [];
    const stringMap: Record<string, number> = {
      MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6,
    };
    return value
      .map((day) => {
        if (typeof day === 'number') return day;
        if (typeof day === 'string') return stringMap[day.toUpperCase()];
        if (day && typeof day === 'object') {
          if (typeof day.weekday === 'number') return day.weekday;
          if (typeof day.day === 'number') return day.day;
        }
        return undefined;
      })
      .filter((day) => Number.isFinite(day));
  };

  const hasRRuleOptions = !!rruleOptions && (
    typeof rruleOptions.freq === 'number' ||
    typeof rruleOptions.interval === 'number' ||
    rruleOptions.until ||
    rruleOptions.count ||
    (Array.isArray(rruleOptions.byweekday) && rruleOptions.byweekday.length > 0) ||
    (Array.isArray(rruleOptions.bymonthday) && rruleOptions.bymonthday.length > 0) ||
    (Array.isArray(rruleOptions.bymonth) && rruleOptions.bymonth.length > 0)
  );

  const effectiveRRuleOptions = hasRRuleOptions ? rruleOptions : null;
  
  if (effectiveRRuleOptions) {
    // Use rruleOptions if available
    const freq = freqMap[effectiveRRuleOptions.freq] || 'DAILY';
    rruleParts.push(`FREQ=${freq}`);
    
    if (effectiveRRuleOptions.interval && effectiveRRuleOptions.interval > 1) {
      rruleParts.push(`INTERVAL=${effectiveRRuleOptions.interval}`);
    }
    
    if (effectiveRRuleOptions.until) {
      const untilDate = new Date(effectiveRRuleOptions.until);
      const untilStr = untilDate.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rruleParts.push(`UNTIL=${untilStr}`);
    }
    
    if (effectiveRRuleOptions.count) {
      rruleParts.push(`COUNT=${effectiveRRuleOptions.count}`);
    }
    
    const byweekday = normalizeByweekday(effectiveRRuleOptions.byweekday);
    if (byweekday.length > 0) {
      const days = byweekday.map((d: number) => dayMap[d]).filter(Boolean).join(',');
      if (days) {
        rruleParts.push(`BYDAY=${days}`);
      }
    }
    
    const bymonthday = normalizeNumberArray(effectiveRRuleOptions.bymonthday);
    if (bymonthday.length > 0) {
      rruleParts.push(`BYMONTHDAY=${bymonthday.join(',')}`);
    }
    
    const bymonth = normalizeNumberArray(effectiveRRuleOptions.bymonth);
    if (bymonth.length > 0) {
      rruleParts.push(`BYMONTH=${bymonth.join(',')}`);
    }
  } else {
    // Build from simple repeat value
    const jsToRRule: Record<number, string> = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
    const dayOfWeek = startDate.getDay();
    const dayOfMonth = startDate.getDate();
    
    switch (repeat) {
      case 'daily':
        rruleParts.push('FREQ=DAILY');
        break;
      case 'weekday':
      case 'weekdays':
        rruleParts.push('FREQ=WEEKLY', 'BYDAY=MO,TU,WE,TH,FR');
        break;
      case 'weekly':
        rruleParts.push('FREQ=WEEKLY');
        rruleParts.push(`BYDAY=${jsToRRule[dayOfWeek]}`);
        break;
      case 'biweekly':
        rruleParts.push('FREQ=WEEKLY', 'INTERVAL=2');
        rruleParts.push(`BYDAY=${jsToRRule[dayOfWeek]}`);
        break;
      case 'monthly':
        rruleParts.push('FREQ=MONTHLY');
        rruleParts.push(`BYMONTHDAY=${dayOfMonth}`);
        break;
      case 'monthlyWeekday':
        // e.g., "2nd Monday of every month"
        const weekNum = Math.ceil(dayOfMonth / 7);
        rruleParts.push('FREQ=MONTHLY');
        rruleParts.push(`BYDAY=${weekNum}${jsToRRule[dayOfWeek]}`);
        break;
      case 'monthlyLastWeekday':
        // e.g., "Last Monday of every month"
        rruleParts.push('FREQ=MONTHLY');
        rruleParts.push(`BYDAY=-1${jsToRRule[dayOfWeek]}`);
        break;
      case 'yearly':
        rruleParts.push('FREQ=YEARLY');
        break;
      default:
        return undefined;
    }
  }
  
  return rruleParts.length > 0 ? [`RRULE:${rruleParts.join(';')}`] : undefined;
}

// Internal mutation to update calendar tokens after refresh
export const updateCalendarTokens = internalMutation({
  args: {
    calendarId: v.id("connectedCalendars"),
    accessToken: v.string(),
    tokenExpiry: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.calendarId, {
      accessTokenEncrypted: args.accessToken,
      tokenExpiry: args.tokenExpiry,
      lastSyncedAt: Date.now(),
    });
  },
});

// Helper to get a valid access token, refreshing if needed
async function getValidAccessToken(
  ctx: any,
  calendar: any,
  forceRefresh: boolean = false
): Promise<string | null> {
  let accessToken = calendar.accessTokenEncrypted;
  const refreshToken = calendar.refreshTokenEncrypted;
  const tokenExpiry = calendar.tokenExpiry;
  
  // Check if token is expired or about to expire (within 5 minutes)
  const now = Date.now();
  const isExpired = tokenExpiry && now >= tokenExpiry - 5 * 60 * 1000;
  
  // Refresh if expired, forced, or if we don't have a valid expiry time (proactive refresh)
  const shouldRefresh = forceRefresh || isExpired || !tokenExpiry;
  
  if (shouldRefresh && refreshToken) {
    console.log("[getValidAccessToken] Attempting token refresh...", { forceRefresh, isExpired, hasExpiry: !!tokenExpiry });
    const refreshResult = await refreshAccessToken(refreshToken);
    
    if (refreshResult) {
      accessToken = refreshResult.accessToken;
      const newExpiry = now + refreshResult.expiresIn * 1000;
      
      // Update the token in the database
      await ctx.runMutation(internal.googleCalendar.updateCalendarTokens, {
        calendarId: calendar._id,
        accessToken: accessToken,
        tokenExpiry: newExpiry,
      });
      
      console.log("[getValidAccessToken] Token refreshed successfully");
    } else {
      console.error("[getValidAccessToken] Failed to refresh token");
      // If force refresh failed, return null; otherwise return existing token to try
      if (forceRefresh) return null;
    }
  }
  
  return accessToken;
}

// Sync events from Google Calendar (HTTP action) - Enhanced with RRULE support
export const syncGoogleCalendar = action({
  args: {
    calendarId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get calendar connection (auth is checked in the query)
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("Not authenticated or no calendars connected");
    }
    
    const calendar = connection.find((c: any) => c.googleCalendarId === args.calendarId);
    
    if (!calendar) {
      throw new Error("Calendar connection not found");
    }

    // Get or create a default view for the events
    const defaultViewId = await ctx.runMutation(api.views.getOrCreateDefaultView);

    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, calendar);
    
    // Check if we have a valid token (not a placeholder)
    if (!accessToken || accessToken === "pending_oauth") {
      console.error("[syncGoogleCalendar] Invalid access token - user needs to sign out and sign back in to get fresh OAuth tokens");
      throw new Error("Invalid access token. Please sign out and sign back in to refresh your Google Calendar connection.");
    }
    

    // Fetch events from Google Calendar API
    // Note: We do NOT use singleEvents=true so we get recurring event masters with RRULE
    // showHiddenInvitations=true ensures we get events the user hasn't responded to yet
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1); // Get events from 1 month ago
    
    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?` +
      `timeMin=${timeMin.toISOString()}&` +
      `maxResults=2500&` +
      `singleEvents=false&` +
      `showHiddenInvitations=true`;
    
    console.log("[syncGoogleCalendar] Fetching from calendar:", args.calendarId);
    console.log("[syncGoogleCalendar] API URL:", apiUrl);
    
    let response = await fetch(
      apiUrl,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // If we get a 401, try refreshing the token and retry once
    if (response.status === 401 && calendar.refreshTokenEncrypted) {
      console.log("[syncGoogleCalendar] Got 401, attempting token refresh and retry...");
      const refreshedToken = await getValidAccessToken(ctx, calendar, true);
      
      if (refreshedToken && refreshedToken !== accessToken) {
        console.log("[syncGoogleCalendar] Retrying with refreshed token...");
        response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${refreshedToken}`,
          },
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[syncGoogleCalendar] API error:", response.statusText, errorText);
      throw new Error(`Google Calendar API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    
    // Debug: Log event count and response status info
    console.log("[syncGoogleCalendar] Total events fetched:", googleEvents.length);
    
    // Debug: Log events with their response status
    for (const event of googleEvents.slice(0, 10)) {
      const selfAttendee = event.attendees?.find((a: any) => a.self);
      console.log("[syncGoogleCalendar] Event:", event.summary, 
        "| Status:", event.status,
        "| Self response:", selfAttendee?.responseStatus || "N/A",
        "| Is organizer:", event.organizer?.self || false,
        "| Attendees count:", event.attendees?.length || 0
      );
    }

    // Get existing events to check for updates
    const existingEvents = await ctx.runQuery(api.events.listEvents);
    const existingByExternalId = new Map(
      existingEvents
        .filter((e: any) => e.externalId)
        .map((e: any) => [e.externalId, e])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const googleEvent of googleEvents) {
      // Skip cancelled events
      if (googleEvent.status === 'cancelled') {
        skipped++;
        continue;
      }
      
      const existing = existingByExternalId.get(googleEvent.id);
      
      // Parse start/end times
      const isAllDay = !!googleEvent.start?.date;
      const startTime = googleEvent.start?.dateTime 
        ? new Date(googleEvent.start.dateTime).getTime()
        : googleEvent.start?.date 
          ? new Date(googleEvent.start.date + "T00:00:00").getTime()
          : Date.now();
      const endTime = googleEvent.end?.dateTime
        ? new Date(googleEvent.end.dateTime).getTime()
        : googleEvent.end?.date
          ? new Date(googleEvent.end.date + "T00:00:00").getTime()
          : startTime + 3600000; // Default 1 hour
      
      // Parse recurrence
      const recurrenceData = parseGoogleRecurrence(googleEvent.recurrence, new Date(startTime));
      
      // Parse attendees
      const attendees = googleEvent.attendees?.map((att: any) => ({
        email: att.email || "",
        displayName: att.displayName,
        responseStatus: att.responseStatus,
        organizer: att.organizer,
        self: att.self,
      })) || undefined;
      
      // Get current user's response status from attendees
      const selfAttendee = attendees?.find((att: any) => att.self);
      const myResponseStatus = selfAttendee?.responseStatus || 
        (googleEvent.organizer?.self ? 'accepted' : 'needsAction');
      
      // Parse organizer
      const organizer = googleEvent.organizer ? {
        email: googleEvent.organizer.email || "",
        displayName: googleEvent.organizer.displayName,
        self: googleEvent.organizer.self,
      } : undefined;
      
      // Parse attachments (Notion docs, Google Docs, etc.)
      const attachments = googleEvent.attachments?.map((att: any) => ({
        fileUrl: att.fileUrl,
        title: att.title,
        mimeType: att.mimeType,
        iconLink: att.iconLink,
        fileId: att.fileId,
      })) || undefined;
      
      const eventData = {
        title: googleEvent.summary || "(No title)",
        description: googleEvent.description || "",
        location: googleEvent.location || "",
        start: startTime,
        end: endTime,
        isAllDay,
        color: "#F59E0B", // Use default color
        repeat: recurrenceData?.repeat || "none",
        isRepeat: !!recurrenceData,
        rruleOptions: recurrenceData?.rruleOptions,
        viewId: defaultViewId,
        source: "google",
        externalId: googleEvent.id,
        externalCalendarId: args.calendarId,
        lastSyncedAt: Date.now(),
        syncStatus: "synced",
        isDraft: false,
        // Google Meet / Conference data
        hangoutLink: googleEvent.hangoutLink || undefined,
        conferenceData: googleEvent.conferenceData || undefined,
        // Attendees and organizer
        attendees,
        organizer,
        // Current user's RSVP response status
        myResponseStatus,
        // Attachments (Notion docs, Google Docs, etc.)
        attachments,
      };

      if (existing) {
        // Check if Google event is newer (using updated timestamp)
        const googleUpdated = googleEvent.updated ? new Date(googleEvent.updated).getTime() : 0;
        const localUpdated = (existing as any).lastSyncedAt || 0;
        
        // Always update to keep in sync (Google is source of truth for Google events)
        await ctx.runMutation(api.events.updateEvent, {
          id: (existing as any)._id,
          ...eventData,
        });
        updated++;
      } else {
        await ctx.runMutation(api.events.createEvent, eventData);
        created++;
      }
    }

    // Update sync token for incremental sync
    await ctx.runMutation(api.googleCalendar.updateSyncToken, {
      calendarId: args.calendarId,
      syncToken: data.nextSyncToken,
      lastSyncedAt: Date.now(),
    });

    return { created, updated, skipped, total: googleEvents.length };
  },
});

// Update sync token
export const updateSyncToken = mutation({
  args: {
    calendarId: v.string(),
    syncToken: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const calendar = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_google_calendar", (q) => 
        q.eq("userId", userId).eq("googleCalendarId", args.calendarId)
      )
      .first();

    if (calendar) {
      await ctx.db.patch(calendar._id, {
        syncToken: args.syncToken,
        lastSyncedAt: args.lastSyncedAt,
      });
    }
  },
});

// Disconnect a calendar
export const disconnectCalendar = mutation({
  args: {
    calendarId: v.id("connectedCalendars"),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const calendar = await ctx.db.get(args.calendarId);
    if (!calendar || calendar.userId !== userId) {
      throw new Error("Calendar not found");
    }

    await ctx.db.delete(args.calendarId);
    return { success: true };
  },
});

// Toggle sync for a calendar
export const toggleCalendarSync = mutation({
  args: {
    calendarId: v.id("connectedCalendars"),
    syncEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const calendar = await ctx.db.get(args.calendarId);
    if (!calendar || calendar.userId !== userId) {
      throw new Error("Calendar not found");
    }

    await ctx.db.patch(args.calendarId, {
      syncEnabled: args.syncEnabled,
    });
    return { success: true };
  },
});

// Connect an additional Google Calendar (uses existing access token)
export const connectAdditionalCalendar = mutation({
  args: {
    googleCalendarId: v.string(),
    calendarName: v.string(),
    backgroundColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if this calendar is already connected
    const existing = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_google_calendar", (q) => 
        q.eq("userId", userId).eq("googleCalendarId", args.googleCalendarId)
      )
      .first();

    if (existing) {
      return { success: false, reason: "already_connected", calendarId: existing._id };
    }

    // Get an existing connected calendar to copy the access token
    const existingCalendar = await ctx.db
      .query("connectedCalendars")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!existingCalendar) {
      throw new Error("No existing calendar connection found - please connect your primary calendar first");
    }

    // Create new calendar connection with same access token
    const calendarId = await ctx.db.insert("connectedCalendars", {
      userId,
      provider: "google",
      accountEmail: existingCalendar.accountEmail,
      googleCalendarId: args.googleCalendarId,
      googleCalendarName: args.calendarName,
      accessTokenEncrypted: existingCalendar.accessTokenEncrypted,
      refreshTokenEncrypted: existingCalendar.refreshTokenEncrypted,
      tokenExpiry: existingCalendar.tokenExpiry,
      syncEnabled: true,
      lastSyncedAt: undefined,
      syncToken: undefined,
    });

    return { success: true, calendarId };
  },
});

// Create event in Google Calendar - Enhanced with recurrence support and Google Meet
export const createGoogleEvent = action({
  args: {
    calendarId: v.string(),
    event: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      location: v.optional(v.string()),
      start: v.number(),
      end: v.number(),
      isAllDay: v.boolean(),
      repeat: v.optional(v.string()),
      rruleOptions: v.optional(v.any()),
      attendees: v.optional(v.array(v.object({
        email: v.string(),
        displayName: v.optional(v.string()),
        responseStatus: v.optional(v.string()),
      }))),
      // Google Meet conferencing
      addGoogleMeet: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    
    // Get calendar connection (auth is checked in the query)
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("Not authenticated or no calendars connected");
    }
    
    const calendar = connection.find((c: any) => c.googleCalendarId === args.calendarId);
    
    if (!calendar) {
      throw new Error("Calendar connection not found");
    }

    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, calendar);
    
    if (!accessToken) {
      throw new Error("Failed to get valid access token. Please sign out and sign back in.");
    }
    
    const startDate = new Date(args.event.start);
    const endDate = new Date(args.event.end);
    
    // Use calendar timezone when available; otherwise default to UTC
    const rawTimeZone = calendar.timeZone ?? calendar.googleCalendarTimezone ?? "UTC";
    const timeZone = typeof rawTimeZone === "string" && rawTimeZone.trim() ? rawTimeZone : "UTC";
    const isAllDay = args.event.isAllDay === true;

    const googleEvent: any = {
      summary: args.event.title,
      description: args.event.description || "",
      location: args.event.location || "",
      start: isAllDay
        ? { date: startDate.toISOString().split("T")[0] }
        : { dateTime: startDate.toISOString(), timeZone },
      end: isAllDay
        ? { date: endDate.toISOString().split("T")[0] }
        : { dateTime: endDate.toISOString(), timeZone },
    };

    // Final guard: ensure timed events always include a valid timeZone
    if (!isAllDay) {
      if (!googleEvent.start?.timeZone) {
        googleEvent.start = { ...googleEvent.start, timeZone };
      }
      if (!googleEvent.end?.timeZone) {
        googleEvent.end = { ...googleEvent.end, timeZone };
      }
    }

    // Add attendees if specified
    if (args.event.attendees && args.event.attendees.length > 0) {
      googleEvent.attendees = args.event.attendees.map((attendee: any) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus || 'needsAction',
      }));
    }

    // Add recurrence if specified
    console.log("[createGoogleEvent] Building recurrence - repeat:", args.event.repeat, "rruleOptions:", JSON.stringify(args.event.rruleOptions));
    const recurrence = buildGoogleRecurrence(
      args.event.repeat || 'none',
      args.event.rruleOptions,
      startDate
    );
    console.log("[createGoogleEvent] Built recurrence:", JSON.stringify(recurrence));
    if (recurrence) {
      googleEvent.recurrence = recurrence;
    }
    
    console.log("[createGoogleEvent] Final googleEvent object:", JSON.stringify(googleEvent));

    // Add Google Meet conferencing if requested
    if (args.event.addGoogleMeet) {
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      };
    }

    // Build URL with conferenceDataVersion if adding Google Meet
    const apiUrl = args.event.addGoogleMeet
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events?sendUpdates=all`;

    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[createGoogleEvent] Failed:", response.statusText, errorText);
      throw new Error(`Failed to create Google Calendar event: ${response.statusText} - ${errorText}`);
    }

    const createdEvent = await response.json();
    return { 
      googleEventId: createdEvent.id,
      hangoutLink: createdEvent.hangoutLink || null,
      conferenceData: createdEvent.conferenceData || null,
    };
  },
});

// Update event in Google Calendar
export const updateGoogleEvent = action({
  args: {
    calendarId: v.string(),
    googleEventId: v.string(),
    event: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      location: v.optional(v.string()),
      start: v.optional(v.number()),
      end: v.optional(v.number()),
      isAllDay: v.optional(v.boolean()),
      repeat: v.optional(v.string()),
      rruleOptions: v.optional(v.any()),
      attendees: v.optional(v.array(v.object({
        email: v.string(),
        displayName: v.optional(v.string()),
        responseStatus: v.optional(v.string()),
      }))),
      // Google Meet conferencing
      addGoogleMeet: v.optional(v.boolean()),
      removeGoogleMeet: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    
    // Get calendar connection
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("Not authenticated or no calendars connected");
    }
    
    const calendar = connection.find((c: any) => c.googleCalendarId === args.calendarId);
    
    if (!calendar) {
      throw new Error("Calendar connection not found");
    }

    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, calendar);
    
    if (!accessToken) {
      throw new Error("Failed to get valid access token. Please sign out and sign back in.");
    }

    // First, get the existing event to merge with updates
    const getResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.googleEventId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error("[updateGoogleEvent] Failed to get event:", getResponse.statusText, errorText);
      throw new Error(`Failed to get Google Calendar event: ${getResponse.statusText}`);
    }

    const existingEvent = await getResponse.json();

    // Build updated event
    const isAllDay = args.event.isAllDay ?? !!existingEvent.start?.date;
    const startDate = args.event.start ? new Date(args.event.start) : null;
    const endDate = args.event.end ? new Date(args.event.end) : null;
    
    // Use calendar timezone when available; otherwise default to UTC
    const timeZone = calendar.timeZone || calendar.googleCalendarTimezone || "UTC";

    const googleEvent: any = {
      summary: args.event.title ?? existingEvent.summary,
      description: args.event.description ?? existingEvent.description ?? "",
      location: args.event.location ?? existingEvent.location ?? "",
    };

    // Update start/end if provided
    if (startDate) {
      googleEvent.start = isAllDay
        ? { date: startDate.toISOString().split("T")[0] }
        : { dateTime: startDate.toISOString(), timeZone };
    }
    if (endDate) {
      googleEvent.end = isAllDay
        ? { date: endDate.toISOString().split("T")[0] }
        : { dateTime: endDate.toISOString(), timeZone };
    }

    if (!isAllDay) {
      if (googleEvent.start?.dateTime && !googleEvent.start.timeZone) {
        googleEvent.start = { ...googleEvent.start, timeZone };
      }
      if (googleEvent.end?.dateTime && !googleEvent.end.timeZone) {
        googleEvent.end = { ...googleEvent.end, timeZone };
      }
    }

    // Update recurrence if specified
    if (args.event.repeat !== undefined || args.event.rruleOptions !== undefined) {
      const recurrence = buildGoogleRecurrence(
        args.event.repeat || 'none',
        args.event.rruleOptions,
        startDate || new Date(existingEvent.start?.dateTime || existingEvent.start?.date)
      );
      if (recurrence) {
        googleEvent.recurrence = recurrence;
      } else {
        // Remove recurrence
        googleEvent.recurrence = null;
      }
    }

    // Update attendees if specified
    if (args.event.attendees !== undefined) {
      googleEvent.attendees = args.event.attendees.map((attendee: any) => ({
        email: attendee.email,
        displayName: attendee.displayName,
        responseStatus: attendee.responseStatus || 'needsAction',
      }));
    }

    // Handle Google Meet conferencing
    let needsConferenceDataVersion = false;
    if (args.event.addGoogleMeet && !existingEvent.hangoutLink) {
      // Add Google Meet to an event that doesn't have one
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      };
      needsConferenceDataVersion = true;
    } else if (args.event.removeGoogleMeet && existingEvent.hangoutLink) {
      // Remove Google Meet from an event
      googleEvent.conferenceData = null;
      needsConferenceDataVersion = true;
    }

    // Build URL with conferenceDataVersion if modifying conference data
    const apiUrl = needsConferenceDataVersion
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.googleEventId)}?sendUpdates=all&conferenceDataVersion=1`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.googleEventId)}?sendUpdates=all`;

    const response = await fetch(
      apiUrl,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(googleEvent),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[updateGoogleEvent] Failed:", response.statusText, errorText);
      throw new Error(`Failed to update Google Calendar event: ${response.statusText} - ${errorText}`);
    }

    const updatedEvent = await response.json();
    return { 
      success: true, 
      googleEventId: updatedEvent.id,
      hangoutLink: updatedEvent.hangoutLink || null,
      conferenceData: updatedEvent.conferenceData || null,
    };
  },
});

// Delete event from Google Calendar
export const deleteGoogleEvent = action({
  args: {
    calendarId: v.string(),
    googleEventId: v.string(),
  },
  handler: async (ctx, args) => {
    
    // Get calendar connection
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("Not authenticated or no calendars connected");
    }
    
    const calendar = connection.find((c: any) => c.googleCalendarId === args.calendarId);
    
    if (!calendar) {
      throw new Error("Calendar connection not found");
    }

    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, calendar);
    
    if (!accessToken) {
      throw new Error("Failed to get valid access token. Please sign out and sign back in.");
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.googleEventId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 204 No Content is success, 404 means already deleted
    if (!response.ok && response.status !== 204 && response.status !== 404) {
      const errorText = await response.text();
      console.error("[deleteGoogleEvent] Failed:", response.statusText, errorText);
      throw new Error(`Failed to delete Google Calendar event: ${response.statusText} - ${errorText}`);
    }

    return { success: true };
  },
});

// Update a specific instance of a recurring event in Google Calendar
// This is used for "This event" edits where only one occurrence is modified
export const updateRecurringEventInstance = action({
  args: {
    calendarId: v.string(),
    recurringEventId: v.string(), // The base recurring event's Google ID
    originalStartTime: v.string(), // ISO string of the original start time (e.g., "2026-01-20T13:00:00Z")
    newStart: v.number(), // New start time as timestamp
    newEnd: v.number(), // New end time as timestamp
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    isAllDay: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Get calendar connection
    const connection = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!connection || connection.length === 0) {
      throw new Error("Not authenticated or no calendars connected");
    }
    
    const calendar = connection.find((c: any) => c.googleCalendarId === args.calendarId);
    
    if (!calendar) {
      throw new Error("Calendar connection not found");
    }

    // Get access token (with automatic refresh if expired)
    const accessToken = await getValidAccessToken(ctx, calendar);
    
    if (!accessToken) {
      throw new Error("Failed to get valid access token. Please sign out and sign back in.");
    }

    // Build the instance ID: recurringEventId_originalStartTime (in RFC3339 format without punctuation)
    // Google uses format like: eventId_20260120T130000Z
    const originalDate = new Date(args.originalStartTime);
    const formattedOriginalStart = originalDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const instanceId = `${args.recurringEventId}_${formattedOriginalStart}`;
    
    console.log("[updateRecurringEventInstance] Updating instance:", {
      recurringEventId: args.recurringEventId,
      originalStartTime: args.originalStartTime,
      instanceId,
      newStart: new Date(args.newStart).toISOString(),
      newEnd: new Date(args.newEnd).toISOString(),
    });

    // First, try to get the specific instance
    const getResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(instanceId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!getResponse.ok) {
      // If instance doesn't exist, try getting instances list and find the right one
      console.log("[updateRecurringEventInstance] Instance not found directly, trying instances list");
      
      const instancesResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(args.calendarId)}/events/${encodeURIComponent(args.recurringEventId)}/instances?timeMin=${encodeURIComponent(new Date(args.originalStartTime).toISOString())}&timeMax=${encodeURIComponent(new Date(new Date(args.originalStartTime).getTime() + 86400000).toISOString())}&maxResults=10`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!instancesResponse.ok) {
        const errorText = await instancesResponse.text();
        console.error("[updateRecurringEventInstance] Failed to get instances:", errorText);
        throw new Error(`Failed to get recurring event instances: ${instancesResponse.statusText}`);
      }
      
      const instancesData = await instancesResponse.json();
      const targetInstance = instancesData.items?.find((inst: any) => {
        const instStart = new Date(inst.start?.dateTime || inst.start?.date).getTime();
        const targetStart = new Date(args.originalStartTime).getTime();
        // Allow 1 minute tolerance for matching
        return Math.abs(instStart - targetStart) < 60000;
      });
      
      if (!targetInstance) {
        console.error("[updateRecurringEventInstance] Could not find matching instance");
        throw new Error("Could not find the specific recurring event instance");
      }
      
      // Use the found instance ID
      const foundInstanceId = targetInstance.id;
      console.log("[updateRecurringEventInstance] Found instance via list:", foundInstanceId);
      
      // Update the found instance
      return await updateInstanceById(ctx, accessToken, args.calendarId, foundInstanceId, args, calendar);
    }

    const existingInstance = await getResponse.json();
    console.log("[updateRecurringEventInstance] Found instance directly:", existingInstance.id);
    
    // Update the instance
    return await updateInstanceById(ctx, accessToken, args.calendarId, instanceId, args, calendar);
  },
});

// Helper function to update an instance by its ID
async function updateInstanceById(
  ctx: any,
  accessToken: string,
  calendarId: string,
  instanceId: string,
  args: {
    newStart: number;
    newEnd: number;
    title?: string;
    description?: string;
    location?: string;
    isAllDay?: boolean;
  },
  calendar: any
) {
  const timeZone = calendar.timeZone || calendar.googleCalendarTimezone || "UTC";
  const isAllDay = args.isAllDay ?? false;
  
  const startDate = new Date(args.newStart);
  const endDate = new Date(args.newEnd);
  
  const googleEvent: any = {};
  
  if (args.title !== undefined) {
    googleEvent.summary = args.title;
  }
  if (args.description !== undefined) {
    googleEvent.description = args.description;
  }
  if (args.location !== undefined) {
    googleEvent.location = args.location;
  }
  
  if (isAllDay) {
    googleEvent.start = { date: startDate.toISOString().split('T')[0] };
    googleEvent.end = { date: endDate.toISOString().split('T')[0] };
  } else {
    googleEvent.start = { dateTime: startDate.toISOString(), timeZone };
    googleEvent.end = { dateTime: endDate.toISOString(), timeZone };
  }

  console.log("[updateInstanceById] Updating with:", googleEvent);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(instanceId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(googleEvent),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[updateInstanceById] Failed:", response.statusText, errorText);
    throw new Error(`Failed to update recurring event instance: ${response.statusText} - ${errorText}`);
  }

  const updatedInstance = await response.json();
  console.log("[updateInstanceById] Successfully updated instance:", updatedInstance.id);
  
  return {
    success: true,
    instanceId: updatedInstance.id,
  };
}

// Push local event to Google Calendar (for bi-directional sync)
export const pushEventToGoogle = action({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    // Get the event from our database
    const events = await ctx.runQuery(api.events.listEvents);
    const event = events.find((e: any) => e._id === args.eventId || e.id === args.eventId);
    
    if (!event) {
      throw new Error("Event not found");
    }
    
    // DEBUG: Log the event data from Convex
    console.log("[pushEventToGoogle] Event from Convex - repeat:", event.repeat, "rruleOptions:", JSON.stringify(event.rruleOptions));
    
    // Get connected calendars
    const calendars = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!calendars || calendars.length === 0) {
      return { success: false, reason: "no_calendars" };
    }
    
    // Use the first connected calendar (primary)
    const calendar = calendars[0];
    const calendarId = calendar.googleCalendarId;
    
    const eventData = {
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      start: event.start instanceof Date ? event.start.getTime() : event.start,
      end: event.end instanceof Date ? event.end.getTime() : event.end,
      isAllDay: event.isAllDay === true,
      repeat: event.repeat || "none",
      rruleOptions: event.rruleOptions,
      attendees: event.attendees || undefined,
      addGoogleMeet: event.addGoogleMeet || false,
    };
    
    // DEBUG: Log the eventData being sent
    console.log("[pushEventToGoogle] eventData being sent - repeat:", eventData.repeat, "rruleOptions:", JSON.stringify(eventData.rruleOptions));
    
    if (event.externalId) {
      // Update existing Google event
      const result = await ctx.runAction(api.googleCalendar.updateGoogleEvent, {
        calendarId,
        googleEventId: event.externalId,
        event: eventData,
      });
      
      // Update local event with hangoutLink if returned
      if (result.hangoutLink) {
        await ctx.runMutation(api.events.updateEvent, {
          id: event._id,
          hangoutLink: result.hangoutLink,
        });
      }
      
      // Update local event with sync status
      await ctx.runMutation(api.events.updateEvent, {
        id: event._id,
        lastSyncedAt: Date.now(),
        syncStatus: "synced",
      });
      
      return { success: true, action: "updated", googleEventId: event.externalId };
    } else {
      // Create new Google event
      const result = await ctx.runAction(api.googleCalendar.createGoogleEvent, {
        calendarId,
        event: eventData,
      });
      
      // Update local event with Google ID and hangoutLink if returned
      await ctx.runMutation(api.events.updateEvent, {
        id: event._id,
        externalId: result.googleEventId,
        externalCalendarId: calendarId,
        source: "local", // Keep as local since it originated here
        lastSyncedAt: Date.now(),
        syncStatus: "synced",
        hangoutLink: result.hangoutLink || undefined,
      });
      
      return { success: true, action: "created", googleEventId: result.googleEventId, hangoutLink: result.hangoutLink };
    }
  },
});

// Full bi-directional sync
export const fullSync = action({
  args: {},
  handler: async (ctx) => {
    
    // Get connected calendars
    const calendars = await ctx.runQuery(api.googleCalendar.listConnectedCalendars);
    
    if (!calendars || calendars.length === 0) {
      return { success: false, reason: "no_calendars" };
    }
    
    const results = {
      fromGoogle: { created: 0, updated: 0, skipped: 0 },
      toGoogle: { created: 0, updated: 0, failed: 0 },
    };
    
    // Sync FROM Google for each connected calendar
    for (const calendar of calendars) {
      if (!calendar.syncEnabled) continue;
      
      try {
        const syncResult = await ctx.runAction(api.googleCalendar.syncGoogleCalendar, {
          calendarId: calendar.googleCalendarId,
        });
        results.fromGoogle.created += syncResult.created;
        results.fromGoogle.updated += syncResult.updated;
        results.fromGoogle.skipped += syncResult.skipped;
      } catch (error) {
        console.error("[fullSync] Error syncing from Google:", error);
      }
    }
    
    // Sync TO Google - push local events that don't have externalId
    const events = await ctx.runQuery(api.events.listEvents);
    const localEvents = events.filter((e: any) => 
      e.source === "local" && !e.externalId && !e.isDraft
    );
    
    
    for (const event of localEvents) {
      try {
        const pushResult = await ctx.runAction(api.googleCalendar.pushEventToGoogle, {
          eventId: event._id,
        });
        if (pushResult.action === "created") {
          results.toGoogle.created++;
        } else if (pushResult.action === "updated") {
          results.toGoogle.updated++;
        }
      } catch (error) {
        console.error("[fullSync] Error pushing event to Google:", error);
        results.toGoogle.failed++;
      }
    }
    
    return { success: true, results };
  },
});

