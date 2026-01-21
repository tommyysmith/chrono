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

export function useModalManagement(setEvents, commandBarRef, handleUpdateEvent, handleDeleteSeriesEvents, repeatEditModalState, setRepeatEditModalState, setDragState, deleteModalState, setDeleteModalState, onEventUpdateWithParticipants) {
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
      console.log('[useModalManagement] 🟣 handleRepeatEditConfirm called:', {
        scope,
        eventId: event?.id,
        event_timeChange: event?._timeChange,
        isEditOperation: repeatEditModalState.isEditOperation,
      });
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
        
        // Use the _timeChange from the event (from RepeatEditModal) - this is the source of truth
        const startDiff = event._timeChange?.startDiff || 0;
        const endDiff = event._timeChange?.endDiff || 0;
        
        console.log('[useModalManagement] 🔴 Using timeChange from RepeatEditModal:', {
          startDiff,
          endDiff,
        });

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
          // Preserve the override date key from expanded instances for Notion Calendar-style editing
          _overrideDateKey: event._overrideDateKey || originalEvent?._overrideDateKey,
          // Preserve isRecurring flag for expanded instance detection
          isRecurring: event.isRecurring,
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
          timeChange: eventToUpdate._timeChange,
          isRecurring: eventToUpdate.isRecurring,
          seriesId: eventToUpdate.seriesId,
          _overrideDateKey: eventToUpdate._overrideDateKey,
        });

        // Check if event has other participants - if so, show SendUpdateModal instead of updating directly
        if (event._hasOtherParticipants && onEventUpdateWithParticipants) {
          // Pass to SendUpdateModal for confirmation before updating
          onEventUpdateWithParticipants(eventToUpdate, repeatEditModalState.originalEvent);
        } else {
          // Use the handleUpdateEvent function to ensure consistent state updates
          console.log('[useModalManagement] 🟢 CALLING handleUpdateEvent with _timeChange:', eventToUpdate._timeChange);
          handleUpdateEvent(eventToUpdate);
        }
      } else {
        // For double-click edits (isEditOperation), the user has already made edits in the CommandBar
        // Now we need to apply those edits based on the selected scope
        
        // Build the event to update with the correct scope metadata
        const eventToUpdate = {
          ...JSON.parse(JSON.stringify(event)),
          start: new Date(event.start.getTime()),
          end: new Date(event.end.getTime()),
          _editScope: scope,
          _preserveSeriesEvents: scope !== 'single',
          _originalSeriesId: event.seriesId,
          _futureUpdate: scope === 'future',
          _seriesUpdate: scope === 'all',
          _currentDate: new Date(),
          // Preserve the override date key from expanded instances for Notion Calendar-style editing
          _overrideDateKey: event._overrideDateKey,
          // Preserve isRecurring flag for expanded instance detection
          isRecurring: event.isRecurring,
          // For 'single' scope on instance overrides (not detaching anymore)
          ...(scope === 'single' && {
            _preserveExactPosition: true,
            _exactPosition: {
              start: new Date(event.start.getTime()),
              end: new Date(event.end.getTime())
            }
          })
        };
        
        console.log('[useModalManagement] Applying double-click edit with scope:', scope, 'eventId:', eventToUpdate.id, '_overrideDateKey:', eventToUpdate._overrideDateKey, 'isRecurring:', eventToUpdate.isRecurring, 'seriesId:', eventToUpdate.seriesId);
        
        // Check if event has other participants
        if (event._hasOtherParticipants && onEventUpdateWithParticipants) {
          onEventUpdateWithParticipants(eventToUpdate, repeatEditModalState.originalEvent);
        } else {
          // Apply the update directly
          handleUpdateEvent(eventToUpdate);
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
    [commandBarRef, handleUpdateEvent, repeatEditModalState, setRepeatEditModalState, setDragState, onEventUpdateWithParticipants]
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
    // This handles the case where we immediately updated the event position when the modal opened
    if (repeatEditModalState.event && repeatEditModalState.originalEvent) {
      const originalEvent = repeatEditModalState.originalEvent;
      const eventId = repeatEditModalState.event.id;
      
      setEvents((prevEvents) =>
        prevEvents.map((e) => {
          if (e.id === eventId) {
            return {
              ...e,
              // Revert to original position
              start: new Date(originalEvent.start.getTime()),
              end: new Date(originalEvent.end.getTime()),
              // Clear the pending flag
              _pendingDragConfirmation: undefined,
            };
          }
          return e;
        })
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
