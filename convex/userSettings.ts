import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user settings
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings;
  },
});

// Upsert user settings
export const upsertUserSettings = mutation({
  args: {
    theme: v.optional(v.string()),
    language: v.optional(v.string()),
    timezone: v.optional(v.string()),
    defaultCalendarView: v.optional(v.string()),
    weekStartsOn: v.optional(v.number()),
    workingHours: v.optional(v.any()),
    defaultTaskView: v.optional(v.string()),
    taskSortBy: v.optional(v.string()),
    showCompletedTasks: v.optional(v.boolean()),
    notifications: v.optional(v.any()),
    autoSync: v.optional(v.boolean()),
    syncInterval: v.optional(v.number()),
    activeViewIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    } else {
      const settingsId = await ctx.db.insert("userSettings", {
        userId,
        ...args,
      });
      return settingsId;
    }
  },
});
