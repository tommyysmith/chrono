import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Views (your calendar views like "Personal", "Work", etc.)
  views: defineTable({
    name: v.string(),
    isDefault: v.optional(v.boolean()),
    userId: v.optional(v.string()), // For future multi-user support
  }),

  // Events (calendar events)
  events: defineTable({
    title: v.string(),
    start: v.string(), // ISO date string
    end: v.optional(v.string()),
    allDay: v.optional(v.boolean()),
    viewId: v.optional(v.string()), // Made optional for single calendar setup
    userId: v.optional(v.string()),
    
    // Recurrence fields
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    
    // Styling and metadata
    color: v.optional(v.string()),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
    
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  // Tasks (your task management system)
  tasks: defineTable({
    title: v.string(),
    completed: v.optional(v.boolean()),
    scheduledDate: v.optional(v.string()),
    priority: v.optional(v.string()), // "high", "medium", "low", "none"
    tag: v.optional(v.any()), // Your tag object structure
    userId: v.optional(v.string()),
    
    // Recurrence fields
    repeat: v.optional(v.string()),
    rruleOptions: v.optional(v.any()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    originalBaseId: v.optional(v.string()),
    startDateOfSeries: v.optional(v.string()),
    
    // Metadata
    description: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),

  // User settings and preferences
  userSettings: defineTable({
    userId: v.string(),
    activeViewIds: v.array(v.string()),
    preferences: v.optional(v.any()), // For future settings
  }),
}); 