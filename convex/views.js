import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all views for a user
export const getViews = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("views")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();
  },
});

// Create a new view
export const createView = mutation({
  args: { 
    name: v.string(),
    userId: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.name.trim()) {
      throw new Error("View name cannot be empty");
    }

    return await ctx.db.insert("views", {
      name: args.name.trim(),
      userId: args.userId,
      isDefault: args.isDefault || false,
    });
  },
});

// Update a view
export const updateView = mutation({
  args: { 
    id: v.id("views"),
    name: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const updates = {};
    
    if (args.name !== undefined) {
      if (!args.name.trim()) {
        throw new Error("View name cannot be empty");
      }
      updates.name = args.name.trim();
    }
    
    if (args.isDefault !== undefined) {
      updates.isDefault = args.isDefault;
    }

    return await ctx.db.patch(args.id, updates);
  },
});

// Delete a view
export const deleteView = mutation({
  args: { id: v.id("views") },
  handler: async (ctx, args) => {
    // Check if it's the default view
    const view = await ctx.db.get(args.id);
    if (!view) {
      throw new Error("View not found");
    }
    
    if (view.isDefault) {
      throw new Error("The default view cannot be deleted");
    }

    // Delete the view
    await ctx.db.delete(args.id);
    
    // TODO: Reassign events from this view to the default view
    // This will be handled in the events.js file
    
    return { success: true };
  },
}); 