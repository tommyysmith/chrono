import { useState, useCallback, useRef } from "react";

export function useContextMenu(
  events,
  setEvents,
  handleDeleteEvent,
  setDeleteModalState
) {
  const [contextMenu, setContextMenu] = useState({
    show: false,
    eventId: null,
    x: 0,
    y: 0,
  });

  const contextMenuRef = useRef(null);

  const handleEventContextMenu = useCallback((e, eventId) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      show: true,
      eventId,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  const handleColorSelect = useCallback(
    (e, color) => {
      e.preventDefault();
      e.stopPropagation();

      // Store the selected color in localStorage for future events
      localStorage.setItem("lastSelectedEventColor", color);

      // Update the event with the new color
      if (contextMenu.eventId) {
        setEvents((prev) => {
          const updatedEvents = prev.map((event) => {
            if (event.id === contextMenu.eventId) {
              return { ...event, color };
            }
            return event;
          });
          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
          return updatedEvents;
        });
      }

      // Close the context menu
      setContextMenu({ show: false, eventId: null, x: 0, y: 0 });
    },
    [contextMenu.eventId, setEvents]
  );

  const handleEventDelete = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find the event to delete
      const eventToDelete = events.find(
        (event) => event.id === contextMenu.eventId
      );
      if (eventToDelete) {
        handleDeleteEvent(eventToDelete, setDeleteModalState);
      }

      // Close the context menu
      setContextMenu({ show: false, eventId: null, x: 0, y: 0 });
    },
    [contextMenu.eventId, events, handleDeleteEvent, setDeleteModalState]
  );

  const handleEventDuplicate = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Find the event to duplicate
      const eventToDuplicate = events.find(
        (event) => event.id === contextMenu.eventId
      );

      if (eventToDuplicate) {
        // Create a new event with the same properties but a new ID
        const newEvent = {
          ...eventToDuplicate,
          id: crypto.randomUUID(),
          start: new Date(eventToDuplicate.start.getTime()),
          end: new Date(eventToDuplicate.end.getTime()),
          seriesId: null, // Duplicated event is not part of a series
          isRepeat: false,
          repeat: "none",
        };

        // Add the new event to the events array
        setEvents((prev) => {
          const newEvents = [...prev, newEvent];
          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        });
      }

      // Close the context menu
      setContextMenu({ show: false, eventId: null, x: 0, y: 0 });
    },
    [contextMenu.eventId, events, setEvents]
  );

  // We don't need a click outside handler anymore as the popover handles this automatically

  return {
    contextMenu,
    setContextMenu,
    contextMenuRef,
    handleEventContextMenu,
    handleColorSelect,
    handleEventDelete,
    handleEventDuplicate,
  };
}
