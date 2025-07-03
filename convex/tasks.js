import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all tasks for a user
export const getTasks = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => 
        args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined)
      )
      .collect();
  },
});

// Get tasks by tag
export const getTasksByTag = query({
  args: { 
    tagId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => {
        let filter = args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined);
        // Filter by tag - handle both null/undefined tags and specific tags
        if (args.tagId === "all") {
          return filter; // Return all tasks regardless of tag
        } else {
          return q.and(filter, q.eq(q.field("tag.id"), args.tagId));
        }
      })
      .collect();
  },
});

// Get today's tasks
export const getTodaysTasks = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    return await ctx.db
      .query("tasks")
      .filter((q) => {
        let filter = args.userId ? q.eq(q.field("userId"), args.userId) : q.eq(q.field("userId"), undefined);
        return q.and(filter, q.gte(q.field("scheduledDate"), today));
      })
      .collect();
  },
});

// Get tasks in a series (for recurring tasks)
export const getTasksInSeries = query({
  args: { 
    seriesId: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
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
  },
});

// Create a new task
export const createTask = mutation({
  args: {
    title: v.string(),
    completed: v.optional(v.boolean()),
    scheduledDate: v.optional(v.string()),
    priority: v.optional(v.string()),
    tag: v.optional(v.any()),
    userId: v.optional(v.string()),
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    originalBaseId: v.optional(v.string()),
    startDateOfSeries: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    
    // Generate seriesId for new recurring tasks
    let taskData = { ...args };
    if (args.repeat && args.repeat !== 'none' && !args.isRepeat && !args.seriesId) {
      taskData.seriesId = `series_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Set startDateOfSeries if not provided
      if (!taskData.startDateOfSeries) {
        if (taskData.scheduledDate) {
          taskData.startDateOfSeries = taskData.scheduledDate;
        } else {
          taskData.startDateOfSeries = now;
        }
      }
    }
    
    return await ctx.db.insert("tasks", {
      ...taskData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a task
export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    scheduledDate: v.optional(v.string()),
    priority: v.optional(v.string()),
    tag: v.optional(v.any()),
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    originalBaseId: v.optional(v.string()),
    startDateOfSeries: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    
    const task = await ctx.db.get(id);
    if (!task) {
      throw new Error("Task not found");
    }

    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },
});

// Delete a task (with scope handling for recurring tasks)
export const deleteTask = mutation({
  args: { 
    id: v.id("tasks"),
    scope: v.optional(v.string()), // 'single' or 'all'
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    if (task.seriesId && args.scope === 'all') {
      // Delete all tasks in the series
      const seriesTasks = await ctx.db
        .query("tasks")
        .filter((q) => {
          let filter = q.eq(q.field("seriesId"), task.seriesId);
          if (args.userId) {
            filter = q.and(filter, q.eq(q.field("userId"), args.userId));
          } else {
            filter = q.and(filter, q.eq(q.field("userId"), undefined));
          }
          return filter;
        })
        .collect();

      for (const seriesTask of seriesTasks) {
        await ctx.db.delete(seriesTask._id);
      }
    } else {
      // Delete single task
      await ctx.db.delete(args.id);
    }

    return { success: true };
  },
});

// Bulk create tasks (useful for migration)
export const createTasks = mutation({
  args: { tasks: v.array(v.any()) },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const results = [];

    for (const taskData of args.tasks) {
      const result = await ctx.db.insert("tasks", {
        ...taskData,
        createdAt: taskData.createdAt || now,
        updatedAt: now,
      });
      results.push(result);
    }

    return results;
  },
});

// Complete a task
export const completeTask = mutation({
  args: { 
    id: v.id("tasks"),
    completed: v.boolean(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) {
      throw new Error("Task not found");
    }

    return await ctx.db.patch(args.id, {
      completed: args.completed,
      updatedAt: new Date().toISOString(),
    });
  },
}); 