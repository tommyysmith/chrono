import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
      // Capture the OAuth tokens during profile creation and include them in the profile
      profile(googleProfile: any, tokens: any) {
        console.log("[Google OAuth] Profile callback - tokens received:", {
          hasAccessToken: !!tokens.access_token,
          hasRefreshToken: !!tokens.refresh_token,
          accessTokenLength: tokens.access_token?.length,
        });
        
        // Include tokens in the profile - they will be passed to createOrUpdateUser
        return {
          id: googleProfile.sub,
          name: googleProfile.name,
          email: googleProfile.email,
          image: googleProfile.picture,
          // Custom fields for tokens
          googleAccessToken: tokens.access_token,
          googleRefreshToken: tokens.refresh_token,
        };
      },
    }),
  ],
  callbacks: {
    // Use createOrUpdateUser to have full control over user creation and token storage
    async createOrUpdateUser(ctx, { existingUserId, type, provider, profile }) {
      // Profile contains the custom fields from the profile callback
      const accessToken = (profile as any)?.googleAccessToken;
      const refreshToken = (profile as any)?.googleRefreshToken;
      const email = (profile as any)?.email;
      const name = (profile as any)?.name || email?.split("@")[0] || "User";
      const image = (profile as any)?.image;
      
        console.log("[createOrUpdateUser] Called with:", {
        existingUserId,
        type,
        provider: provider.id,
        email,
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        accessTokenLength: accessToken?.length,
      });
      
      let userId = existingUserId;
      
      // Create or update user
      if (existingUserId) {
        // Update existing user
        await ctx.db.patch(existingUserId, {
          name,
          email,
          image,
        });
        userId = existingUserId;
      } else {
        // Create new user
        userId = await ctx.db.insert("users", {
          name,
          email,
          image,
        });
      }
      
      // Store calendar connection with OAuth tokens from profile
      if (accessToken && email) {
        
        // Check if calendar connection already exists
        const existingCalendar = await ctx.db
          .query("connectedCalendars")
          .filter((q: any) => q.eq(q.field("userId"), userId))
          .first();
        
        if (existingCalendar) {
          await ctx.db.patch(existingCalendar._id, {
            accessTokenEncrypted: accessToken,
            refreshTokenEncrypted: refreshToken,
            googleCalendarId: "primary", // Use "primary" for Google Calendar API
            lastSyncedAt: Date.now(),
          });
        } else {
          await ctx.db.insert("connectedCalendars", {
            userId,
            provider: "google",
            accountEmail: email,
            googleCalendarId: "primary", // Use "primary" for Google Calendar API
            googleCalendarName: "Primary Calendar",
            syncEnabled: true,
            accessTokenEncrypted: accessToken,
            refreshTokenEncrypted: refreshToken,
            lastSyncedAt: Date.now(),
          });
        }
      } else {
      }
      
      return userId;
    },
  },
});

// Get the currently authenticated user using identity from auth
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    // First, try to get the user ID from auth
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return null;
    }
    
    // Get user from the database
    const user = await ctx.db.get(userId);
    
    // Also get identity for additional info
    const identity = await ctx.auth.getUserIdentity();
    
    // Log for debugging
    console.log("[currentUser] Identity:", identity ? {
      email: identity.email, 
      name: identity.name,
      subject: identity.subject,
      allKeys: Object.keys(identity)
    } : null);
    
    // Combine data from both sources, preferring identity for profile info
    const email = identity?.email || (user as any)?.email || "";
    const name = identity?.name || (user as any)?.name || email?.split("@")[0] || "User";
    const image = identity?.pictureUrl || (identity as any)?.picture || (user as any)?.image || null;
    
    return {
      _id: userId,
      email,
      name,
      image,
    };
  },
});
