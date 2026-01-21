import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";
import { generateEventId } from "../utils/eventUtils";
import { generateRecurringEvents, updateSeriesEvents, getEventsInSeries } from "../utils/recurrenceUtils";

export function useEventManagement(commandBarRef, selectedEventId, setSelectedEventId) {
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
  const updateRecurringEventInstance = useAction(api.googleCalendar.updateRecurringEventInstance);
  
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
      
      // Preserve ALL local UUID events - they will be managed separately
      // This prevents the Convex sync from overwriting local edits
      setEvents(prev => {
        // Get all local UUID events from current state
        const localEvents = prev.filter(e => e.id?.includes('-'));
        
        // Filter out Convex events that match local events by start time
        const filteredConvex = processedEvents.filter(ce => {
          const hasLocalMatch = localEvents.some(le => 
            Math.abs(ce.start.getTime() - le.start.getTime()) < 60000
          );
          return !hasLocalMatch;
        });
        
        return [...filteredConvex, ...localEvents];
      });
    }
  }, [convexEvents]);

  const handleCreateEvent = useCallback(
    (eventData) => {
      console.log('[useEventManagement] handleCreateEvent called with:', eventData.title, 'id:', eventData.id);
      console.log('[useEventManagement] handleCreateEvent attendees:', eventData.attendees);
      
      // Ensure we have valid start/end times
      const start = eventData.start instanceof Date ? eventData.start : new Date(eventData.start);
      const end = eventData.end instanceof Date ? eventData.end : new Date(eventData.end);
      
      // Check if this event already exists in state (e.g., from drag-to-create)
      // If so, we'll update it instead of creating a duplicate
      const existingEventId = eventData.id;
      const isExistingDragEvent = existingEventId && existingEventId.includes('-');
      
      // Don't generate seriesId or recurring instances here
      // Recurrence will be handled when CommandBar closes via finalizeNewEvent
      const newEvent = {
        ...eventData,
        id: isExistingDragEvent ? existingEventId : generateEventId(),
        start,
        end,
        // Preserve repeat option from eventData - don't override it
        repeat: eventData.repeat || 'none',
        // Don't set seriesId here - it will be set in finalizeNewEvent if repeat is selected
        seriesId: null,
        isRepeat: false,
        // Ensure both allDay and isAllDay are set consistently
        allDay: eventData.allDay || false,
        isAllDay: eventData.allDay || false,
        // Mark as NOT persisted - will be persisted in finalizeNewEvent
        _isPersisted: false,
      };

      setEvents((prev) => {
        // If this is an existing drag-to-create event, update it instead of adding
        if (isExistingDragEvent) {
          return prev.map(e => e.id === existingEventId ? newEvent : e);
        }
        
        // Always add as single event - recurring instances generated on finalize
        return [...prev, newEvent];
      });

      // Persist to Convex database and sync to Google Calendar
      const persistEvent = async () => {
        console.log('[useEventManagement] persistEvent called for:', newEvent.title, 'id:', newEvent.id);
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
          
          // Sanitize attendees - convert null values to undefined for Convex validation
          const sanitizedAttendees = newEvent.attendees?.map(attendee => ({
            email: attendee.email,
            displayName: attendee.displayName || undefined,
            responseStatus: attendee.responseStatus || undefined,
            organizer: attendee.organizer || undefined,
            self: attendee.self || undefined,
          }));

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
            attendees: sanitizedAttendees,
            // Google Meet conferencing - will be created when syncing to Google Calendar
            hangoutLink: newEvent.hangoutLink || undefined,
            addGoogleMeet: newEvent.addGoogleMeet || false,
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

      // Don't persist immediately - wait until user is done editing
      // The event will be persisted when the CommandBar closes via finalizeNewEvent

      return newEvent;
    },
    [commandBarRef, createEventMutation, isAuthenticated, pushEventToGoogle]
  );

  // Finalize and persist a new event to Convex (called when CommandBar closes)
  const finalizeNewEvent = useCallback(async (eventData) => {
    console.log('[useEventManagement] finalizeNewEvent called for:', eventData.title);
    console.log('[useEventManagement] finalizeNewEvent id:', eventData.id, 'type:', typeof eventData.id);
    console.log('[useEventManagement] finalizeNewEvent repeat:', eventData.repeat, 'rruleOptions:', eventData.rruleOptions);
    
    // Only finalize UUID events (local events that haven't been persisted yet)
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const isUUID = eventData.id?.includes('-');
    console.log('[useEventManagement] isUUID check:', isUUID, 'id contains dash:', eventData.id?.includes('-'));
    
    if (!isUUID) {
      console.log('[useEventManagement] Skipping finalize - not a UUID event, id:', eventData.id);
      return;
    }

    try {
      const start = eventData.start instanceof Date ? eventData.start : new Date(eventData.start);
      const end = eventData.end instanceof Date ? eventData.end : new Date(eventData.end);
      const localEventId = eventData.id;

      // Check if this is a recurring event
      const isRecurring = eventData.repeat && eventData.repeat !== 'none';
      console.log('[useEventManagement] finalizeNewEvent called, repeat:', eventData.repeat, 'isRecurring:', isRecurring);
      
      // Prepare rruleOptions for Convex (convert Date objects to timestamps, serialize Weekday objects)
      let rruleOptionsForConvex = null;
      if (eventData.rruleOptions) {
        rruleOptionsForConvex = { ...eventData.rruleOptions };
        
        // Convert Date objects to timestamps
        if (rruleOptionsForConvex.dtstart instanceof Date) {
          rruleOptionsForConvex.dtstart = rruleOptionsForConvex.dtstart.getTime();
        }
        if (rruleOptionsForConvex.until instanceof Date) {
          rruleOptionsForConvex.until = rruleOptionsForConvex.until.getTime();
        }
        
        // Serialize byweekday - rrule.js creates Weekday objects like {weekday: 0, n: undefined}
        // Convex can't store these, so convert to simple numbers
        if (Array.isArray(rruleOptionsForConvex.byweekday)) {
          rruleOptionsForConvex.byweekday = rruleOptionsForConvex.byweekday.map(day => {
            if (typeof day === 'number') return day;
            if (day && typeof day === 'object') {
              // Handle Weekday objects from rrule.js
              if (typeof day.weekday === 'number') return day.weekday;
              if (typeof day.day === 'number') return day.day;
            }
            return day;
          }).filter(day => typeof day === 'number');
        }
        
        // Ensure bymonthday and bymonth are simple number arrays
        if (Array.isArray(rruleOptionsForConvex.bymonthday)) {
          rruleOptionsForConvex.bymonthday = rruleOptionsForConvex.bymonthday
            .map(d => typeof d === 'string' ? parseInt(d, 10) : d)
            .filter(d => typeof d === 'number' && !isNaN(d));
        }
        if (Array.isArray(rruleOptionsForConvex.bymonth)) {
          rruleOptionsForConvex.bymonth = rruleOptionsForConvex.bymonth
            .map(m => typeof m === 'string' ? parseInt(m, 10) : m)
            .filter(m => typeof m === 'number' && !isNaN(m));
        }
      }

      // Sanitize attendees - convert null values to undefined for Convex validation
      const sanitizedAttendees = eventData.attendees?.map(attendee => ({
        email: attendee.email,
        displayName: attendee.displayName || undefined,
        responseStatus: attendee.responseStatus || undefined,
        organizer: attendee.organizer || undefined,
        self: attendee.self || undefined,
      }));

      if (isRecurring) {
        // For recurring events: store ONE event with RRULE, expand instances on-the-fly
        // This is the industry standard approach used by Google Calendar, Outlook, etc.
        console.log('[useEventManagement] Creating recurring event with RRULE, repeat:', eventData.repeat, 'rruleOptions:', rruleOptionsForConvex);
        
        // Generate a series ID for this recurring event
        const seriesId = generateEventId();
        
        // Create a single event with recurrence info - instances are expanded on display
        const convexEventId = await createEventMutation({
          title: eventData.title || 'New Event',
          description: eventData.description || '',
          color: eventData.color || '#F59E0B',
          location: eventData.location || '',
          start: start.getTime(),
          end: end.getTime(),
          isAllDay: eventData.isAllDay || false,
          repeat: eventData.repeat,
          seriesId: seriesId,
          isRepeat: true,
          rruleOptions: rruleOptionsForConvex,
          viewId: eventData.viewId || 'default',
          source: 'local',
          isDraft: false,
          attendees: sanitizedAttendees,
          hangoutLink: eventData.hangoutLink && eventData.hangoutLink !== 'undefined' ? eventData.hangoutLink : undefined,
          addGoogleMeet: eventData.addGoogleMeet || false,
        });
        
        console.log('[useEventManagement] Created recurring event in Convex:', convexEventId);
        
        // Remove the local UUID event
        setEvents(prev => prev.filter(e => e.id !== localEventId));
        console.log('[useEventManagement] Removed local UUID event:', localEventId);
        
        // Sync to Google Calendar (Google handles recurrence via RRULE)
        // Always attempt sync - isAuthenticated from useConvexAuth may not reflect Google auth status
        console.log('[useEventManagement] Attempting Google sync, isAuthenticated:', isAuthenticated, 'convexEventId:', convexEventId);
        if (convexEventId) {
          try {
            console.log('[useEventManagement] Syncing recurring event to Google:', convexEventId);
            const syncResult = await pushEventToGoogle({ eventId: convexEventId });
            console.log('[useEventManagement] Recurring event sync result:', JSON.stringify(syncResult));
            if (syncResult?.success === false) {
              console.warn('[useEventManagement] Google sync failed:', syncResult.reason);
            }
          } catch (syncError) {
            console.error('[useEventManagement] Failed to sync recurring event to Google Calendar:', syncError);
          }
        } else {
          console.log('[useEventManagement] Skipping Google sync - not authenticated or no convex ID');
        }
        
        return convexEventId;
      } else {
        // Non-recurring event: persist single event to Convex
        const convexEventId = await createEventMutation({
          title: eventData.title || 'New Event',
          description: eventData.description || '',
          color: eventData.color || '#F59E0B',
          location: eventData.location || '',
          start: start.getTime(),
          end: end.getTime(),
          isAllDay: eventData.isAllDay || false,
          repeat: 'none',
          seriesId: undefined,
          isRepeat: false,
          rruleOptions: undefined,
          viewId: eventData.viewId || 'default',
          source: 'local',
          isDraft: false,
          attendees: sanitizedAttendees,
          hangoutLink: eventData.hangoutLink && eventData.hangoutLink !== 'undefined' ? eventData.hangoutLink : undefined,
          addGoogleMeet: eventData.addGoogleMeet || false,
        });

        console.log('[useEventManagement] Event finalized to Convex:', convexEventId);

        // Remove the local UUID event now that it's persisted to Convex
        setEvents(prev => prev.filter(e => e.id !== localEventId));
        console.log('[useEventManagement] Removed local UUID event:', localEventId);

        // Sync to Google Calendar - always attempt, Convex action handles auth
        if (convexEventId) {
          try {
            const syncResult = await pushEventToGoogle({ eventId: convexEventId });
            console.log('[useEventManagement] Event synced to Google Calendar:', syncResult);
          } catch (syncError) {
            console.error('[useEventManagement] Failed to sync to Google Calendar:', syncError);
          }
        }

        return convexEventId;
      }
    } catch (error) {
      console.error('[useEventManagement] Failed to finalize event to Convex:', error);
      throw error;
    }
  }, [createEventMutation, pushEventToGoogle, setEvents]);

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

      // Check if this is an expanded recurring instance (ID contains underscore suffix like abc123_1)
      // OR if this is the first occurrence (base event ID, but has isRecurring flag from expansion)
      // OR if this is a legacy series event (has seriesId but uses UUID format)
      const hasUnderscoreSuffix = cleanEvent.id?.includes('_') && !cleanEvent.id?.includes('-');
      const isFirstOccurrence = cleanEvent.isRecurring && cleanEvent.seriesId === cleanEvent.id;
      const isLegacySeriesEvent = cleanEvent.seriesId && cleanEvent.id?.includes('-'); // UUID format with seriesId
      const isExpandedInstance = hasUnderscoreSuffix || isFirstOccurrence;
      const baseEventId = hasUnderscoreSuffix ? cleanEvent.id.split('_')[0] : cleanEvent.id;
      
      // For legacy series events, the base event is the one with id === seriesId
      const legacyBaseEventId = isLegacySeriesEvent ? cleanEvent.seriesId : null;
      
      console.log('[useEventManagement] handleUpdateEvent - instance detection:', {
        eventId: cleanEvent.id,
        editScope,
        hasUnderscoreSuffix,
        isFirstOccurrence,
        isExpandedInstance,
        isLegacySeriesEvent,
        baseEventId,
        legacyBaseEventId,
        isRecurring: cleanEvent.isRecurring,
        seriesId: cleanEvent.seriesId,
        _overrideDateKey: cleanEvent._overrideDateKey,
      });
      
      // For expanded recurring instances being edited as 'single', store instance override on base event
      // This is Notion Calendar style - the event stays in the series, only this instance gets the override
      if (isExpandedInstance && editScope === 'single') {
        console.log('[useEventManagement] Storing instance override for expanded instance:', cleanEvent.id);
        
        // Find the base recurring event
        const baseEvent = prevEvents.find(e => e.id === baseEventId);
        if (!baseEvent) {
          console.error('[useEventManagement] Base event not found for instance override:', baseEventId);
          return prevEvents;
        }
        
        // Get the date key for this instance (YYYY-MM-DD)
        // Use _overrideDateKey if available (from expansion), otherwise calculate from start
        const dateKey = cleanEvent._overrideDateKey || (() => {
          const instanceDate = cleanEvent.start instanceof Date ? cleanEvent.start : new Date(cleanEvent.start);
          return instanceDate.toISOString().split('T')[0];
        })();
        
        // Create the override object with the changed properties
        // For drag/resize operations, also store time offsets
        const isDragOrResize = cleanEvent._isDragging || cleanEvent._isResizing;
        const timeChange = cleanEvent._timeChange;
        
        const override = {
          title: cleanEvent.title,
          description: cleanEvent.description,
          color: cleanEvent.color,
          location: cleanEvent.location,
          // For drag/resize, store the time offset from the original occurrence
          ...(isDragOrResize && timeChange && {
            startOffset: timeChange.startDiff,
            endOffset: timeChange.endDiff,
          }),
        };
        
        console.log('[useEventManagement] Creating instance override:', {
          isDragOrResize,
          timeChange,
          override,
        });
        
        // Update the base event with the new instance override
        const updatedBaseEvent = {
          ...baseEvent,
          instanceOverrides: {
            ...(baseEvent.instanceOverrides || {}),
            [dateKey]: override,
          },
        };
        
        console.log('[useEventManagement] Updated base event with instance override:', {
          baseEventId,
          dateKey,
          override,
          updatedBaseEventOverrides: updatedBaseEvent.instanceOverrides,
        });
        
        // Replace the base event in the array
        return prevEvents.map(e => e.id === baseEventId ? updatedBaseEvent : e);
      }
      
      // For expanded recurring instances being edited as 'all', update base event and clear override for this instance
      if (isExpandedInstance && editScope === 'all') {
        console.log('[useEventManagement] 🔴 EXPANDED INSTANCE ALL SCOPE - baseEventId:', baseEventId);
        console.log('[useEventManagement] 🔴 Available event IDs:', prevEvents.map(e => e.id));
        
        // Find the base recurring event
        const baseEvent = prevEvents.find(e => e.id === baseEventId);
        if (!baseEvent) {
          console.error('[useEventManagement] Base event not found for all events update:', baseEventId);
          return prevEvents;
        }
        console.log('[useEventManagement] 🔴 Found base event:', baseEvent.id, 'start:', baseEvent.start);
        
        // Get the date key for this instance to clear its override
        const dateKey = cleanEvent._overrideDateKey || (() => {
          const instanceDate = cleanEvent.start instanceof Date ? cleanEvent.start : new Date(cleanEvent.start);
          return instanceDate.toISOString().split('T')[0];
        })();
        
        // Remove the override for this instance (if any) since we're updating all events
        const existingOverrides = baseEvent.instanceOverrides || {};
        const { [dateKey]: removed, ...remainingOverrides } = existingOverrides;
        
        // For drag/resize operations, apply time change to the base event
        // This will shift all expanded instances by the same amount
        // NOTE: timeChange was already extracted at the top of handleUpdateEvent (line ~370)
        let newStart = baseEvent.start;
        let newEnd = baseEvent.end;
        
        console.log('[useEventManagement] 🔴 timeChange:', timeChange);
        
        if (timeChange && (timeChange.startDiff || timeChange.endDiff)) {
          const startTime = baseEvent.start instanceof Date ? baseEvent.start.getTime() : new Date(baseEvent.start).getTime();
          const endTime = baseEvent.end instanceof Date ? baseEvent.end.getTime() : new Date(baseEvent.end).getTime();
          newStart = new Date(startTime + (timeChange.startDiff || 0));
          newEnd = new Date(endTime + (timeChange.endDiff || 0));
          console.log('[useEventManagement] 🔴 Applying time change to base event:', { 
            oldStart: baseEvent.start, 
            oldEnd: baseEvent.end,
            startDiff: timeChange.startDiff,
            endDiff: timeChange.endDiff,
            newStart, 
            newEnd 
          });
        } else {
          console.log('[useEventManagement] 🔴 NO TIME CHANGE - timeChange is:', timeChange);
        }
        
        // Update the base event with the new properties, time, and cleared override
        const updatedBaseEvent = {
          ...baseEvent,
          title: cleanEvent.title,
          description: cleanEvent.description,
          color: cleanEvent.color,
          location: cleanEvent.location,
          start: newStart,
          end: newEnd,
          instanceOverrides: Object.keys(remainingOverrides).length > 0 ? remainingOverrides : undefined,
        };
        
        console.log('[useEventManagement] Updated base event for all events:', {
          baseEventId,
          clearedOverrideForDate: dateKey,
          remainingOverrides,
          timeChange,
        });
        
        // Replace the base event in the array
        return prevEvents.map(e => e.id === baseEventId ? updatedBaseEvent : e);
      }
      
      // For RRULE-based expanded instances with any other scope, just update the base event
      // This prevents falling through to the legacy updateSeriesEvents logic
      if (isExpandedInstance) {
        console.log('[useEventManagement] Expanded instance with scope:', editScope, '- updating base event directly');
        const baseEvent = prevEvents.find(e => e.id === baseEventId);
        if (baseEvent) {
          // For any scope on expanded instances, update the base event
          const updatedBaseEvent = {
            ...baseEvent,
            title: cleanEvent.title,
            description: cleanEvent.description,
            color: cleanEvent.color,
            location: cleanEvent.location,
          };
          return prevEvents.map(e => e.id === baseEventId ? updatedBaseEvent : e);
        }
        return prevEvents;
      }
      
      // For legacy series events with 'single' scope, just update this specific event
      // This prevents the destructive updateSeriesEvents logic from running
      if (isLegacySeriesEvent && editScope === 'single') {
        console.log('[useEventManagement] Legacy series event with single scope - updating only this event:', cleanEvent.id);
        return prevEvents.map(e => {
          if (e.id === cleanEvent.id) {
            return {
              ...e,
              title: cleanEvent.title,
              description: cleanEvent.description,
              color: cleanEvent.color,
              location: cleanEvent.location,
              start: cleanEvent.start,
              end: cleanEvent.end,
            };
          }
          return e;
        });
      }
      
      // For legacy series events with 'all' scope, update all events in the series
      if (isLegacySeriesEvent && editScope === 'all') {
        const timeChange = cleanEvent._timeChange;
        console.log('[useEventManagement] Legacy series event with all scope - updating all events in series:', cleanEvent.seriesId, 'timeChange:', timeChange, 'startDiff:', timeChange?.startDiff, 'endDiff:', timeChange?.endDiff);
        
        return prevEvents.map(e => {
          if (e.seriesId === cleanEvent.seriesId) {
            // Apply time change to all events in the series
            let newStart = e.start;
            let newEnd = e.end;
            
            if (timeChange && (timeChange.startDiff || timeChange.endDiff)) {
              const startTime = e.start instanceof Date ? e.start.getTime() : new Date(e.start).getTime();
              const endTime = e.end instanceof Date ? e.end.getTime() : new Date(e.end).getTime();
              newStart = new Date(startTime + (timeChange.startDiff || 0));
              newEnd = new Date(endTime + (timeChange.endDiff || 0));
            }
            
            return {
              ...e,
              title: cleanEvent.title,
              description: cleanEvent.description,
              color: cleanEvent.color,
              location: cleanEvent.location,
              start: newStart,
              end: newEnd,
            };
          }
          return e;
        });
      }
      
      // For recurring events (legacy path - should not be reached for RRULE-based events or legacy series with explicit scope)
      // Only reach here if we haven't already handled the event above
      if (cleanEvent.seriesId && !isLegacySeriesEvent) {
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
      
      // For new events (UUID), don't generate recurring instances here
      // They will be generated on finalize when CommandBar closes
      const isLocalUUIDEvent = cleanEvent.id?.includes('-');
      
      if (existingEvent && 
          (!existingEvent.repeat || existingEvent.repeat === 'none') && 
          cleanEvent.repeat && 
          cleanEvent.repeat !== 'none' &&
          !isLocalUUIDEvent) {
        
        // Only generate recurring instances for existing Convex events
        // New events will have instances generated on finalize
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
      return prevEvents.map(event => {
        if (event.id === cleanEvent.id) {
          // Preserve _isPersisted flag from existing event or incoming update
          return { ...cleanEvent, _isPersisted: event._isPersisted || cleanEvent._isPersisted };
        }
        return event;
      });
    });

    // Persist update to Convex and sync to Google Calendar
    const persistUpdate = async () => {
      try {
        // Check if this is a Convex ID (starts with specific format) or local ID
        const eventId = updatedEvent._id || updatedEvent.id;
        
        // Skip if no valid ID or if it's a draft
        if (!eventId || updatedEvent.isDraft) {
          return;
        }
        
        // Skip if the ID is a UUID (local ID, not yet synced to Convex)
        // Convex IDs don't contain hyphens, UUIDs do
        if (eventId.includes('-')) {
          console.log('[useEventManagement] Skipping update for local UUID:', eventId);
          return;
        }

        // Extract edit scope to determine how to persist
        const editScope = updatedEvent._editScope || 'single';
        
        // Check if this is an expanded recurring instance (ID contains underscore suffix like abc123_1)
        // OR if this is the first occurrence (base event ID, but has isRecurring flag from expansion)
        const hasUnderscoreSuffix = eventId.includes('_');
        const isFirstOccurrence = updatedEvent.isRecurring && updatedEvent.seriesId === eventId;
        const isExpandedInstance = hasUnderscoreSuffix || isFirstOccurrence;
        const baseEventId = hasUnderscoreSuffix ? eventId.split('_')[0] : eventId;
        
        // For 'single' scope on recurring events, we need to store instance override
        const isInstanceOverride = editScope === 'single' && isExpandedInstance;
        
        console.log('[useEventManagement] Updating event, editScope:', editScope, 'isInstanceOverride:', isInstanceOverride, 'isExpandedInstance:', isExpandedInstance, 'isFirstOccurrence:', isFirstOccurrence, 'baseEventId:', baseEventId);
        
        // For expanded recurring instances being edited as 'single', store instance override on base event
        // This is Notion Calendar style - the event stays in the series, only this instance gets the override
        if (editScope === 'single' && isExpandedInstance) {
          console.log('[useEventManagement] Persisting instance override for expanded recurring instance');
          
          // Get the date key for this instance (YYYY-MM-DD)
          // Use the _overrideDateKey if available (from expansion), otherwise calculate from start
          const dateKey = updatedEvent._overrideDateKey || (() => {
            const instanceDate = updatedEvent.start instanceof Date ? updatedEvent.start : new Date(updatedEvent.start);
            return instanceDate.toISOString().split('T')[0];
          })();
          
          // Create the override object with the properties that can be overridden
          // For drag/resize operations, also store time offsets
          const isDragOrResize = updatedEvent._isDragging || updatedEvent._isResizing;
          const timeChange = updatedEvent._timeChange;
          
          const override = {
            title: updatedEvent.title,
            description: updatedEvent.description || '',
            color: updatedEvent.color,
            location: updatedEvent.location || '',
            // For drag/resize, store the time offset from the original occurrence
            ...(isDragOrResize && timeChange && {
              startOffset: timeChange.startDiff,
              endOffset: timeChange.endDiff,
            }),
          };
          
          console.log('[useEventManagement] Persisting instance override:', {
            isDragOrResize,
            timeChange,
            override,
          });
          
          // Get existing instanceOverrides from local state to merge with
          // We need to find the base event in local state to get existing overrides
          let existingOverrides = {};
          setEvents(prev => {
            const baseEvent = prev.find(e => e.id === baseEventId);
            if (baseEvent?.instanceOverrides) {
              existingOverrides = baseEvent.instanceOverrides;
            }
            return prev; // Don't modify state here, just read it
          });
          
          // Merge existing overrides with the new one
          const mergedOverrides = {
            ...existingOverrides,
            [dateKey]: override,
          };
          
          // Update the base event with the merged instance overrides
          await updateEventMutation({
            id: baseEventId,
            instanceOverrides: mergedOverrides,
          });
          
          console.log('[useEventManagement] Instance override persisted to Convex:', {
            baseEventId,
            dateKey,
            override,
            mergedOverrides,
          });
          
          // Sync to Google Calendar - update the specific instance
          // Get the base event from the updated event's metadata or find it in convex events
          const baseEventExternalId = updatedEvent._originalEvent?.externalId || updatedEvent.externalId;
          const baseEventExternalCalendarId = updatedEvent._originalEvent?.externalCalendarId || updatedEvent.externalCalendarId;
          
          console.log('[useEventManagement] Google sync info:', {
            baseEventExternalId,
            baseEventExternalCalendarId,
            hasOriginalEvent: !!updatedEvent._originalEvent,
          });
          
          if (baseEventExternalId && baseEventExternalCalendarId) {
            // Calculate the original start time for this instance (before any override)
            const originalStartTime = updatedEvent._originalEvent?.start 
              ? (updatedEvent._originalEvent.start instanceof Date 
                  ? updatedEvent._originalEvent.start.toISOString() 
                  : new Date(updatedEvent._originalEvent.start).toISOString())
              : `${dateKey}T00:00:00.000Z`;
            
            // Calculate new start/end times
            const newStart = updatedEvent.start instanceof Date 
              ? updatedEvent.start.getTime() 
              : new Date(updatedEvent.start).getTime();
            const newEnd = updatedEvent.end instanceof Date 
              ? updatedEvent.end.getTime() 
              : new Date(updatedEvent.end).getTime();
            
            console.log('[useEventManagement] Calling updateRecurringEventInstance:', {
              calendarId: baseEventExternalCalendarId,
              recurringEventId: baseEventExternalId,
              originalStartTime,
              newStart: new Date(newStart).toISOString(),
              newEnd: new Date(newEnd).toISOString(),
            });
            
            try {
              const syncResult = await updateRecurringEventInstance({
                calendarId: baseEventExternalCalendarId,
                recurringEventId: baseEventExternalId,
                originalStartTime,
                newStart,
                newEnd,
                title: updatedEvent.title,
                description: updatedEvent.description || '',
                location: updatedEvent.location || '',
                isAllDay: updatedEvent.isAllDay || false,
              });
              console.log('[useEventManagement] Instance synced to Google Calendar:', syncResult);
            } catch (syncError) {
              console.error('[useEventManagement] Failed to sync instance to Google Calendar:', syncError);
              // Fall back to syncing the base event
              try {
                const fallbackResult = await pushEventToGoogle({ eventId: baseEventId });
                console.log('[useEventManagement] Fallback sync result:', fallbackResult);
              } catch (fallbackError) {
                console.error('[useEventManagement] Fallback sync also failed:', fallbackError);
              }
            }
          } else {
            console.log('[useEventManagement] No Google Calendar IDs available, skipping Google sync');
          }
          
          return;
        }
        
        // For expanded recurring instances being edited as 'all', update base event and clear override
        if (editScope === 'all' && isExpandedInstance) {
          console.log('[useEventManagement] Persisting "all events" update for expanded recurring instance');
          
          // Get the date key for this instance to clear its override
          const dateKey = updatedEvent._overrideDateKey || (() => {
            const instanceDate = updatedEvent.start instanceof Date ? updatedEvent.start : new Date(updatedEvent.start);
            return instanceDate.toISOString().split('T')[0];
          })();
          
          // Get existing instanceOverrides from local state
          let existingOverrides = {};
          setEvents(prev => {
            const baseEvent = prev.find(e => e.id === baseEventId);
            if (baseEvent?.instanceOverrides) {
              existingOverrides = baseEvent.instanceOverrides;
            }
            return prev;
          });
          
          // Remove the override for this instance
          const { [dateKey]: removed, ...remainingOverrides } = existingOverrides;
          
          // For drag/resize operations, calculate the new start/end times for the base event
          // Use the _originalEvent to get the original times before the drag
          const timeChange = updatedEvent._timeChange;
          const originalEvent = updatedEvent._originalEvent;
          let newStart = null;
          let newEnd = null;
          
          if (timeChange && (timeChange.startDiff || timeChange.endDiff) && originalEvent) {
            // Calculate new times from the ORIGINAL event times (before drag)
            const originalStartTime = originalEvent.start instanceof Date ? originalEvent.start.getTime() : new Date(originalEvent.start).getTime();
            const originalEndTime = originalEvent.end instanceof Date ? originalEvent.end.getTime() : new Date(originalEvent.end).getTime();
            newStart = new Date(originalStartTime + (timeChange.startDiff || 0));
            newEnd = new Date(originalEndTime + (timeChange.endDiff || 0));
            
            console.log('[useEventManagement] Calculating new times from original:', {
              originalStart: new Date(originalStartTime),
              originalEnd: new Date(originalEndTime),
              timeChange,
              newStart,
              newEnd,
            });
          }
          
          // Update the base event with new properties, time, and cleared override
          const updatePayload = {
            id: baseEventId,
            title: updatedEvent.title,
            description: updatedEvent.description || '',
            color: updatedEvent.color,
            location: updatedEvent.location || '',
            instanceOverrides: Object.keys(remainingOverrides).length > 0 ? remainingOverrides : null,
            // Include time change if present
            ...(newStart && newEnd && {
              start: newStart.getTime(),
              end: newEnd.getTime(),
            }),
          };
          
          console.log('[useEventManagement] Persisting all events update with payload:', updatePayload);
          
          await updateEventMutation(updatePayload);
          
          console.log('[useEventManagement] Base event updated for all events:', {
            baseEventId,
            clearedOverrideForDate: dateKey,
            newStart,
            newEnd,
          });
          
          // Sync to Google Calendar
          try {
            const syncResult = await pushEventToGoogle({ eventId: baseEventId });
            console.log('[useEventManagement] Base event synced to Google Calendar:', syncResult);
          } catch (syncError) {
            console.error('[useEventManagement] Failed to sync base event to Google Calendar:', syncError);
          }
          
          return;
        }
        
        // For non-expanded instances or other scopes, use the regular update flow
        const convexId = isExpandedInstance ? baseEventId : eventId;
        
        // Prepare the event data for persistence
        const eventToPersist = updatedEvent;

        // Prepare rruleOptions for Convex (convert Date objects to timestamps)
        let rruleOptionsForConvex = null;
        if (eventToPersist.rruleOptions) {
          rruleOptionsForConvex = { ...eventToPersist.rruleOptions };
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
          // Serialize byweekday objects
          if (Array.isArray(rruleOptionsForConvex.byweekday)) {
            rruleOptionsForConvex.byweekday = rruleOptionsForConvex.byweekday.map(day => {
              if (typeof day === 'number') return day;
              if (day && typeof day === 'object') {
                if (typeof day.weekday === 'number') return day.weekday;
                if (typeof day.day === 'number') return day.day;
              }
              return day;
            }).filter(day => typeof day === 'number');
          }
        }

        const start = eventToPersist.start instanceof Date ? eventToPersist.start.getTime() : eventToPersist.start;
        const end = eventToPersist.end instanceof Date ? eventToPersist.end.getTime() : eventToPersist.end;

        console.log('[useEventManagement] Updating event, editScope:', editScope, 'isExpandedInstance:', isExpandedInstance);

        // Sanitize attendees - convert null values to undefined for Convex validation
        const sanitizedAttendees = eventToPersist.attendees?.map(attendee => ({
          email: attendee.email,
          displayName: attendee.displayName || undefined,
          responseStatus: attendee.responseStatus || undefined,
          organizer: attendee.organizer || undefined,
          self: attendee.self || undefined,
        }));

        await updateEventMutation({
          id: convexId,
          title: eventToPersist.title,
          description: eventToPersist.description || '',
          color: eventToPersist.color,
          location: eventToPersist.location || '',
          start,
          end,
          isAllDay: eventToPersist.isAllDay || false,
          repeat: eventToPersist.repeat || 'none',
          seriesId: eventToPersist.seriesId || undefined,
          isRepeat: eventToPersist.isRepeat || false,
          rruleOptions: rruleOptionsForConvex,
          attendees: sanitizedAttendees,
        });

        console.log('[useEventManagement] Event updated in Convex:', convexId);

        // Sync to Google Calendar
        if (convexId) {
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
  }, [setEvents, createEventMutation, updateEventMutation, isAuthenticated, pushEventToGoogle]);

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

          // Skip Convex delete for UUID events (local events not yet synced)
          // UUIDs contain hyphens, Convex IDs don't
          if (convexId.includes('-')) {
            console.log('[useEventManagement] Skipping Convex delete for local UUID event:', convexId);
            return;
          }

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
              // Skip Convex delete for UUID events (local events not yet synced)
              if (convexId.includes('-')) {
                console.log('[useEventManagement] Skipping Convex delete for local UUID series event:', convexId);
                continue;
              }
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
    finalizeNewEvent,
    editingEventId,
    setEditingEventId
  };
}
