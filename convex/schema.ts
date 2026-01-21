import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Auth tables (required by @convex-dev/auth)
  ...authTables,

  events: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    location: v.optional(v.string()),
    start: v.number(), // Unix timestamp
    end: v.number(),
    isAllDay: v.boolean(),
    // Recurrence
    repeat: v.string(), // "none", "daily", "weekly", etc.
    seriesId: v.optional(v.string()),
    isRepeat: v.boolean(),
    rruleOptions: v.optional(v.any()),
    // Instance overrides for Notion Calendar-style editing (event stays in series, only specific instance gets override)
    instanceOverrides: v.optional(v.any()), // Map of dateKey (YYYY-MM-DD) -> override object
    viewId: v.string(),
    // Google Calendar sync
    source: v.string(), // "local" or "google"
    externalId: v.optional(v.string()),
    externalCalendarId: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    syncStatus: v.optional(v.string()),
    // Draft state
    isDraft: v.optional(v.boolean()),
    // Google Meet / Conference data
    hangoutLink: v.optional(v.string()),
    conferenceData: v.optional(v.any()),
    addGoogleMeet: v.optional(v.boolean()),
    // Attendees
    attendees: v.optional(v.array(v.object({
      email: v.string(),
      displayName: v.optional(v.string()),
      responseStatus: v.optional(v.string()),
      organizer: v.optional(v.boolean()),
      self: v.optional(v.boolean()),
    }))),
    // Organizer info
    organizer: v.optional(v.object({
      email: v.string(),
      displayName: v.optional(v.string()),
      self: v.optional(v.boolean()),
    })),
    // Current user's RSVP response status for invited events
    myResponseStatus: v.optional(v.string()),
    // Attachments (Notion docs, Google Docs, etc.)
    attachments: v.optional(v.array(v.object({
      fileUrl: v.string(),
      title: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      iconLink: v.optional(v.string()),
      fileId: v.optional(v.string()),
    }))),
  })
    .index("by_user", ["userId"])
    .index("by_user_start", ["userId", "start"])
    .index("by_series", ["seriesId"])
    .index("by_external", ["externalId"]),

  tasks: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.optional(v.string()),
    completed: v.boolean(),
    priority: v.string(),
    scheduledDate: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    startDateOfSeries: v.optional(v.number()),
    // Recurrence
    repeat: v.string(),
    seriesId: v.optional(v.string()),
    isRepeat: v.boolean(),
    rruleOptions: v.optional(v.any()),
    originalBaseId: v.optional(v.string()),
    // Tags
    tag: v.optional(v.any()),
    tags: v.optional(v.array(v.any())),
    // View association
    viewId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_completed", ["userId", "completed"])
    .index("by_series", ["seriesId"])
    .index("by_scheduled", ["scheduledDate"]),

  views: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.string(),
    color: v.optional(v.string()),
    isDefault: v.boolean(),
    isVisible: v.boolean(),
    settings: v.optional(v.any()),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  userSettings: defineTable({
    userId: v.id("users"),
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
  })
    .index("by_user", ["userId"]),

  connectedCalendars: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    accountEmail: v.string(),
    googleCalendarId: v.string(),
    googleCalendarName: v.string(),
    googleCalendarDescription: v.optional(v.string()),
    googleCalendarTimezone: v.optional(v.string()),
    syncEnabled: v.boolean(),
    syncToken: v.optional(v.string()),
    channelId: v.optional(v.string()),
    resourceId: v.optional(v.string()),
    channelExpiration: v.optional(v.number()),
    accessTokenEncrypted: v.string(),
    refreshTokenEncrypted: v.optional(v.string()),
    tokenExpiry: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_google_calendar", ["userId", "googleCalendarId"]),
});
