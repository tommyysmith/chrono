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
        const parsedEvents = JSON.parse(savedEvents).map((event) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));
        setEvents(parsedEvents);
      } catch (error) {
        console.error("Error parsing saved events:", error);
        setEvents([]);
      }
    }
  }, []);

  // Save events to localStorage whenever they change
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem("calendarEvents", JSON.stringify(events));
    } else {
      // Clear localStorage when all events are deleted
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
    // --- NEW LOGGING ---
    console.log('🔵🔵🔵 [START] handleUpdateEvent 🔵🔵🔵 - Received from modal/dragdrop:', {
      id: updatedEvent?.id,
      start: updatedEvent?.start,
      end: updatedEvent?.end,
      seriesId: updatedEvent?.seriesId,
      _editScope: updatedEvent?._editScope,
      _isDragging: updatedEvent?._isDragging,
      _isResizing: updatedEvent?._isResizing,
      _exactPosition: updatedEvent?._exactPosition,
      _preserveExactPosition: updatedEvent?._preserveExactPosition,
      _detachedEvent: updatedEvent?._detachedEvent,
    });
    // --- END NEW LOGGING ---

    console.log('handleUpdateEvent called with:', {
      eventId: updatedEvent.id,
      updatedEvent,
      editScope: updatedEvent._editScope,
      manipulatedId: updatedEvent.id,
      timeChange: updatedEvent._timeChange,
      isDragging: updatedEvent._isDragging,
      isResizing: updatedEvent._isResizing
    });

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
    
    console.log('Processing update with options:', {
      editScope,
      timeChange,
      isDragging,
      isResizing
    });

    setEvents(prevEvents => {
      // For recurring events
      if (cleanEvent.seriesId) {
        // Find the existing event and the base event
        const existingEvent = prevEvents.find(e => e.id === cleanEvent.id);
        const seriesEvents = prevEvents.filter(e => e.seriesId === cleanEvent.seriesId);
        const baseEvent = seriesEvents.reduce((earliest, event) => 
          event.start < earliest.start ? event : earliest, 
          seriesEvents[0]
        );
        
        // Check if the repeat pattern has changed
        if (existingEvent && 
            existingEvent.repeat !== cleanEvent.repeat && 
            cleanEvent.repeat && 
            cleanEvent.repeat !== 'none') {
          
          console.log('Recurring pattern changed for recurring event:', {
            eventId: cleanEvent.id,
            oldRepeatRule: existingEvent.repeat,
            newRepeatRule: cleanEvent.repeat
          });
          
          // Keep the same series ID for consistency
          const seriesId = cleanEvent.seriesId;
          
          // Update the event with the new recurring properties
          const updatedEvent = {
            ...cleanEvent,
            seriesId,
            isRepeat: true
          };
          
          // Generate the new recurring series with the updated pattern
          const recurringEvents = generateRecurringEvents(updatedEvent);
          
          // Replace the original series with the new recurring series
          return prevEvents
            .filter(e => e.seriesId !== cleanEvent.seriesId) // Remove the original series
            .concat(recurringEvents);                        // Add the new recurring series
        }
        
        console.log('Updating series event without pattern change:', {
          seriesId: cleanEvent.seriesId,
          baseEventId: baseEvent.id,
          eventsInSeries: seriesEvents.length
        });
        
        // Use recurrence utils to update series events
        const newEventsState = updateSeriesEvents(prevEvents, cleanEvent, {
          editScope,
          timeChange,
          baseEvent,
          isDragging,
          isResizing
        });
        
        console.log(`[handleUpdateEvent] About to call setEvents for ID: ${cleanEvent.id}. Events array length: ${newEventsState.length}`);
        const eventCheckBeforeSet = newEventsState.find(e => e.id === cleanEvent.id);
        console.log(`[handleUpdateEvent] Event ${cleanEvent.id} in array BEFORE setEvents:`, eventCheckBeforeSet ? {start: eventCheckBeforeSet.start, end: eventCheckBeforeSet.end} : 'NOT FOUND');

        setEvents(newEventsState); // Apply the update

        // Log immediately after setEvents (though state update is async)
        console.log(`[handleUpdateEvent] Called setEvents for ID: ${cleanEvent.id}`);

        return newEventsState;
      }
      
      // For non-recurring events that are being updated
      // Check if this is a non-recurring event being changed to recurring
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
        
        console.log('Converting non-recurring event to recurring:', {
          eventId: cleanEvent.id,
          newRepeatRule: cleanEvent.repeat
        });
        
        // Generate a series ID for the new recurring event
        const seriesId = generateEventId();
        
        // Update the event with recurring properties
        const updatedEvent = {
          ...cleanEvent,
          seriesId,
          isRepeat: true
        };
        
        // Generate the recurring series
        const recurringEvents = generateRecurringEvents(updatedEvent);
        
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
    if (!event) return;
    
    setEvents((prevEvents) => {
      let updatedEvents;
      
      if (scope === 'all' && event.seriesId) {
        // Delete all events in the series
        updatedEvents = prevEvents.filter(e => e.seriesId !== event.seriesId);
      } else if (scope === 'single' && event.id) {
        // Delete just this instance and any orphaned series events
        updatedEvents = prevEvents.filter(e => {
          if (e.id === event.id) return false;
          if (event.seriesId && e.seriesId === event.seriesId) return false;
          return true;
        });
      } else {
        // If something's wrong with the event data, just return current state
        return prevEvents;
      }
      
      return updatedEvents;
    });
  }, []);

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
