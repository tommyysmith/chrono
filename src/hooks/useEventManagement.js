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
      
      const newEvent = {
        ...eventData,
        id: generateEventId(),
        start,
        end,
        seriesId: null,
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

    // Remove internal properties that shouldn't be stored
    delete cleanEventData._editScope;
    delete cleanEventData._repeatChanged;
    delete cleanEventData._timeChange;
    delete cleanEventData._originalSeriesId;
    delete cleanEventData._preserveSeriesEvents;
    delete cleanEventData._seriesUpdate;

    // Ensure we have valid start/end times
    cleanEventData.start = cleanEventData.start instanceof Date ? cleanEventData.start : new Date(cleanEventData.start);
    cleanEventData.end = cleanEventData.end instanceof Date ? cleanEventData.end : new Date(cleanEventData.end);

    setEditingEventId(null);

    setEvents((prev) => {
      const existingEvent = prev.find((e) => e.id === eventData.id);
      if (!existingEvent) return prev;
      
      // Determine if we're dealing with a repeat event
      const isRepeatEvent = existingEvent.seriesId || originalSeriesId;
      const seriesId = originalSeriesId || existingEvent?.seriesId;
      const startDiff = timeChange?.startDiff || cleanEventData.start.getTime() - existingEvent.start.getTime();
      const endDiff = timeChange?.endDiff || cleanEventData.end.getTime() - existingEvent.end.getTime();
      const hasRepeatChanged = existingEvent.repeat !== cleanEventData.repeat;

      // For single event edits, just detach from the series
      if (editScope === 'single') {
        const updatedEvents = prev.map((event) => {
          if (event.id === existingEvent.id) {
            return {
              ...cleanEventData,
              id: existingEvent.id,
              seriesId: null,
              repeat: "none",
              isRepeat: false
            };
          }
          return event;
        });
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // If editing a repeat event with the "all" scope
      if (isRepeatEvent && editScope === 'all') {
        // First, remove all events in the series
        const nonSeriesEvents = prev.filter(e => e.seriesId !== seriesId);
        
        // If the repeat option changed or this is a series-wide update, regenerate the series
        if (hasRepeatChanged || isSeriesUpdate) {
          // Generate new series events with the updated repeat pattern
          const repeatedEvents = generateRepeatedEvents(
            {
              ...cleanEventData,
              id: existingEvent.id,
              seriesId: seriesId || generateEventId(),
              isRepeat: true,
              repeat: cleanEventData.repeat
            },
            cleanEventData.repeat
          );
          
          // Ensure unique IDs for all events except the first one
          const uniqueRepeatedEvents = repeatedEvents.map((event, index) => ({
            ...event,
            id: index === 0 ? existingEvent.id : generateEventId()
          }));
          
          const updatedEvents = [...nonSeriesEvents, ...uniqueRepeatedEvents];
          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
          return updatedEvents;
        }
        
        // For modifications without changing the repeat pattern,
        // update all events in the series while preserving their IDs
        const updatedEvents = prev.map(event => {
          if (event.seriesId === seriesId) {
            return {
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
          return event;
        });
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // If editing future events in a series
      if (isRepeatEvent && editScope === 'future') {
        const cutoffDate = new Date(existingEvent.start);
        
        const updatedEvents = prev.map((e) => {
          if (e.seriesId === seriesId && e.start >= cutoffDate) {
            return {
              ...e,
              title: cleanEventData.title,
              description: cleanEventData.description,
              color: cleanEventData.color,
              isAllDay: cleanEventData.isAllDay,
              repeat: cleanEventData.repeat,
              start: new Date(e.start.getTime() + startDiff),
              end: new Date(e.end.getTime() + endDiff)
            };
          }
          return e;
        });
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // If converting a non-repeat event to a repeat series
      if (!isRepeatEvent && cleanEventData.repeat && cleanEventData.repeat !== "none") {
        // Remove the original event since it will be included in the series
        const otherEvents = prev.filter((e) => e.id !== eventData.id);
        
        // Generate new series
        const repeatedEvents = generateRepeatedEvents(
          {
            ...cleanEventData,
            id: eventData.id
          },
          cleanEventData.repeat
        );
        
        const updatedEvents = [...otherEvents, ...repeatedEvents];
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      }

      // For non-repeat events or other cases, just update normally
      const updatedEvents = prev.map((event) =>
        event.id === eventData.id ? { ...cleanEventData, id: event.id } : event
      );
      localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
      return updatedEvents;
    });
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
