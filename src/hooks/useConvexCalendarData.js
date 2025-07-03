"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { generateRecurringEvents } from '../utils/recurrenceUtils';

// Helper to generate unique IDs
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useConvexCalendarData = ({ userId = undefined } = {}) => {
  const [activeViewIds, setActiveViewIds] = useState([]);
  
  // Convex queries
  const viewsResult = useQuery(api.views.getViews, { userId });
  const userSettings = useQuery(api.userSettings.getUserSettings, { userId });
  
  const views = viewsResult || [];
  
  const isLoading = viewsResult === undefined || userSettings === undefined;

  const rawEvents = useQuery(
    api.events.getEvents, 
    activeViewIds.length > 0 && !isLoading ? { viewIds: activeViewIds, userId } : "skip"
  ) || [];

  // Convert ISO string dates to Date objects and expand recurring events
  const events = useMemo(() => {
    const processedEvents = rawEvents.map(event => {
      const processedEvent = {
        ...event,
        start: new Date(event.start),
        end: event.end ? new Date(event.end) : null,
      };

      // ✅ Fix: Parse rruleOptions dates for custom recurrence patterns
      if (event.rruleOptions) {
        processedEvent.rruleOptions = { ...event.rruleOptions };
        
        // Convert dtstart and until from strings to Date objects
        if (event.rruleOptions.dtstart) {
          processedEvent.rruleOptions.dtstart = new Date(event.rruleOptions.dtstart);
        }
        if (event.rruleOptions.until) {
          processedEvent.rruleOptions.until = new Date(event.rruleOptions.until);
        }
      }

      return processedEvent;
    });

    // ✅ Fix: Expand recurring events into multiple instances for display
    const expandedEvents = [];
    
    processedEvents.forEach(event => {
      if ((event.repeat && event.repeat !== 'none') || event.rruleOptions) {
        // This is a recurring event - generate instances
        const recurringInstances = generateRecurringEvents(event);
        expandedEvents.push(...recurringInstances);
      } else {
        // Regular non-recurring event
        expandedEvents.push(event);
      }
    });

    return expandedEvents;
  }, [rawEvents]);
  
  // Removed excessive debug query that was slowing down the app

  // Convex mutations
  const createView = useMutation(api.views.createView);
  const updateView = useMutation(api.views.updateView);
  const deleteView = useMutation(api.views.deleteView);
  const reassignEventsToView = useMutation(api.events.reassignEventsToView);
  
  const createEvent = useMutation(api.events.createEvent);
  const updateEvent = useMutation(api.events.updateEvent);
  const deleteEvent = useMutation(api.events.deleteEvent);
  const deleteEventSeries = useMutation(api.events.deleteEventSeries);
  
  const updateActiveViews = useMutation(api.userSettings.updateActiveViews);
  const ensureDefaultView = useMutation(api.migration.ensureDefaultView);

  // Initialize active view IDs from user settings
  useEffect(() => {
    // Wait for queries to settle before running logic
    if (isLoading) {
      return;
    }

    // For single calendar setup, use the default viewId
    const DEFAULT_VIEW_ID = "default-calendar-view";
    
    if (userSettings && userSettings.activeViewIds && userSettings.activeViewIds.length > 0) {
      if (JSON.stringify(activeViewIds) !== JSON.stringify(userSettings.activeViewIds)) {
        setActiveViewIds(userSettings.activeViewIds);
      }
    } else if (views.length > 0) {
      // If no user settings but we have views, activate the default view
      const defaultView = views.find(v => v.isDefault);
      const viewToActivate = defaultView || views[0];
      
      if (viewToActivate && activeViewIds[0] !== viewToActivate._id) {
        setActiveViewIds([viewToActivate._id]);
        if (userId) {
          updateActiveViews({ userId, activeViewIds: [viewToActivate._id] });
        }
      }
    } else {
      // For single calendar, just use the default viewId without waiting for views
      if (activeViewIds[0] !== DEFAULT_VIEW_ID) {
        setActiveViewIds([DEFAULT_VIEW_ID]);
      }
      
      // Optionally still try to create a proper view in the background
      if (userId) {
        ensureDefaultView({ userId }).catch((error) => {
          console.error('❌ [ERROR] Failed to create default view:', error);
        });
      }
    }
  }, [userSettings, views, userId, updateActiveViews, ensureDefaultView, isLoading, activeViewIds]);

  // Log events for debugging (only when needed)
  // useEffect(() => {
  //   if (events.length > 0) {
  //     console.log('✅ [SUCCESS] Events loaded from Convex:', events.length, 'events');
  //   }
  // }, [events]);

  // View Management Functions
  const addView = useCallback(async (name) => {
    if (!name.trim()) {
      alert("View name cannot be empty.");
      return;
    }
    
    try {
      await createView({ name: name.trim(), userId });
    } catch (error) {
      console.error("Failed to create view:", error);
      alert("Failed to create view. Please try again.");
    }
  }, [createView, userId]);

  const renameView = useCallback(async (id, newName) => {
    if (!newName.trim()) {
      alert("View name cannot be empty.");
      return;
    }
    
    try {
      await updateView({ id, name: newName.trim() });
    } catch (error) {
      console.error("Failed to rename view:", error);
      alert("Failed to rename view. Please try again.");
    }
  }, [updateView]);

  const deleteViewHandler = useCallback(async (idToDelete) => {
    const viewToDelete = views.find(v => v._id === idToDelete);
    if (viewToDelete?.isDefault) {
      alert("The default view cannot be deleted.");
      return;
    }

    try {
      // Find default view to reassign events
      const defaultView = views.find(v => v.isDefault);
      if (defaultView && defaultView._id !== idToDelete) {
        // Reassign events to default view
        await reassignEventsToView({
          fromViewId: idToDelete,
          toViewId: defaultView._id,
          userId
        });
      }

      // Delete the view
      await deleteView({ id: idToDelete });

      // Update active views if the deleted view was active
      if (activeViewIds.includes(idToDelete)) {
        const newActiveViewIds = activeViewIds.filter(id => id !== idToDelete);
        setActiveViewIds(newActiveViewIds);
        if (userId) {
          await updateActiveViews({ userId, activeViewIds: newActiveViewIds });
        }
      }
    } catch (error) {
      console.error("Failed to delete view:", error);
      alert("Failed to delete view. Please try again.");
    }
  }, [deleteView, reassignEventsToView, views, activeViewIds, updateActiveViews, userId]);

  const toggleView = useCallback(async (id) => {
    const newActiveViewIds = activeViewIds.includes(id)
      ? activeViewIds.filter(activeId => activeId !== id)
      : [...activeViewIds, id];
    
    setActiveViewIds(newActiveViewIds);
    
    if (userId) {
      try {
        await updateActiveViews({ userId, activeViewIds: newActiveViewIds });
      } catch (error) {
        console.error("Failed to update active views:", error);
        // Revert the local state change
        setActiveViewIds(activeViewIds);
      }
    }
  }, [activeViewIds, updateActiveViews, userId]);

  // Event Management Functions
  const addEvent = useCallback(async (newEventData) => {
    try {
      // Ensure we have a valid viewId
      let viewId = newEventData.viewId;
      
      if (!viewId && activeViewIds.length > 0) {
        viewId = activeViewIds[0];
      } else if (!viewId) {
        const defaultView = views.find(v => v.isDefault);
        viewId = defaultView?._id;
      }
      
      // If we still don't have a viewId, use the default fallback
      if (!viewId) {
        viewId = "default-calendar-view";
      }

      const eventWithViewId = {
        ...newEventData,
        viewId,
        userId
      };

      const eventId = await createEvent(eventWithViewId);
      return { ...eventWithViewId, _id: eventId };
    } catch (error) {
      console.error("❌ [ERROR] Failed to create event:", error);
      alert("Failed to create event. Please try again.");
      return null;
    }
  }, [createEvent, activeViewIds, views, userId]);

  const updateEventHandler = useCallback(async (eventId, updatedProperties) => {
    try {
      await updateEvent({ id: eventId, ...updatedProperties });
      return true;
    } catch (error) {
      console.error("Failed to update event:", error);
      alert("Failed to update event. Please try again.");
      return false;
    }
  }, [updateEvent]);

  const deleteEventHandler = useCallback(async (eventOrId) => {
    // Handle both event object and event ID as input
    const eventIdToDelete = typeof eventOrId === 'string' ? eventOrId : eventOrId?._id;

    if (!eventIdToDelete) {
      console.error("Failed to delete event: No ID found.", eventOrId);
      alert("Failed to delete event. No ID found.");
      return;
    }

    try {
      await deleteEvent({ id: eventIdToDelete });
    } catch (error) {
      console.error("Failed to delete event:", error);
      alert("Failed to delete event. Please try again.");
    }
  }, [deleteEvent]);
  
  const deleteEventSeriesHandler = useCallback(async (seriesId) => {
    if (!seriesId) {
      console.error("Failed to delete event series: No seriesId found.");
      alert("Failed to delete event series. No seriesId found.");
      return;
    }

    try {
      const result = await deleteEventSeries({ seriesId, userId });
      console.log(`✅ Successfully deleted ${result.deletedCount} events in series ${seriesId}`);
      return result;
    } catch (error) {
      console.error("Failed to delete event series:", error);
      alert("Failed to delete event series. Please try again.");
    }
  }, [deleteEventSeries, userId]);

  // Compatibility function for bulk updates (if needed during transition)
  const setCalendarEvents = useCallback((events) => {
    console.warn("setCalendarEvents is not supported with Convex backend. Use individual event operations instead.");
  }, []);

  // Filtered Events for Display
  const getFilteredEvents = useCallback(() => {
    if (isLoading || activeViewIds.length === 0) {
      return [];
    }
    return events;
  }, [events, activeViewIds, isLoading]);

  return {
    views,
    activeViewIds,
    allEvents: events,
    isLoading,
    
    addView,
    renameView,
    deleteView: deleteViewHandler,
    toggleView,
    
    addEvent,
    updateEvent: updateEventHandler,
    deleteEvent: deleteEventHandler,
    deleteEventSeries: deleteEventSeriesHandler,
    setCalendarEvents,

    getFilteredEvents,
  };
};