import { useState, useCallback, useRef, useEffect } from "react";

const initialDragState = {
  isDragging: false,
  eventId: null,
  dropPreview: null,
  initialOffset: { x: 0, y: 0 },
  originalEvent: null,
  currentColumn: null,
  isEventCreationOpen: false,
  isResizing: false,
  startTime: null,
  initialHeight: null,
  initialWidth: null,
  edge: null,
};

export function useModalManagement(setEvents, commandBarRef, handleUpdateEvent, handleDeleteSeriesEvents, repeatEditModalState, setRepeatEditModalState, setDragState, deleteModalState, setDeleteModalState) {
  const confirmationHasBeenHandled = useRef(false);

  const [isGoToDateOpen, setIsGoToDateOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const viewDropdownRef = useRef(null);

  const handleDeleteConfirm = useCallback(
    (deleteAll) => {
      const event = deleteModalState.event;
      if (!event) return;

      if (handleDeleteSeriesEvents) {
        // Use the dedicated function for handling series deletion
        handleDeleteSeriesEvents(event, deleteAll ? 'all' : 'single');
      } else {
        // Fallback to the old implementation if handleDeleteSeriesEvents is not provided
        setEvents((prevEvents) => {
          let updatedEvents;

          if (deleteAll) {
            // Delete all events in the series by matching the series ID
            const seriesId = event.seriesId;
            updatedEvents = prevEvents.filter((e) => !e.seriesId || e.seriesId !== seriesId);
          } else {
            // Delete only this specific event instance
            updatedEvents = prevEvents.filter((e) => e.id !== event.id);
          }

          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents.filter(event => !event.isDraft)));
          return updatedEvents;
        });
      }

      setDeleteModalState({
        isOpen: false,
        event: null,
      });
    },
    [deleteModalState, setEvents, handleDeleteSeriesEvents, setDeleteModalState]
  );

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalState({
      isOpen: false,
      event: null,
    });
  }, [setDeleteModalState]);

  const handleRepeatEditConfirm = useCallback(
    ({ scope, event }) => {
      confirmationHasBeenHandled.current = true;
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

        // Get the dragged event with exact position
        const draggedEvent = repeatEditModalState.draggedEvent ? {
          ...JSON.parse(JSON.stringify(repeatEditModalState.draggedEvent)),
          start: new Date(repeatEditModalState.draggedEvent.start.getTime()),
          end: new Date(repeatEditModalState.draggedEvent.end.getTime()),
        } : null;

        // For 'this event' scope, we need to ensure we use the dragged event's exact position
        const isSingleEventEdit = scope === 'single';
        const isDragOrResize = event._isDragging === true || event._isResizing === true;
        
        // Get the correct start and end times based on scope
        let startTime, endTime;
        
        if (draggedEvent && (isDragOrResize || isSingleEventEdit || scope === 'all' || scope === 'future')) {
          // For drag/resize operations, single event edits, OR series updates, always use the dragged event's exact position
          startTime = draggedEvent.start.getTime();
          endTime = draggedEvent.end.getTime();
          console.log('🔥 [PRODUCTION FIX] ModalManagement - Using dragged position for scope:', scope, {
            start: new Date(startTime).toISOString(),
            end: new Date(endTime).toISOString(),
            isDragOrResize,
            isSingleEventEdit,
            isAllScope: scope === 'all'
          });
        } else {
          // For other cases, use the event position from the modal
          startTime = event.start.getTime();
          endTime = event.end.getTime();
          console.log('🔥 [PRODUCTION FIX] ModalManagement - Using modal event position for scope:', scope);
        }

        // Create a clean event object with the necessary metadata and fresh Date objects
        const eventToUpdate = {
          ...JSON.parse(JSON.stringify(event)), // Deep clone without Date objects
          start: new Date(startTime),
          end: new Date(endTime),
          _editScope: scope,
          _timeChange: {
            startDiff,
            endDiff
          },
          _isDragging: event._isDragging === true,
          _isResizing: event._isResizing === true,
          _seriesUpdate: scope === 'all',
          _futureUpdate: scope === 'future',
          _originalEvent: originalEvent,
          _originalSeriesId: originalEvent?.seriesId,
          // Ensure manipulation flag and position metadata are preserved
          _isBeingManipulated: true,
          _exactPosition: {
            start: new Date(draggedEvent ? draggedEvent.start.getTime() : event.start.getTime()),
            end: new Date(draggedEvent ? draggedEvent.end.getTime() : event.end.getTime())
          },
          // Add special flags for 'this event' scope
          ...(isSingleEventEdit && {
            _detachedEvent: true,
            _preserveExactPosition: true
          }),
          // Add current date for future edits
          _currentDate: new Date()
        };

        console.log('�� [MODAL-MANAGEMENT] Received from RepeatEditModal:', {
          eventId: event.id,
          scope,
          eventStart: event.start.toISOString(),
          eventEnd: event.end.toISOString(),
          draggedEventStart: draggedEvent ? draggedEvent.start.toISOString() : 'null',
          draggedEventEnd: draggedEvent ? draggedEvent.end.toISOString() : 'null',
          originalEventStart: originalEvent ? originalEvent.start.toISOString() : 'null',
          originalEventEnd: originalEvent ? originalEvent.end.toISOString() : 'null',
          isDragOrResize,
          isSingleEventEdit
        });

        console.log('🔵 [MODAL-MANAGEMENT] Sending to handleUpdateEvent:', {
          id: eventToUpdate.id,
          scope,
          start: eventToUpdate.start.toISOString(),
          end: eventToUpdate.end.toISOString(),
          isDragging: eventToUpdate._isDragging,
          isResizing: eventToUpdate._isResizing,
          exactPosition: eventToUpdate._exactPosition ? {
            start: eventToUpdate._exactPosition.start.toISOString(),
            end: eventToUpdate._exactPosition.end.toISOString()
          } : null,
          detachedEvent: eventToUpdate._detachedEvent,
          preserveExactPosition: eventToUpdate._preserveExactPosition,
          timeChange: eventToUpdate._timeChange
        });

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
              _originalSeriesId: event.seriesId,
              _futureUpdate: scope === 'future',
              _currentDate: new Date()
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

      if (setDragState) {
        setDragState(initialDragState);
      }
    },
    [commandBarRef, handleUpdateEvent, repeatEditModalState, setRepeatEditModalState, setDragState]
  );

  const handleRepeatEditDiscard = useCallback(() => {
    if (confirmationHasBeenHandled.current) {
      confirmationHasBeenHandled.current = false; // Reset for next interaction
      setRepeatEditModalState({
        isOpen: false,
        event: null,
        draggedEvent: null,
        originalEvent: null,
        isEditOperation: false,
      });
      return;
    }

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

    if (setDragState) {
      setDragState(initialDragState);
    }
  }, [repeatEditModalState, setEvents, setRepeatEditModalState, setDragState]);

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
