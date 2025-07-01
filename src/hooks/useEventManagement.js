import { useState, useCallback, useEffect } from "react";
import { generateEventId } from "../utils/eventUtils";
import { generateRecurringEvents, updateSeriesEvents, getEventsInSeries } from "../utils/recurrenceUtils";

export function useEventManagement(commandBarRef) {
  const [events, setEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);
  
  // Load events from localStorage when component mounts
  useEffect(() => {
    const savedEvents = localStorage.getItem("calendarEvents");
    if (savedEvents) {
      try {
        const parsedEvents = JSON.parse(savedEvents)
          .filter(event => !event.isDraft) // Filter out draft events on page refresh
          .map((event) => {
            // Parse regular date fields
            const processedEvent = {
              ...event,
              start: new Date(event.start),
              end: new Date(event.end),
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
        setEvents(parsedEvents);
      } catch (error) {
        console.error("Error parsing saved events:", error);
        setEvents([]);
      }
    }
  }, []);

  // Save events to localStorage whenever they change
  useEffect(() => {
    // Filter out draft events before saving to localStorage
    const eventsToSave = events.filter(event => !event.isDraft);
    
    if (eventsToSave.length > 0) {
      localStorage.setItem("calendarEvents", JSON.stringify(eventsToSave));
    } else {
      // Clear localStorage when all non-draft events are deleted
      localStorage.removeItem("calendarEvents");
    }
  }, [events]);

  const handleCreateEvent = useCallback(
    (eventData) => {
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

      // Immediately open CommandBar for editing
      if (commandBarRef.current) {
        commandBarRef.current.openForEdit(newEvent);
      }

      return newEvent;
    },
    [commandBarRef]
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
  }, [setEvents]);

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
    }
  }, []);

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
  }, [setEvents]);

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
