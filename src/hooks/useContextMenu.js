import { useState, useCallback, useRef } from "react";

export function useContextMenu(
  events,
  setEvents,
  handleDeleteEvent,
  setDeleteModalState,
  commandBarRef,
  setRepeatEditModalState
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

      // --- NEW LOGGING ---
      console.log(' [useContextMenu.handleEventDelete] Attempting delete for eventId:', contextMenu.eventId);
      console.log(' [useContextMenu.handleEventDelete] Searching within events:', events.map(e => ({ id: e.id, title: e.title, start: e.start, repeat: e.repeat, seriesId: e.seriesId })));
      // --- END NEW LOGGING ---

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
          rruleOptions: null, // Ensure rruleOptions are cleared for a duplicated single instance
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

  const handleEventEdit = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!contextMenu.eventId || !commandBarRef || !commandBarRef.current) return;

      const eventToEdit = events.find(
        (event) => event.id === contextMenu.eventId
      );

      if (eventToEdit) {
        let openRepeatModal = false;
        let actualOriginalEvent = eventToEdit; // Default to the event itself

        // Check if it's an instance of a recurring series
        if (eventToEdit.seriesId) {
          const rootEventCandidate = events.find(e => e.id === eventToEdit.seriesId);
          if (rootEventCandidate) {
            actualOriginalEvent = rootEventCandidate; // Found the root/master event
          } else {
            // This case should ideally not happen if data is consistent.
            // If the root event isn't found, actualOriginalEvent remains eventToEdit.
            // The RepeatEditModal might not behave as expected for series edits.
            console.warn(`Original series event with id "${eventToEdit.seriesId}" not found for instance "${eventToEdit.id}".`);
          }
          openRepeatModal = true;
        } 
        // Else, check if it's a root event that itself defines a recurrence rule
        else if (eventToEdit.rruleOptions) { 
          // actualOriginalEvent is already eventToEdit, which is correct here
          openRepeatModal = true;
        }

        if (openRepeatModal) {
          setRepeatEditModalState({
            isOpen: true,
            event: eventToEdit,                 // The specific event instance that was clicked
            originalEvent: actualOriginalEvent, // The root definition of the series
            draggedEvent: eventToEdit,          // Set to the event being edited
            isEditOperation: true,
          });
        } else {
          // It's a non-recurring event
          commandBarRef.current.openForEdit(eventToEdit);
        }
      }
      setContextMenu({ show: false, eventId: null, x: 0, y: 0 });
    },
    [contextMenu.eventId, events, commandBarRef, setRepeatEditModalState, setContextMenu]
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
    handleEventEdit,
  };
}
