import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get events for specific views
export const getEvents = query({
  args: { 
    viewIds: v.array(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.viewIds.length === 0) {
      return [];
    }

    return await ctx.db
      .query("events")
      .filter((q) => {
        // Build OR conditions for each viewId, including handling undefined viewIds (default case)
        let viewIdFilter;
        if (args.viewIds.length === 1) {
          const viewId = args.viewIds[0];
          // If querying for the default viewId, also include events with undefined viewId
          if (viewId === "default-calendar-view") {
            viewIdFilter = q.or(
              q.eq(q.field("viewId"), viewId),
              q.eq(q.field("viewId"), undefined)
            );
          } else {
            viewIdFilter = q.eq(q.field("viewId"), viewId);
          }
        } else {
          viewIdFilter = q.or(
            ...args.viewIds.map(viewId => {
              // If one of the viewIds is the default, include undefined viewIds too
              if (viewId === "default-calendar-view") {
                return q.or(
                  q.eq(q.field("viewId"), viewId),
                  q.eq(q.field("viewId"), undefined)
                );
              } else {
                return q.eq(q.field("viewId"), viewId);
              }
            })
          );
        }
        
        let filter = viewIdFilter;
        if (args.userId) {
          filter = q.and(filter, q.eq(q.field("userId"), args.userId));
        } else {
          filter = q.and(filter, q.eq(q.field("userId"), undefined));
        }
        // Filter out draft events
        return q.and(filter, q.neq(q.field("isDraft"), true));
      })
      .collect();
  },
});

// Get all events (for migration and admin purposes)
export const getAllEvents = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("events")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();
  },
});

// Create a new event
export const createEvent = mutation({
  args: {
    title: v.string(),
    start: v.string(),
    end: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    viewId: v.optional(v.string()), // Made optional
    userId: v.optional(v.string()),
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Provide a default viewId if none is specified (for single calendar setup)
    const eventData = {
      ...args,
      viewId: args.viewId || "default-calendar-view",
      createdAt: now,
      updatedAt: now,
    };
    
    return await ctx.db.insert("events", eventData);
  },
});

// Update an event
export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    start: v.optional(v.string()),
    end: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    viewId: v.optional(v.string()),
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    const event = await ctx.db.get(id);
    if (!event) {
      throw new Error("Event not found");
    }

    // If viewId is being set to undefined/null, use the default
    if (updates.viewId === undefined || updates.viewId === null) {
      updates.viewId = "default-calendar-view";
    }

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Delete an event
export const deleteEvent = mutation({
  args: { id: v.id("events") },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.id);
    if (!event) {
      throw new Error("Event not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Bulk create events (useful for migration)
export const createEvents = mutation({
  args: { events: v.array(v.any()) },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const results = [];

    for (const eventData of args.events) {
      const result = await ctx.db.insert("events", {
        ...eventData,
        createdAt: eventData.createdAt || now,
        updatedAt: now,
      });
      results.push(result);
    }

    return results;
  },
});

// Delete all events in a recurring series by seriesId
export const deleteEventSeries = mutation({
  args: { 
    seriesId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => {
        let filter = q.eq(q.field("seriesId"), args.seriesId);
        if (args.userId) {
          filter = q.and(filter, q.eq(q.field("userId"), args.userId));
        } else {
          filter = q.and(filter, q.eq(q.field("userId"), undefined));
        }
        return filter;
      })
      .collect();

    const results = [];
    for (const event of events) {
      await ctx.db.delete(event._id);
      results.push(event._id);
    }

    return { success: true, deletedCount: results.length, deletedIds: results };
  },
});

// Reassign events from one view to another (used when deleting views)
export const reassignEventsToView = mutation({
  args: { 
    fromViewId: v.string(), 
    toViewId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .filter((q) => {
        let filter = q.eq(q.field("viewId"), args.fromViewId);
        if (args.userId) {
          filter = q.and(filter, q.eq(q.field("userId"), args.userId));
        } else {
          filter = q.and(filter, q.eq(q.field("userId"), undefined));
        }
        return filter;
      })
      .collect();

    const results = [];
    for (const event of events) {
      const result = await ctx.db.patch(event._id, {
        viewId: args.toViewId,
        updatedAt: new Date().toISOString(),
      });
      results.push(result);
    }

    return results;
  },
});