import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Migration function to import localStorage data to Convex
export const migrateLocalStorageData = mutation({
  args: {
    views: v.optional(v.array(v.any())),
    events: v.optional(v.array(v.any())),
    tasks: v.optional(v.array(v.any())),
    activeViewIds: v.optional(v.array(v.string())),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = {
      views: [],
      events: [],
      tasks: [],
      settings: null,
    };

    try {
      // 1. Create single default view for the unified calendar
      let defaultViewId;
      if (args.views && args.views.length > 0) {
        // Migrate existing views (but these are actually task tags, not calendar views)
        for (const view of args.views) {
          const viewId = await ctx.db.insert("views", {
            name: view.name,
            isDefault: view.isDefault || false,
            userId: args.userId,
          });
          results.views.push({ localId: view.id, convexId: viewId });
          if (view.isDefault) {
            defaultViewId = viewId;
          }
        }
        // Use first view as default if no explicit default
        if (!defaultViewId && results.views.length > 0) {
          defaultViewId = results.views[0].convexId;
        }
      }
      
      // Create a default view if none exists (for the unified calendar)
      if (!defaultViewId) {
        defaultViewId = await ctx.db.insert("views", {
          name: "Calendar",
          isDefault: true,
          userId: args.userId,
        });
        results.views.push({ localId: "default", convexId: defaultViewId });
      }

      // 2. Migrate Events (all go to the single calendar view)
      if (args.events && args.events.length > 0) {
        for (const event of args.events) {
          // Skip draft events
          if (event.isDraft) continue;

          const eventData = {
            title: event.title,
            start: event.start ? new Date(event.start).toISOString() : new Date().toISOString(),
            viewId: defaultViewId, // All events go to the unified calendar view
            userId: args.userId,
            createdAt: event.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Only include optional fields if they have valid values
            ...(event.end ? { end: new Date(event.end).toISOString() } : {}),
            ...(event.allDay !== null && event.allDay !== undefined ? { allDay: event.allDay } : {}),
            ...(event.repeat && typeof event.repeat === 'string' ? { repeat: event.repeat } : {}),
            ...(event.rruleOptions ? { rruleOptions: event.rruleOptions } : {}),
            ...(event.seriesId && typeof event.seriesId === 'string' ? { seriesId: event.seriesId } : {}),
            ...(event.isRepeat !== null && event.isRepeat !== undefined ? { isRepeat: event.isRepeat } : {}),
            ...(event.color && typeof event.color === 'string' ? { color: event.color } : {}),
            ...(event.description && typeof event.description === 'string' ? { description: event.description } : {}),
            ...(event.location && typeof event.location === 'string' ? { location: event.location } : {}),
            ...(event.isDraft !== null && event.isDraft !== undefined ? { isDraft: event.isDraft } : {}),
          };

          const eventId = await ctx.db.insert("events", eventData);
          results.events.push({ localId: event.id, convexId: eventId });
        }
      }

      // 3. Migrate Tasks
      if (args.tasks && args.tasks.length > 0) {
        for (const task of args.tasks) {
          const taskData = {
            title: task.title,
            userId: args.userId,
            createdAt: task.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Only include optional fields if they have valid values
            ...(task.completed !== null && task.completed !== undefined ? { completed: task.completed } : {}),
            ...(task.scheduledDate && typeof task.scheduledDate === 'string' ? { scheduledDate: task.scheduledDate } : {}),
            ...(task.priority && typeof task.priority === 'string' ? { priority: task.priority } : {}),
            ...(task.tag ? { tag: task.tag } : {}),
            ...(task.repeat && typeof task.repeat === 'string' ? { repeat: task.repeat } : {}),
            ...(task.rruleOptions ? { rruleOptions: task.rruleOptions } : {}),
            ...(task.seriesId && typeof task.seriesId === 'string' ? { seriesId: task.seriesId } : {}),
            ...(task.isRepeat !== null && task.isRepeat !== undefined ? { isRepeat: task.isRepeat } : {}),
            ...(task.originalBaseId && typeof task.originalBaseId === 'string' ? { originalBaseId: task.originalBaseId } : {}),
            ...(task.startDateOfSeries && typeof task.startDateOfSeries === 'string' ? { startDateOfSeries: task.startDateOfSeries } : {}),
            ...(task.description && typeof task.description === 'string' ? { description: task.description } : {}),
          };

          const taskId = await ctx.db.insert("tasks", taskData);
          results.tasks.push({ localId: task.id, convexId: taskId });
        }
      }

      // 4. Migrate User Settings
      if (args.userId) {
        // Map local view IDs to Convex view IDs
        const mappedActiveViewIds = (args.activeViewIds || []).map(localId => {
          const mapping = results.views.find(v => v.localId === localId);
          return mapping ? mapping.convexId : localId;
        }).filter(Boolean); // Remove any undefined values

        const settingsId = await ctx.db.insert("userSettings", {
          userId: args.userId,
          activeViewIds: mappedActiveViewIds,
          preferences: {},
        });
        results.settings = settingsId;
      }

      return {
        success: true,
        results,
        message: `Migration completed successfully. Migrated ${results.views.length} views, ${results.events.length} events, and ${results.tasks.length} tasks.`,
      };

    } catch (error) {
      console.error("Migration error:", error);
      return {
        success: false,
        error: error.message,
        results,
      };
    }
  },
});

// Check if user has existing data in Convex
export const checkExistingData = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const views = await ctx.db
      .query("views")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();

    const events = await ctx.db
      .query("events")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();

    return {
      hasData: views.length > 0 || events.length > 0 || tasks.length > 0,
      counts: {
        views: views.length,
        events: events.length,
        tasks: tasks.length,
      },
    };
  },
});

// Create default view if none exists
export const ensureDefaultView = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existingViews = await ctx.db
      .query("views")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();

    // Check if there's already a default view
    const hasDefault = existingViews.some(view => view.isDefault);

    if (!hasDefault) {
      const defaultViewId = await ctx.db.insert("views", {
        name: "Personal",
        isDefault: true,
        userId: args.userId,
      });

      // Update user settings to include the default view
      if (args.userId) {
        const existingSettings = await ctx.db
          .query("userSettings")
          .filter((q) => q.eq(q.field("userId"), args.userId))
          .first();

        if (existingSettings) {
          await ctx.db.patch(existingSettings._id, {
            activeViewIds: [...existingSettings.activeViewIds, defaultViewId],
          });
        } else {
          await ctx.db.insert("userSettings", {
            userId: args.userId,
            activeViewIds: [defaultViewId],
            preferences: {},
          });
        }
      }

      return { defaultViewId, created: true };
    }

    return { defaultViewId: existingViews.find(v => v.isDefault)?._id, created: false };
  },
}); 