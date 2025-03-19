import { useState, useCallback, useRef, useEffect } from "react";

export function useModalManagement(setEvents, commandBarRef) {
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
    ({ scope, event }) => {
      if (!event) {
        setRepeatEditModalState({
          isOpen: false,
          event: null,
          draggedEvent: null,
          originalEvent: null,
          isEditOperation: false,
        });
        return;
      }

      // Open the CommandBar for editing with the event data
      if (commandBarRef?.current) {
        setTimeout(() => {
          commandBarRef.current.openForEdit({
            ...event,
            _editScope: scope,
            _preserveSeriesEvents: true,
            _originalSeriesId: event.seriesId
          });
        }, 10);
      }

      // Close the modal
      setRepeatEditModalState({
        isOpen: false,
        event: null,
        draggedEvent: null,
        originalEvent: null,
        isEditOperation: false,
      });
    },
    [commandBarRef]
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
