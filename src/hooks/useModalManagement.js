import { useState, useCallback, useRef, useEffect } from "react";

export function useModalManagement(setEvents, commandBarRef, handleUpdateEvent) {
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

      // For inline edits (drag/resize), update the event directly
      if (!repeatEditModalState.isEditOperation) {
        // Create fresh object with new date instances
        const originalEvent = repeatEditModalState.originalEvent ? {
          ...JSON.parse(JSON.stringify(repeatEditModalState.originalEvent)),
          start: new Date(repeatEditModalState.originalEvent.start.getTime()),
          end: new Date(repeatEditModalState.originalEvent.end.getTime()),
        } : null;
        
        // Calculate time differences for all events in the series
        const startDiff = event.start.getTime() - (originalEvent ? originalEvent.start.getTime() : 0);
        const endDiff = event.end.getTime() - (originalEvent ? originalEvent.end.getTime() : 0);

        // Create a clean event object with the necessary metadata and fresh Date objects
        const eventToUpdate = {
          ...JSON.parse(JSON.stringify(event)), // Deep clone without Date objects
          start: new Date(event.start.getTime()),
          end: new Date(event.end.getTime()),
          _editScope: scope,
          _timeChange: {
            startDiff,
            endDiff
          },
          _seriesUpdate: scope === 'all',
          _originalEvent: originalEvent,
          // Ensure manipulation flag and position metadata are preserved
          _isBeingManipulated: true,
          _exactPosition: {
            start: new Date(event.start.getTime()),
            end: new Date(event.end.getTime())
          }
        };

        console.log('ModalManagement - Updating event:', eventToUpdate);

        // Use the handleUpdateEvent function to ensure consistent state updates
        handleUpdateEvent(eventToUpdate);
      } else {
        // For double-click edits, open the CommandBar
        if (commandBarRef?.current) {
          setTimeout(() => {
            commandBarRef.current.openForEdit({
              ...JSON.parse(JSON.stringify(event)),
              start: new Date(event.start.getTime()),
              end: new Date(event.end.getTime()),
              _editScope: scope,
              _preserveSeriesEvents: true,
              _originalSeriesId: event.seriesId
            });
          }, 10);
        }
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
    [commandBarRef, handleUpdateEvent, repeatEditModalState]
  );

  const handleRepeatEditDiscard = useCallback(() => {
    // If we have an event and original event, revert the changes
    if (repeatEditModalState.event && repeatEditModalState.originalEvent) {
      setEvents((prevEvents) =>
        prevEvents.map((e) =>
          e.id === repeatEditModalState.event.id
            ? {
                ...repeatEditModalState.originalEvent,
                id: e.id,
                repeat: e.repeat,
                seriesId: e.seriesId,
                isRepeat: e.isRepeat,
              }
            : e
        )
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
