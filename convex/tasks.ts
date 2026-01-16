import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List tasks for the current user
export const listTasks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return tasks.map((task) => ({
      ...task,
      scheduledDate: task.scheduledDate ? new Date(task.scheduledDate) : undefined,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
      startDateOfSeries: task.startDateOfSeries
        ? new Date(task.startDateOfSeries)
        : undefined,
    }));
  },
});

// Create a new task
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    priority: v.string(),
    scheduledDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    startDateOfSeries: v.optional(v.number()),
    repeat: v.string(),
    seriesId: v.optional(v.string()),
    isRepeat: v.boolean(),
    rruleOptions: v.optional(v.any()),
    originalBaseId: v.optional(v.string()),
    tag: v.optional(v.any()),
    tags: v.optional(v.array(v.any())),
    viewId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const taskId = await ctx.db.insert("tasks", {
      userId,
      title: args.title,
      description: args.description,
      completed: args.completed || false,
      priority: args.priority,
      scheduledDate: args.scheduledDate,
      dueDate: args.dueDate,
      completedAt: args.completedAt,
      startDateOfSeries: args.startDateOfSeries,
      repeat: args.repeat,
      seriesId: args.seriesId,
      isRepeat: args.isRepeat,
      rruleOptions: args.rruleOptions,
      originalBaseId: args.originalBaseId,
      tag: args.tag,
      tags: args.tags || [],
      viewId: args.viewId,
    });

    return taskId;
  },
});

// Update a task
export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    completed: v.optional(v.boolean()),
    priority: v.optional(v.string()),
    scheduledDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    startDateOfSeries: v.optional(v.number()),
    repeat: v.optional(v.string()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    rruleOptions: v.optional(v.any()),
    originalBaseId: v.optional(v.string()),
    tag: v.optional(v.any()),
    tags: v.optional(v.array(v.any())),
    viewId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { id, ...updates } = args;
    const task = await ctx.db.get(id);

    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a task
export const deleteTask = mutation({
  args: {
    id: v.id("tasks"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const task = await ctx.db.get(args.id);
    if (!task || task.userId !== userId) {
      throw new Error("Task not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
