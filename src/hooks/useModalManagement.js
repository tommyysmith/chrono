import { useState, useCallback, useRef, useEffect } from "react";

export function useModalManagement(setEvents) {
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    event: null,
  });

  const [repeatEditModalState, setRepeatEditModalState] = useState({
    isOpen: false,
    event: null,
    draggedEvent: null,
    originalEvent: null,
    isEditOperation: false,
  });

  const [isGoToDateOpen, setIsGoToDateOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef(null);

  const handleDeleteConfirm = useCallback(
    (deleteAll) => {
      const event = deleteModalState.event;
      if (!event) return;

      setEvents((prevEvents) => {
        let updatedEvents;

        if (deleteAll) {
          // Delete all events in the series by matching both the base event ID and repeat pattern
          const seriesId = event.seriesId;
          updatedEvents = prevEvents.filter((e) => {
            // Keep events that either:
            // 1. Don't share the same base ID, or
            // 2. Have the same base ID but different repeat pattern (different series)
            return !e.seriesId || e.seriesId !== seriesId;
          });
        } else {
          // Delete only this specific event instance
          updatedEvents = prevEvents.filter((e) => e.id !== event.id);
        }

        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      });

      setDeleteModalState({
        isOpen: false,
        event: null,
      });
    },
    [deleteModalState, setEvents]
  );

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalState({
      isOpen: false,
      event: null,
    });
  }, []);

  const handleRepeatEditConfirm = useCallback(
    (editScope) => {
      const { event, draggedEvent, originalEvent } = repeatEditModalState;

      if (!event || !draggedEvent || !originalEvent) {
        setRepeatEditModalState({
          isOpen: false,
          event: null,
          draggedEvent: null,
          originalEvent: null,
          isEditOperation: false,
        });
        return;
      }

      // Calculate the time difference for the drag
      const startDiff =
        draggedEvent.start.getTime() - originalEvent.start.getTime();
      const endDiff = draggedEvent.end.getTime() - originalEvent.end.getTime();

      // Store the target event outside of setEvents to avoid closure issues
      let editTargetEvent = null;

      // Update events based on the selected scope
      setEvents((prev) => {
        let updatedEvents = [...prev];

        if (editScope === "single") {
          // Only update this specific event instance and detach it from the series
          updatedEvents = prev.map((event) => {
            if (event.id === draggedEvent.id) {
              editTargetEvent = {
                ...draggedEvent,
                seriesId: null, // Remove from series
                repeat: "none", // No longer repeating
                isRepeat: false,
                _preserveSeriesEvents: true, // Add flag to preserve other events
              };
              return editTargetEvent;
            }
            return event;
          });
        } else if (editScope === "future") {
          // Update this event and all future events in the series
          updatedEvents = prev.map((e) => {
            if (
              e.seriesId === event.seriesId &&
              e.start >= originalEvent.start
            ) {
              // For the dragged event itself, keep it as is without applying the shift again
              if (e.id === event.id) {
                editTargetEvent = {
                  ...draggedEvent,
                  seriesId: event.seriesId,
                  repeat: event.repeat,
                  isRepeat: true,
                };
                return editTargetEvent;
              }

              // For other events in the series, apply the time shift
              const newStart = new Date(e.start.getTime() + startDiff);
              const newEnd = new Date(e.end.getTime() + endDiff);

              return {
                ...e,
                start: newStart,
                end: newEnd,
              };
            }
            return e;
          });
        } else {
          // Update all events in the series
          updatedEvents = prev.map((e) => {
            if (e.seriesId === event.seriesId) {
              // For the dragged event itself, keep it as is without applying the shift again
              if (e.id === event.id) {
                editTargetEvent = {
                  ...draggedEvent,
                  seriesId: event.seriesId,
                  repeat: event.repeat,
                  isRepeat: true,
                };
                return editTargetEvent;
              }

              // For other events in the series, apply the time shift
              const newStart = new Date(e.start.getTime() + startDiff);
              const newEnd = new Date(e.end.getTime() + endDiff);

              return {
                ...e,
                start: newStart,
                end: newEnd,
              };
            }
            return e;
          });
        }

        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      });

      // Close the modal
      setRepeatEditModalState({
        isOpen: false,
        event: null,
        draggedEvent: null,
        originalEvent: null,
        isEditOperation: false,
      });
    },
    [repeatEditModalState, setEvents]
  );

  const handleRepeatEditDiscard = useCallback(() => {
    const { originalEvent } = repeatEditModalState;

    // Revert the event to its original state
    if (originalEvent) {
      setEvents((prev) =>
        prev.map((e) => (e.id === originalEvent.id ? { ...originalEvent } : e))
      );
    }

    // Close the modal
    setRepeatEditModalState({
      isOpen: false,
      event: null,
      draggedEvent: null,
      originalEvent: null,
      isEditOperation: false,
    });
  }, [repeatEditModalState, setEvents]);

  // Click outside handler for view dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isViewDropdownOpen &&
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(event.target)
      ) {
        setIsViewDropdownOpen(false);
      }
    };

    if (isViewDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  return {
    deleteModalState,
    setDeleteModalState,
    repeatEditModalState,
    setRepeatEditModalState,
    isGoToDateOpen,
    setIsGoToDateOpen,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    viewDropdownRef,
    handleDeleteConfirm,
    handleDeleteModalClose,
    handleRepeatEditConfirm,
    handleRepeatEditDiscard,
  };
}
