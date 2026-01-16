import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List views for the current user
export const listViews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const views = await ctx.db
      .query("views")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    return views;
  },
});

// Get or create a default view for the user
export const getOrCreateDefaultView = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check for existing default view
    const existingDefault = await ctx.db
      .query("views")
      .withIndex("by_user_default", (q) => q.eq("userId", userId).eq("isDefault", true))
      .first();

    if (existingDefault) {
      return existingDefault._id;
    }

    // Check for any existing view
    const anyView = await ctx.db
      .query("views")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (anyView) {
      // Make the first view the default
      await ctx.db.patch(anyView._id, { isDefault: true });
      return anyView._id;
    }

    // Create a new default view
    const viewId = await ctx.db.insert("views", {
      userId,
      name: "Personal",
      type: "calendar",
      color: "#3b82f6",
      isDefault: true,
      isVisible: true,
      settings: {},
    });

    return viewId;
  },
});

// Create a new view
export const createView = mutation({
  args: {
    name: v.string(),
    type: v.optional(v.string()),
    color: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isVisible: v.optional(v.boolean()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const viewId = await ctx.db.insert("views", {
      userId,
      name: args.name,
      type: args.type || "calendar",
      color: args.color,
      isDefault: args.isDefault || false,
      isVisible: args.isVisible !== undefined ? args.isVisible : true,
      settings: args.settings || {},
    });

    return viewId;
  },
});

// Update a view
export const updateView = mutation({
  args: {
    id: v.id("views"),
    name: v.optional(v.string()),
    type: v.optional(v.string()),
    color: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
    isVisible: v.optional(v.boolean()),
    settings: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { id, ...updates } = args;
    const view = await ctx.db.get(id);

    if (!view || view.userId !== userId) {
      throw new Error("View not found or unauthorized");
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a view
export const deleteView = mutation({
  args: {
    id: v.id("views"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const view = await ctx.db.get(args.id);
    if (!view || view.userId !== userId) {
      throw new Error("View not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
