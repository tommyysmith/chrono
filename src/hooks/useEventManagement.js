import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { generateEventId } from "../utils/eventUtils";
import { generateRecurringEvents, updateSeriesEvents, getEventsInSeries } from "../utils/recurrenceUtils";

export function useEventManagement(commandBarRef) {
  const [events, setEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);
  
  // Convex queries and mutations
  const { isAuthenticated } = useConvexAuth();
  const convexEvents = useQuery(api.events.listEvents);
  const createEventMutation = useMutation(api.events.createEvent);
  const updateEventMutation = useMutation(api.events.updateEvent);
  const deleteEventMutation = useMutation(api.events.deleteEvent);
  const pushEventToGoogle = useAction(api.googleCalendar.pushEventToGoogle);
  const deleteGoogleEventAction = useAction(api.googleCalendar.deleteGoogleEvent);
  
  // Load events from Convex
  useEffect(() => {
    if (convexEvents) {
      console.log('[useEventManagement] Loading events from Convex:', convexEvents.length);
      
      const processedEvents = convexEvents
        .filter(event => !event.isDraft)
        .map((event) => {
          // Parse regular date fields
          const processedEvent = {
            ...event,
            id: event._id, // Map _id to id for frontend compatibility
            start: new Date(event.start),
            end: new Date(event.end),
          };

          // Parse rruleOptions dates for custom recurrence patterns
          if (event.rruleOptions && typeof event.rruleOptions === 'object') {
            processedEvent.rruleOptions = { ...event.rruleOptions };
            
            // Convert dtstart and until from strings/numbers to Date objects
            if (event.rruleOptions.dtstart) {
              processedEvent.rruleOptions.dtstart = new Date(event.rruleOptions.dtstart);
            }
            if (event.rruleOptions.until && event.rruleOptions.until !== 'undefined') {
              processedEvent.rruleOptions.until = new Date(event.rruleOptions.until);
            }
          }

          return processedEvent;
        });
      
      setEvents(processedEvents);
    }
  }, [convexEvents]);

  const handleCreateEvent = useCallback(
    (eventData) => {
      console.log('[useEventManagement] handleCreateEvent called with attendees:', eventData.attendees);
      
      // Ensure we have valid start/end times
      const start = eventData.start instanceof Date ? eventData.start : new Date(eventData.start);
      const end = eventData.end instanceof Date ? eventData.end : new Date(eventData.end);
      
      // Generate a new series ID if this is a repeat event
      const seriesId = eventData.repeat && eventData.repeat !== 'none' ? generateEventId() : null;
      
      const newEvent = {
        ...eventData,
        id: generateEventId(),
        start,
        end,
        seriesId,
        isRepeat: Boolean(seriesId),
        // Ensure both allDay and isAllDay are set consistently
        allDay: eventData.allDay || false,
        isAllDay: eventData.allDay || false
      };

      setEvents((prev) => {
        let newEvents = [...prev];
        
        // For recurring events, generate all instances
        if (seriesId) {
          // Generate recurring event instances
          const recurringEvents = generateRecurringEvents(newEvent);
          newEvents = [...prev, ...recurringEvents];
        } else {
          // Non-recurring event
          newEvents = [...prev, newEvent];
        }
        
        return newEvents;
      });

      // Persist to Convex database and sync to Google Calendar
      const persistEvent = async () => {
        try {
          // Prepare rruleOptions for Convex (convert Date objects to timestamps)
          let rruleOptionsForConvex = null;
          if (newEvent.rruleOptions) {
            rruleOptionsForConvex = { ...newEvent.rruleOptions };
            if (rruleOptionsForConvex.dtstart instanceof Date) {
              rruleOptionsForConvex.dtstart = rruleOptionsForConvex.dtstart.getTime();
            }
            if (rruleOptionsForConvex.until instanceof Date) {
              rruleOptionsForConvex.until = rruleOptionsForConvex.until.getTime();
            }
          }

          console.log('[useEventManagement] Persisting event with attendees:', newEvent.attendees);
          
          const convexEventId = await createEventMutation({
            title: newEvent.title || 'New Event',
            description: newEvent.description || '',
            color: newEvent.color || '#F59E0B',
            location: newEvent.location || '',
            start: start.getTime(),
            end: end.getTime(),
            isAllDay: newEvent.isAllDay || false,
            repeat: newEvent.repeat || 'none',
            seriesId: newEvent.seriesId || undefined,
            isRepeat: newEvent.isRepeat || false,
            rruleOptions: rruleOptionsForConvex,
            viewId: newEvent.viewId || 'default',
            source: 'local',
            isDraft: false,
            attendees: newEvent.attendees || undefined,
          });

          console.log('[useEventManagement] Event persisted to Convex:', convexEventId);

          // Sync to Google Calendar if authenticated
          if (isAuthenticated && convexEventId) {
            try {
              const syncResult = await pushEventToGoogle({ eventId: convexEventId });
              console.log('[useEventManagement] Event synced to Google Calendar:', syncResult);
            } catch (syncError) {
              console.error('[useEventManagement] Failed to sync to Google Calendar:', syncError);
            }
          }
        } catch (error) {
          console.error('[useEventManagement] Failed to persist event to Convex:', error);
        }
      };

      persistEvent();

      // Immediately open CommandBar for editing
      if (commandBarRef.current) {
        commandBarRef.current.openForEdit(newEvent);
      }

      return newEvent;
    },
    [commandBarRef, createEventMutation, isAuthenticated, pushEventToGoogle]
  );

  const handleUpdateEvent = useCallback((updatedEvent) => {
    setEvents(prevEvents => {
      // Create a copy of the event without the internal properties
      const cleanEvent = { ...updatedEvent };
      
      // Extract and remove internal properties used for tracking
      const editScope = cleanEvent._editScope || 'single';
      delete cleanEvent._editScope;
      
      const timeChange = cleanEvent._timeChange || null;
      delete cleanEvent._timeChange;
      
      const isDragging = !!cleanEvent._isDragging;
      delete cleanEvent._isDragging;
      
      const isResizing = !!cleanEvent._isResizing;
      delete cleanEvent._isResizing;
      
      const shouldDelete = !!cleanEvent._shouldDelete;
      delete cleanEvent._shouldDelete;
      
      // Handle event deletion
      if (shouldDelete) {
        return prevEvents.filter(e => e.id !== cleanEvent.id);
      }
      
      // Extract rruleOptions if present, but DON'T delete it
      const rruleOptions = cleanEvent.rruleOptions || null;

      // For recurring events
      if (cleanEvent.seriesId) {
        // Find the existing event and the base event
        const existingEvent = prevEvents.find(e => e.id === cleanEvent.id);
        const seriesEvents = prevEvents.filter(e => e.seriesId === cleanEvent.seriesId);
        const baseEvent = seriesEvents.sort((a, b) => new Date(a.start) - new Date(b.start))[0]; // Find earliest
        
        // Check if the repeat pattern (preset OR custom rrule) has changed
        const presetRepeatChanged = existingEvent && existingEvent.repeat !== cleanEvent.repeat && cleanEvent.repeat && cleanEvent.repeat !== 'none';
        const customRuleChanged = existingEvent && 
                                  cleanEvent.repeat === 'custom' && 
                                  JSON.stringify(existingEvent.rruleOptions) !== JSON.stringify(cleanEvent.rruleOptions);

        if (presetRepeatChanged || customRuleChanged) {          
          // Keep the same series ID for consistency
          const seriesId = cleanEvent.seriesId;
          
          // Update the event with the new recurring properties
          const updatedEventWithSeries = {
            ...cleanEvent,
            seriesId,
            isRepeat: true
          };
          
          // Generate the new recurring series with the updated pattern
          const recurringEvents = generateRecurringEvents(updatedEventWithSeries);
          
          // Replace the original series with the new recurring series
          return prevEvents
            .filter(e => e.seriesId !== cleanEvent.seriesId) // Remove the original series
            .concat(recurringEvents);                        // Add the new recurring series
        }
        
        // Use recurrence utils to update series events
        return updateSeriesEvents(prevEvents, cleanEvent, {
          editScope,
          timeChange,
          rruleOptions,
          baseEvent,
          isDragging,
          isResizing
        });
      }
      
      // For non-recurring events that are being updated
      const existingEvent = prevEvents.find(e => e.id === cleanEvent.id);
      
      // Ensure both allDay and isAllDay properties are consistent
      if (cleanEvent.allDay !== undefined && cleanEvent.isAllDay !== cleanEvent.allDay) {
        cleanEvent.isAllDay = cleanEvent.allDay;
      } else if (cleanEvent.isAllDay !== undefined && cleanEvent.allDay !== cleanEvent.isAllDay) {
        cleanEvent.allDay = cleanEvent.isAllDay;
      }
      
      if (existingEvent && 
          (!existingEvent.repeat || existingEvent.repeat === 'none') && 
          cleanEvent.repeat && 
          cleanEvent.repeat !== 'none') {
        
        // Generate a series ID for the new recurring event
        const seriesId = generateEventId();
        
        // Update the event with recurring properties
        const updatedEventWithSeries = {
          ...cleanEvent,
          seriesId,
          isRepeat: true
        };
        
        // Generate the recurring series
        const recurringEvents = generateRecurringEvents(updatedEventWithSeries);
        
        // Replace the original event with the recurring series
        return prevEvents
          .filter(e => e.id !== cleanEvent.id) // Remove the original event
          .concat(recurringEvents);            // Add the recurring series
      }
      
      // Regular update for non-recurring events
      return prevEvents.map(event => 
        event.id === cleanEvent.id ? cleanEvent : event
      );
    });

    // Persist update to Convex and sync to Google Calendar
    const persistUpdate = async () => {
      try {
        // Check if this is a Convex ID (starts with specific format) or local ID
        const convexId = updatedEvent._id || updatedEvent.id;
        
        // Skip if no valid Convex ID or if it's a draft
        if (!convexId || updatedEvent.isDraft) {
          return;
        }

        // Prepare rruleOptions for Convex (convert Date objects to timestamps)
        let rruleOptionsForConvex = null;
        if (updatedEvent.rruleOptions) {
          rruleOptionsForConvex = { ...updatedEvent.rruleOptions };
          if (rruleOptionsForConvex.dtstart instanceof Date) {
            rruleOptionsForConvex.dtstart = rruleOptionsForConvex.dtstart.getTime();
          }
          if (rruleOptionsForConvex.until instanceof Date) {
            rruleOptionsForConvex.until = rruleOptionsForConvex.until.getTime();
          }
          if (Array.isArray(rruleOptionsForConvex.exdate)) {
            rruleOptionsForConvex.exdate = rruleOptionsForConvex.exdate.map(d => 
              d instanceof Date ? d.getTime() : d
            );
          }
        }

        const start = updatedEvent.start instanceof Date ? updatedEvent.start.getTime() : updatedEvent.start;
        const end = updatedEvent.end instanceof Date ? updatedEvent.end.getTime() : updatedEvent.end;

        console.log('[useEventManagement] Updating event with attendees:', updatedEvent.attendees);

        await updateEventMutation({
          id: convexId,
          title: updatedEvent.title,
          description: updatedEvent.description || '',
          color: updatedEvent.color,
          location: updatedEvent.location || '',
          start,
          end,
          isAllDay: updatedEvent.isAllDay || false,
          repeat: updatedEvent.repeat || 'none',
          seriesId: updatedEvent.seriesId || undefined,
          isRepeat: updatedEvent.isRepeat || false,
          rruleOptions: rruleOptionsForConvex,
          attendees: updatedEvent.attendees || undefined,
        });

        console.log('[useEventManagement] Event updated in Convex:', convexId);

        // Sync to Google Calendar if authenticated and event has externalId or is local
        if (isAuthenticated && convexId) {
          try {
            const syncResult = await pushEventToGoogle({ eventId: convexId });
            console.log('[useEventManagement] Event update synced to Google Calendar:', syncResult);
          } catch (syncError) {
            console.error('[useEventManagement] Failed to sync update to Google Calendar:', syncError);
          }
        }
      } catch (error) {
        console.error('[useEventManagement] Failed to update event in Convex:', error);
      }
    };

    persistUpdate();
  }, [setEvents, updateEventMutation, isAuthenticated, pushEventToGoogle]);

  const handleDeleteEvent = useCallback((event, setDeleteModalState) => {
    const isRepeatedEvent = event.repeat && event.repeat !== "none" && event.seriesId;

    if (isRepeatedEvent) {
      setDeleteModalState({
        isOpen: true,
        event,
      });
    } else {
      setEvents((prevEvents) => {
        // Filter out the event and any orphaned series events
        const updatedEvents = prevEvents.filter((e) => {
          if (e.id === event.id) return false;
          if (event.seriesId && e.seriesId === event.seriesId) return false;
          return true;
        });
        return updatedEvents;
      });

      // Persist deletion to Convex and sync to Google Calendar
      const persistDelete = async () => {
        try {
          const convexId = event._id || event.id;
          if (!convexId) return;

          // Delete from Convex
          await deleteEventMutation({ id: convexId });
          console.log('[useEventManagement] Event deleted from Convex:', convexId);

          // Delete from Google Calendar if it has an externalId
          if (isAuthenticated && event.externalId && event.externalCalendarId) {
            try {
              await deleteGoogleEventAction({
                calendarId: event.externalCalendarId,
                googleEventId: event.externalId,
              });
              console.log('[useEventManagement] Event deleted from Google Calendar:', event.externalId);
            } catch (syncError) {
              console.error('[useEventManagement] Failed to delete from Google Calendar:', syncError);
            }
          }
        } catch (error) {
          console.error('[useEventManagement] Failed to delete event from Convex:', error);
        }
      };

      persistDelete();
    }
  }, [deleteEventMutation, isAuthenticated, deleteGoogleEventAction]);

  const handleDeleteSeriesEvents = useCallback((event, scope) => {
    if (!event || !event.seriesId) {
      // If it's not a series event or event is missing, try deleting as single
      console.warn('handleDeleteSeriesEvents called on non-series event or missing event:', event);
      setEvents(prev => prev.filter(e => e.id !== event?.id));
      return;
    }

    setEvents((prevEvents) => {
      // Find the base event (assuming the one with rruleOptions is canonical, or earliest start)
      const seriesEvents = prevEvents.filter(e => e.seriesId === event.seriesId);
      const baseEvent = seriesEvents.sort((a, b) => new Date(a.start) - new Date(b.start))[0]; // Find earliest

      if (!baseEvent) {
        console.error('Could not find base event for seriesId:', event.seriesId);
        return prevEvents; // Return current state if base not found
      }

      let updatedEvents;

      if (scope === 'all') {
        // Delete all events in the series (Correct - Keep as is)
        updatedEvents = prevEvents.filter(e => e.seriesId !== event.seriesId);
      } else if (scope === 'single') {
        // Add exception date (exdate) to the base event's rruleOptions
        const dateToExclude = new Date(event.start);
        const currentRRuleOptions = baseEvent.rruleOptions || {}; // Handle missing options
        const existingExdates = (currentRRuleOptions.exdate || []).map(d => new Date(d)); // Ensure dates

        // Only add if not already excluded
        if (!existingExdates.some(d => d.getTime() === dateToExclude.getTime())) {
          const updatedRRuleOptions = {
            ...currentRRuleOptions,
            exdate: [...existingExdates, dateToExclude]
          };

          updatedEvents = prevEvents.map(e => 
            e.id === baseEvent.id 
              ? { ...e, rruleOptions: updatedRRuleOptions } 
              : e
          );
        } else {
          updatedEvents = prevEvents; // No change needed if already excluded
        }
      } else if (scope === 'future') {
        // Set the 'until' date on the base event's rruleOptions
        const untilDate = new Date(event.start); // Stop recurrence *before* this instance starts
        const currentRRuleOptions = baseEvent.rruleOptions || {}; // Handle missing options

        const updatedRRuleOptions = {
          ...currentRRuleOptions,
          until: untilDate,
          count: null // Remove count if setting until
        };
        // Remove count specifically if it exists
        delete updatedRRuleOptions.count; 

        updatedEvents = prevEvents.map(e => 
          e.id === baseEvent.id 
            ? { ...e, rruleOptions: updatedRRuleOptions } 
            : e
        );

      } else {
        // Unknown scope or issue, return current state
        console.warn('Unknown scope or issue in handleDeleteSeriesEvents:', scope);
        return prevEvents;
      }

      return updatedEvents;
    });

    // Persist series deletion to Convex and sync to Google Calendar
    const persistSeriesDelete = async () => {
      try {
        // Get the base event for the series
        const seriesEvents = events.filter(e => e.seriesId === event.seriesId);
        const baseEvent = seriesEvents.sort((a, b) => new Date(a.start) - new Date(b.start))[0];

        if (scope === 'all') {
          // Delete all events in the series from Convex
          for (const seriesEvent of seriesEvents) {
            const convexId = seriesEvent._id || seriesEvent.id;
            if (convexId) {
              try {
                await deleteEventMutation({ id: convexId });
              } catch (err) {
                console.error('[useEventManagement] Failed to delete series event:', err);
              }
            }
          }
          console.log('[useEventManagement] Series deleted from Convex:', event.seriesId);

          // Delete from Google Calendar if base event has externalId
          if (isAuthenticated && baseEvent?.externalId && baseEvent?.externalCalendarId) {
            try {
              await deleteGoogleEventAction({
                calendarId: baseEvent.externalCalendarId,
                googleEventId: baseEvent.externalId,
              });
              console.log('[useEventManagement] Series deleted from Google Calendar');
            } catch (syncError) {
              console.error('[useEventManagement] Failed to delete series from Google Calendar:', syncError);
            }
          }
        } else if (baseEvent) {
          // For 'single' or 'future' scope, update the base event with new rruleOptions
          const convexId = baseEvent._id || baseEvent.id;
          if (convexId) {
            // The rruleOptions were already updated in local state, sync to Convex
            const updatedBaseEvent = events.find(e => e.id === baseEvent.id);
            if (updatedBaseEvent) {
              try {
                await pushEventToGoogle({ eventId: convexId });
                console.log('[useEventManagement] Series update synced to Google Calendar');
              } catch (syncError) {
                console.error('[useEventManagement] Failed to sync series update to Google Calendar:', syncError);
              }
            }
          }
        }
      } catch (error) {
        console.error('[useEventManagement] Failed to persist series deletion:', error);
      }
    };

    persistSeriesDelete();
  }, [setEvents, events, deleteEventMutation, isAuthenticated, deleteGoogleEventAction, pushEventToGoogle]);

  return {
    events,
    setEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDeleteSeriesEvents,
    editingEventId,
    setEditingEventId
  };
}
