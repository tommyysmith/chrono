import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get user settings
export const getUserSettings = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // If no userId provided, return default settings
    if (!args.userId) {
      return {
        userId: null,
        activeViewIds: [],
        preferences: {},
      };
    }

    const settings = await ctx.db
      .query("userSettings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();
    
    // Return default settings if none found
    if (!settings) {
      return {
        userId: args.userId,
        activeViewIds: [],
        preferences: {},
      };
    }
    
    return settings;
  },
});

// Create or update user settings
export const upsertUserSettings = mutation({
  args: {
    userId: v.string(),
    activeViewIds: v.optional(v.array(v.string())),
    preferences: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existingSettings = await ctx.db
      .query("userSettings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    if (existingSettings) {
      // Update existing settings
      const updates = {};
      if (args.activeViewIds !== undefined) {
        updates.activeViewIds = args.activeViewIds;
      }
      if (args.preferences !== undefined) {
        updates.preferences = args.preferences;
      }

      return await ctx.db.patch(existingSettings._id, updates);
    } else {
      // Create new settings
      return await ctx.db.insert("userSettings", {
        userId: args.userId,
        activeViewIds: args.activeViewIds || [],
        preferences: args.preferences || {},
      });
    }
  },
});

// Update active view IDs
export const updateActiveViews = mutation({
  args: {
    userId: v.string(),
    activeViewIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.run(async (ctx) => {
      return await ctx.mutation.upsertUserSettings({
        userId: args.userId,
        activeViewIds: args.activeViewIds,
      });
    });
  },
});

// Add a view to active views
export const addActiveView = mutation({
  args: {
    userId: v.string(),
    viewId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    let currentActiveViews = [];
    if (settings) {
      currentActiveViews = settings.activeViewIds || [];
    }

    // Add view if not already active
    if (!currentActiveViews.includes(args.viewId)) {
      currentActiveViews.push(args.viewId);
    }

    return await ctx.run(async (ctx) => {
      return await ctx.mutation.upsertUserSettings({
        userId: args.userId,
        activeViewIds: currentActiveViews,
      });
    });
  },
});

// Remove a view from active views
export const removeActiveView = mutation({
  args: {
    userId: v.string(),
    viewId: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSettings")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .first();

    let currentActiveViews = [];
    if (settings) {
      currentActiveViews = settings.activeViewIds || [];
    }

    // Remove view from active views
    currentActiveViews = currentActiveViews.filter(id => id !== args.viewId);

    return await ctx.run(async (ctx) => {
      return await ctx.mutation.upsertUserSettings({
        userId: args.userId,
        activeViewIds: currentActiveViews,
      });
    });
  },
}); 