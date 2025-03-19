import { useState, useCallback } from "react";

export function useCalendarInteractions(commandBarRef, setRepeatEditModalState) {
  const [clickState, setClickState] = useState({
    lastClickTime: 0,
    lastClickPosition: null,
    clickCount: 0,
  });

  const [pendingEventCell, setPendingEventCell] = useState(null);

  const handleCellClick = useCallback(
    (e, date) => {
      e.preventDefault();

      // Get current time
      const now = new Date();

      // Check if this is a double click
      const isDoubleClick = now - clickState.lastClickTime < 300;

      if (isDoubleClick) {
        // Open command bar for event creation at the clicked time
        if (commandBarRef.current) {
          const clickedTime = new Date(date);
          const endTime = new Date(clickedTime.getTime() + 60 * 60 * 1000); // 1 hour later
          commandBarRef.current.openWithDragData(clickedTime, endTime);
        }

        // Reset click state
        setClickState({
          lastClickTime: 0,
          lastClickPosition: null,
          clickCount: 0,
        });
      } else {
        // Update click state for potential double click
        setClickState({
          lastClickTime: now,
          lastClickPosition: { x: e.clientX, y: e.clientY },
          clickCount: clickState.clickCount + 1,
        });
      }
    },
    [clickState, commandBarRef]
  );

  const handleEventClick = useCallback(
    (event) => {
      // Check if this is a repeat event that needs to show the RepeatEditModal first
      if ((event.seriesId || (event.repeat && event.repeat !== 'none')) && setRepeatEditModalState) {
        // For repeat events, show the RepeatEditModal first
        setRepeatEditModalState({
          isOpen: true,
          event: event,
          draggedEvent: event, // Use the event as both original and dragged
          originalEvent: event,
          isEditOperation: true, // Flag as an edit operation, not a drag/resize
        });
      } else {
        // For non-repeat events, open the CommandBar directly
        if (commandBarRef.current) {
          commandBarRef.current.openForEdit(event);
        }
      }
    },
    [commandBarRef, setRepeatEditModalState]
  );

  const handleCommandBarClose = useCallback(() => {
    // Reset pending event cell when command bar closes
    setPendingEventCell(null);
  }, []);

  return {
    clickState,
    setClickState,
    pendingEventCell, //only used by Week and Day views
    setPendingEventCell, //only used by Week and Day views
    handleCellClick, //only used by Week and Day views
    handleEventClick, // used in render Event functions and week, day month
    handleCommandBarClose, // only passed down as onclose event for commandBar
  };
}
