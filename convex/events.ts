import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// List events for the current user
export const listEvents = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();

    // Return raw data - timestamps stay as numbers (Convex can't serialize Date objects)
    // The frontend will convert them to Date objects
    return events;
  },
});

// Create a new event
export const createEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    color: v.string(),
    location: v.optional(v.string()),
    start: v.number(),
    end: v.number(),
    isAllDay: v.boolean(),
    repeat: v.string(),
    seriesId: v.optional(v.string()),
    isRepeat: v.boolean(),
    rruleOptions: v.optional(v.any()),
    viewId: v.string(),
    source: v.optional(v.string()),
    externalId: v.optional(v.string()),
    externalCalendarId: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
    lastSyncedAt: v.optional(v.number()),
    syncStatus: v.optional(v.string()),
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
    // Current user's RSVP response status
    myResponseStatus: v.optional(v.string()),
    // Attachments (Notion docs, Google Docs, etc.)
    attachments: v.optional(v.array(v.object({
      fileUrl: v.string(),
      title: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      iconLink: v.optional(v.string()),
      fileId: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const eventId = await ctx.db.insert("events", {
      userId,
      title: args.title,
      description: args.description,
      color: args.color,
      location: args.location,
      start: args.start,
      end: args.end,
      isAllDay: args.isAllDay,
      repeat: args.repeat,
      seriesId: args.seriesId,
      isRepeat: args.isRepeat,
      rruleOptions: args.rruleOptions,
      viewId: args.viewId,
      source: args.source || "local",
      externalId: args.externalId,
      externalCalendarId: args.externalCalendarId,
      isDraft: args.isDraft || false,
      lastSyncedAt: args.lastSyncedAt,
      syncStatus: args.syncStatus,
      hangoutLink: args.hangoutLink,
      conferenceData: args.conferenceData,
      addGoogleMeet: args.addGoogleMeet,
      attendees: args.attendees,
      organizer: args.organizer,
      myResponseStatus: args.myResponseStatus,
      attachments: args.attachments,
    });

    return eventId;
  },
});

// Update an event
export const updateEvent = mutation({
  args: {
    id: v.id("events"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    location: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
    isAllDay: v.optional(v.boolean()),
    repeat: v.optional(v.string()),
    seriesId: v.optional(v.string()),
    isRepeat: v.optional(v.boolean()),
    rruleOptions: v.optional(v.any()),
    // Instance overrides for Notion Calendar-style editing
    instanceOverrides: v.optional(v.any()),
    viewId: v.optional(v.string()),
    source: v.optional(v.string()),
    externalId: v.optional(v.string()),
    externalCalendarId: v.optional(v.string()),
    isDraft: v.optional(v.boolean()),
    lastSyncedAt: v.optional(v.number()),
    syncStatus: v.optional(v.string()),
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
    // Current user's RSVP response status
    myResponseStatus: v.optional(v.string()),
    // Attachments (Notion docs, Google Docs, etc.)
    attachments: v.optional(v.array(v.object({
      fileUrl: v.string(),
      title: v.optional(v.string()),
      mimeType: v.optional(v.string()),
      iconLink: v.optional(v.string()),
      fileId: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const { id, ...updates } = args;
    const event = await ctx.db.get(id);

    if (!event || event.userId !== userId) {
      throw new Error("Event not found or unauthorized");
    }

    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete an event
export const deleteEvent = mutation({
  args: {
    id: v.id("events"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const event = await ctx.db.get(args.id);
    if (!event || event.userId !== userId) {
      throw new Error("Event not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Clear all events for the current user (does NOT delete from Google Calendar)
export const clearAllEvents = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const events = await ctx.db
      .query("events")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let deleted = 0;
    for (const event of events) {
      await ctx.db.delete(event._id);
      deleted++;
    }

    return { success: true, deleted };
  },
});
