import { useState, useCallback, useEffect, useMemo } from "react";
import { generateRepeatedEvents, generateEventId } from "../utils/eventUtils";

export function useEventManagement(commandBarRef) {
  const [events, setEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);

  // Load events from localStorage when component mounts
  useEffect(() => {
    const savedEvents = localStorage.getItem("calendarEvents");
    if (savedEvents) {
      const parsedEvents = JSON.parse(savedEvents).map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));
      setEvents(parsedEvents);
    }
  }, []);

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
        isRepeat: Boolean(seriesId)
      };

      setEvents((prev) => {
        const newEvents = [...prev, newEvent];
        localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
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

  const handleUpdateEvent = useCallback((eventData) => {
    // Create a clean copy of the event data without internal properties
    const cleanEventData = { ...eventData };

    // Store important metadata before we remove it
    const editScope = eventData._editScope;
    const preserveSeriesEvents = eventData._preserveSeriesEvents;
    const timeChange = eventData._timeChange;
    const originalSeriesId = eventData._originalSeriesId;
    const repeatChanged = eventData._repeatChanged;
    const isSeriesUpdate = eventData._seriesUpdate;
    const exactPosition = eventData._exactPosition;
    const isBeingManipulated = eventData._isBeingManipulated;
    const originalEvent = eventData._originalEvent;

    // Remove internal properties that shouldn't be stored
    delete cleanEventData._editScope;
    delete cleanEventData._repeatChanged;
    delete cleanEventData._timeChange;
    delete cleanEventData._originalSeriesId;
    delete cleanEventData._preserveSeriesEvents;
    delete cleanEventData._seriesUpdate;
    delete cleanEventData._exactPosition;
    delete cleanEventData._originalEvent;
    delete cleanEventData._isBeingManipulated;

    // Ensure we have valid start/end times
    cleanEventData.start = cleanEventData.start instanceof Date ? cleanEventData.start : new Date(cleanEventData.start);
    cleanEventData.end = cleanEventData.end instanceof Date ? cleanEventData.end : new Date(cleanEventData.end);

    setEditingEventId(null);

    // First, create a clone of the current events
    let updatedEvents = [];
    let existingEvent = null;
    let seriesId = null;

    setEvents((prev) => {
      // Find the existing event and determine if we're dealing with a repeat event
      existingEvent = prev.find((e) => e.id === eventData.id);
      if (!existingEvent) return prev;
      
      // Get the seriesId whether from original or existing event
      seriesId = originalSeriesId || existingEvent?.seriesId;
      
      // Clone the events array to avoid reference issues
      updatedEvents = [...prev];
      
      // Calculate time differences
      const startDiff = exactPosition 
        ? exactPosition.start.getTime() - existingEvent.start.getTime()
        : timeChange?.startDiff || cleanEventData.start.getTime() - existingEvent.start.getTime();
      const endDiff = exactPosition
        ? exactPosition.end.getTime() - existingEvent.end.getTime()
        : timeChange?.endDiff || cleanEventData.end.getTime() - existingEvent.end.getTime();

      const hasRepeatChanged = existingEvent.repeat !== cleanEventData.repeat;
      
      // Get the ID of the manipulated event
      const manipulatedEventId = isBeingManipulated ? existingEvent.id : null;

      // For single event edits, just detach from the series
      if (editScope === 'single') {
        const updatedEvent = {
          ...cleanEventData,
          id: existingEvent.id,
          seriesId: null,
          repeat: "none",
          isRepeat: false,
          start: exactPosition ? exactPosition.start : cleanEventData.start,
          end: exactPosition ? exactPosition.end : cleanEventData.end,
        };
        
        // Replace the event in the array
        const eventIndex = updatedEvents.findIndex(e => e.id === existingEvent.id);
        if (eventIndex !== -1) {
          updatedEvents[eventIndex] = updatedEvent;
        }
        
        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // If editing a repeat event with the "all" scope
      if ((existingEvent.seriesId || originalSeriesId) && editScope === 'all') {
        // If the repeat option changed or this is a series-wide update, update the base event
        if (hasRepeatChanged || isSeriesUpdate) {
          // Update the base event
          const updatedEvent = {
            ...cleanEventData,
            id: existingEvent.id,
            seriesId: seriesId || generateEventId(),
            isRepeat: true,
            repeat: cleanEventData.repeat,
            start: exactPosition ? exactPosition.start : cleanEventData.start,
            end: exactPosition ? exactPosition.end : cleanEventData.end,
          };
          
          // Replace the event in the array
          const eventIndex = updatedEvents.findIndex(e => e.id === existingEvent.id);
          if (eventIndex !== -1) {
            updatedEvents[eventIndex] = updatedEvent;
          }
        } 
        // For modifications without changing the repeat pattern, update all events in the series
        else {
          // Update each event in the series
          for (let i = 0; i < updatedEvents.length; i++) {
            const event = updatedEvents[i];
            
            if (event.seriesId === seriesId) {
              // Special handling for the manipulated event
              if (event.id === manipulatedEventId) {
                updatedEvents[i] = {
                  ...event,
                  title: cleanEventData.title,
                  description: cleanEventData.description,
                  color: cleanEventData.color,
                  isAllDay: cleanEventData.isAllDay,
                  repeat: cleanEventData.repeat,
                  // Use exact position
                  start: exactPosition ? new Date(exactPosition.start) : new Date(cleanEventData.start),
                  end: exactPosition ? new Date(exactPosition.end) : new Date(cleanEventData.end),
                  seriesId: seriesId,
                  isRepeat: true
                };
              } 
              // For other events in the series, apply the time difference
              else {
                updatedEvents[i] = {
                  ...event,
                  title: cleanEventData.title,
                  description: cleanEventData.description,
                  color: cleanEventData.color,
                  isAllDay: cleanEventData.isAllDay,
                  repeat: cleanEventData.repeat,
                  start: new Date(event.start.getTime() + startDiff),
                  end: new Date(event.end.getTime() + endDiff)
                };
              }
            }
          }
        }
        
        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // For non-repeated events or other cases
      const eventIndex = updatedEvents.findIndex(e => e.id === existingEvent.id);
      if (eventIndex !== -1) {
        // Check if we're converting a non-repeat event to a repeat event
        const isConvertingToRepeat = (!existingEvent.repeat || existingEvent.repeat === 'none') && cleanEventData.repeat && cleanEventData.repeat !== 'none';
        
        if (isConvertingToRepeat || repeatChanged) {
          // Create a new series ID if needed
          const newSeriesId = generateEventId();
          
          // Update the event with repeat properties
          updatedEvents[eventIndex] = {
            ...cleanEventData,
            id: existingEvent.id,
            seriesId: newSeriesId,
            isRepeat: true,
            start: exactPosition ? exactPosition.start : cleanEventData.start,
            end: exactPosition ? exactPosition.end : cleanEventData.end
          };
        } else {
          // Regular single event update
          updatedEvents[eventIndex] = {
            ...cleanEventData,
            id: existingEvent.id
          };
        }
      }
      
      localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
      return updatedEvents;
    });

    return eventData.id;
  }, []);

  const handleDeleteEvent = useCallback((event, setDeleteModalState) => {
    // Only treat as repeated event if it has a repeat property and it's not 'none'
    const isRepeatedEvent = event.repeat && event.repeat !== "none";

    if (isRepeatedEvent) {
      setDeleteModalState({
        isOpen: true,
        event,
      });
    } else {
      // If not a repeated event, delete directly
      setEvents((prevEvents) => {
        const updatedEvents = prevEvents.filter((e) => e.id !== event.id);
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      });
    }
  }, []);

  return {
    events,
    setEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    editingEventId,
    setEditingEventId
  };
}
