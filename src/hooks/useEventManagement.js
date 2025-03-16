import { useState, useCallback, useEffect } from "react";
import { generateRepeatedEvents, generateEventId } from "../utils/eventUtils";

export function useEventManagement(commandBarRef) {
  const [events, setEvents] = useState([]);

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
      const newEvent = {
        ...eventData,
        id: generateEventId(),
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

    // Remove internal properties that shouldn't be stored
    const preserveSeriesEvents = eventData._preserveSeriesEvents;
    delete cleanEventData._editScope;
    delete cleanEventData._repeatChanged;
    delete cleanEventData._timeChange;
    delete cleanEventData._originalSeriesId;
    delete cleanEventData._preserveSeriesEvents;

    setEvents((prev) => {
      // Find the existing event to determine if it's part of a series
      const existingEvent = prev.find((e) => e.id === eventData.id);

      // If converting from repeat to non-repeat
      if (
        existingEvent?.seriesId &&
        (!eventData.repeat || eventData.repeat === "none")
      ) {
        // This condition might be removing all series events!
        // If preserve flag is set, only update this event and don't remove others
        if (preserveSeriesEvents || eventData._editScope === "single") {
          // Update only this event without affecting others
          const newEvents = prev.map((event) => {
            if (event.id === existingEvent.id) {
              return {
                ...eventData,
                id: existingEvent.id,
                seriesId: null,
                repeat: "none",
                isRepeat: false,
              };
            }
            return event;
          });

          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        } else {
          // Original behavior - Keep only this event and remove the series
          const otherEvents = prev.filter(
            (e) => e.seriesId !== existingEvent.seriesId
          );
          const singleEvent = {
            ...eventData,
            id: existingEvent.id,
            seriesId: null,
            repeat: "none",
            isRepeat: false,
          };
          const newEvents = [...otherEvents, singleEvent];
          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }
      }

      // If updating a series event
      if (existingEvent?.seriesId) {
        // If editing only this event, detach it from the series while preserving other events
        if (editScope === "single") {
          const updatedEvent = {
            ...cleanEventData,
            id: existingEvent.id,
            seriesId: null, // Detach from series
            repeat: "none", // No longer repeating
            isRepeat: false,
            _preserveSeriesEvents: true, // Add flag to preserve other events
          };

          // Simply update this event while keeping all others unchanged
          const newEvents = prev.map((event) =>
            event.id === existingEvent.id ? updatedEvent : event
          );

          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }

        // If the repeat option changed (indicated by _repeatChanged flag)
        // or if the event is changing from one repeat type to another
        if (
          eventData._repeatChanged ||
          (existingEvent.repeat !== eventData.repeat &&
            eventData.repeat !== "none")
        ) {
          // Remove all events in the current series
          const otherEvents = prev.filter(
            (e) => e.seriesId !== existingEvent.seriesId
          );

          // Generate a new series with the updated repeat option
          const repeatedEvents = generateRepeatedEvents(
            {
              ...eventData,
              id: existingEvent.id, // Keep the original ID for the first event
            },
            eventData.repeat
          );

          const newEvents = [...otherEvents, ...repeatedEvents];
          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }

        // Handle future-only edits specifically
        if (editScope === "future") {
          // Get the current event's start time as the cutoff point
          const cutoffDate = new Date(existingEvent.start);

          // Calculate time differences if provided
          let startDiff = 0;
          let endDiff = 0;

          if (eventData._timeChange) {
            startDiff = eventData._timeChange.startDiff;
            endDiff = eventData._timeChange.endDiff;
          } else {
            startDiff = eventData.start - existingEvent.start;
            endDiff = eventData.end - existingEvent.end;
          }

          // Update only this and future events
          return prev.map((e) => {
            // If this event is part of the same series
            if (e.seriesId === existingEvent.seriesId) {
              // Only update events on or after the cutoff date
              if (e.start >= cutoffDate) {
                // If this is the specific event being edited
                if (e.id === existingEvent.id) {
                  return {
                    ...cleanEventData,
                    id: e.id,
                    seriesId: existingEvent.seriesId,
                    isRepeat: true,
                    _lastUpdated: new Date().getTime(), // Add timestamp to track updates
                  };
                }

                // For other future events, apply the same properties and time shift
                const newStart = new Date(e.start.getTime() + startDiff);
                const newEnd = new Date(e.end.getTime() + endDiff);

                return {
                  ...e,
                  title: eventData.title,
                  description: eventData.description,
                  color: eventData.color,
                  isAllDay: eventData.isAllDay,
                  repeat: eventData.repeat,
                  start: newStart,
                  end: newEnd,
                  _lastUpdated: new Date().getTime(),
                };
              }
            }
            // Keep all other events unchanged
            return e;
          });
        }

        // Calculate the time difference if start/end times changed
        const startDiff = eventData.start - existingEvent.start;
        const endDiff = eventData.end - existingEvent.end;
        const timeChanged = startDiff !== 0 || endDiff !== 0;

        return prev.map((event) => {
          if (event.seriesId === existingEvent.seriesId) {
            const updatedEvent = {
              ...event,
              title: eventData.title,
              description: eventData.description,
              color: eventData.color,
              isAllDay: eventData.isAllDay,
              repeat: eventData.repeat,
            };

            // If time changed, adjust all events in the series by the same amount
            if (timeChanged) {
              updatedEvent.start = new Date(event.start.getTime() + startDiff);
              updatedEvent.end = new Date(event.end.getTime() + endDiff);
            }

            return updatedEvent;
          }
          return event;
        });
      }

      // If converting a single event to a repeat series
      if (
        !existingEvent?.seriesId &&
        eventData.repeat &&
        eventData.repeat !== "none"
      ) {
        // Remove the original event since it will be included in the series
        const otherEvents = prev.filter((e) => e.id !== eventData.id);

        // Generate the series events, keeping the original event's ID for the first one
        const repeatedEvents = generateRepeatedEvents(
          {
            ...eventData,
            id: eventData.id, // This ensures the first event keeps its ID
          },
          eventData.repeat
        );

        const newEvents = [...otherEvents, ...repeatedEvents];
        localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
        return newEvents;
      }

      // Otherwise, update a single event
      const updatedEvents = prev.map((event) => {
        if (event.id === eventData.id) {
          return {
            ...event,
            ...cleanEventData,
            id: event.id, // Preserve the original ID
            _lastUpdated: new Date().getTime(), // Add timestamp to track updates
          };
        }
        return event;
      });
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
  };
}
