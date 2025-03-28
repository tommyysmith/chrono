import { useState, useCallback, useRef } from "react";
import {
  getTimeFromMousePosition,
  getColumnFromMousePosition,
} from "../utils/positionUtils";
import { ViewType } from "../constants/views";

export function useDragAndDrop({
  events,
  setEvents,
  selectedDate,
  viewType,
  currentDate,
  commandBarRef,
  setRepeatEditModalState,
  setClickState,
  colors,
  handleUpdateEvent,
}) {
  const [dragState, setDragState] = useState({
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
  });

  const resizedEventRef = useRef(null);
  const wasResizingRef = useRef(false);
  const originalEventRef = useRef(null);

  const handleDragStart = useCallback(
    (e, event) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't start drag if we're resizing
      if (e.target.closest(".resize-handle")) return;

      const eventElement = e.currentTarget;
      if (!eventElement) return;

      const container = eventElement.closest(".calendar-grid");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      // Create exact copies of the event dates
      const originalEvent = {
        ...event,
        start: new Date(event.start.getTime()),
        end: new Date(event.end.getTime()),
      };

      let hasMoved = false;
      const MIN_DRAG_DISTANCE = 5;
      const startX = e.clientX;
      const startY = e.clientY;

      // Store the original event for potential reversion
      let dragStartOriginalEvent = null;

      // Track the final dragged position
      let finalDraggedEvent = null;

      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        if (!container) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!hasMoved && distance >= MIN_DRAG_DISTANCE) {
          hasMoved = true;
          // Store original event state on first move for potential reversion
          dragStartOriginalEvent = {
            ...event,
            start: new Date(event.start.getTime()),
            end: new Date(event.end.getTime()),
          };
        }

        if (!hasMoved) return;

        const currentTime = getTimeFromMousePosition(
          moveEvent.clientY,
          containerRect,
          currentDate
        );

        // Adjust current time based on column in week view
        let adjustedCurrentTime;
        if (viewType === ViewType.WEEK) {
          const weekStart = new Date(selectedDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const currentColumn = getColumnFromMousePosition(
            moveEvent.clientX,
            containerRect
          );
          adjustedCurrentTime = new Date(weekStart);
          adjustedCurrentTime.setDate(weekStart.getDate() + currentColumn);
          adjustedCurrentTime.setHours(
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate
            ).getHours(),
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate
            ).getMinutes(),
            0,
            0
          );
        } else {
          adjustedCurrentTime = currentTime;
        }

        // Update the event position
        setEvents((prev) =>
          prev.map((e) => {
            if (e.id === event.id) {
              const duration =
                originalEvent.end.getTime() - originalEvent.start.getTime();
              const newStart = adjustedCurrentTime;
              const newEnd = new Date(newStart.getTime() + duration);

              // Store the dragged event details for later use
              finalDraggedEvent = {
                ...e,
                start: new Date(newStart.getTime()),
                end: new Date(newEnd.getTime()),
              };

              return finalDraggedEvent;
            }
            return e;
          })
        );
      };

      const handleUp = () => {
        setTimeout(() => {
          wasResizingRef.current = false;
        }, 0);

        // Handle mouseup for drag operation
        if (hasMoved) {
          // Check if this is a repeated event
          const isRepeatedEvent =
            event.seriesId || (event.repeat && event.repeat !== "none");

          if (isRepeatedEvent && finalDraggedEvent) {
            // For repeated events, show the RepeatEditModal
            setRepeatEditModalState({
              isOpen: true,
              event: {
                ...event,
                start: new Date(event.start.getTime()),
                end: new Date(event.end.getTime()),
              },
              draggedEvent: {
                ...finalDraggedEvent,
                start: new Date(finalDraggedEvent.start.getTime()),
                end: new Date(finalDraggedEvent.end.getTime()),
                // Add flags for the type of operation
                _isDragging: true,
                _isResizing: false,
              },
              originalEvent: {
                ...dragStartOriginalEvent,
                start: new Date(dragStartOriginalEvent.start.getTime()),
                end: new Date(dragStartOriginalEvent.end.getTime()),
                // Also add flags to original event
                _isDragging: true,
                _isResizing: false,
              },
              isEditOperation: false,
            });
          } else if (finalDraggedEvent) {
            // For non-repeated events, update directly with exact position information
            console.log('[useDragAndDrop] Calling handleUpdateEvent for non-repeated DRAG');
            const nonRepeatedTimeChange = {
              startDiff: finalDraggedEvent.start.getTime() - dragStartOriginalEvent.start.getTime(),
              endDiff: finalDraggedEvent.end.getTime() - dragStartOriginalEvent.end.getTime()
            };
            handleUpdateEvent({ 
              ...finalDraggedEvent,
              _editScope: 'single', 
              _timeChange: nonRepeatedTimeChange, 
              _isDragging: true,
              _isResizing: false,
            });
          }
        }

        setDragState({
          isResizing: false,
          eventId: null,
          startTime: null,
          initialHeight: null,
          initialWidth: null,
          edge: null,
        });

        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);

        // Reset click state after drag operation
        setClickState({
          lastClickTime: 0,
          lastClickPosition: null,
          clickCount: 0,
        });
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [
      selectedDate,
      viewType,
      currentDate,
      setEvents,
      setRepeatEditModalState,
      setClickState,
      handleUpdateEvent,
    ]
  );

  const handleCellDragStart = useCallback(
    (e) => {
      // Don't create events if context menu is open or if not left click
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const container = e.currentTarget.closest(".calendar-grid");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Get initial time and day
      let initialTime = getTimeFromMousePosition(
        e.clientY,
        containerRect,
        currentDate
      );
      if (viewType === ViewType.WEEK) {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const initialColumn = getColumnFromMousePosition(
          e.clientX,
          containerRect
        );
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + initialColumn);
        // Transfer the time to the correct day
        initialTime = new Date(dayDate);
        initialTime.setHours(
          getTimeFromMousePosition(
            e.clientY,
            containerRect,
            currentDate
          ).getHours(),
          getTimeFromMousePosition(
            e.clientY,
            containerRect,
            currentDate
          ).getMinutes(),
          0,
          0
        );
      }

      // Track if we've actually started dragging
      let hasDragged = false;
      const MIN_DRAG_DISTANCE = 5;
      const startX = e.clientX;
      const startY = e.clientY;
      let currentEndTime = initialTime; // Start with same time, will be updated during drag

      // Get the last selected color from localStorage or use a random color if none exists
      const getLastSelectedColor = () => {
        if (typeof window !== "undefined") {
          const savedColor = localStorage.getItem("lastSelectedEventColor");
          if (savedColor) return savedColor;
        }
        return colors[Math.floor(Math.random() * colors.length)];
      };

      // Create the event immediately with a unique ID
      const newEventId = crypto.randomUUID();
      const newEvent = {
        id: newEventId,
        title: "New Event",
        start: new Date(initialTime.getTime()),
        end: new Date(initialTime.getTime() + 30 * 60 * 1000), // Start with 30 min duration
        color: getLastSelectedColor(),
        repeat: "none",
      };

      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        if (!container) return;

        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Only create event if we've moved enough
        if (!hasDragged && distance >= MIN_DRAG_DISTANCE) {
          hasDragged = true;
          setEvents((prev) => {
            // Check if there's already an event at this time
            const existingEvent = prev.find(
              (e) =>
                e.start.getTime() === initialTime.getTime() &&
                e.end.getTime() === newEvent.end.getTime()
            );

            // If there's an existing event, don't add a new one
            if (existingEvent) {
              return prev;
            }

            return [...prev, newEvent];
          });
        }

        if (!hasDragged) return;

        // Get current time from mouse position
        let adjustedCurrentTime;
        if (viewType === ViewType.WEEK) {
          const weekStart = new Date(selectedDate);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const currentColumn = getColumnFromMousePosition(
            moveEvent.clientX,
            containerRect
          );
          adjustedCurrentTime = new Date(weekStart);
          adjustedCurrentTime.setDate(weekStart.getDate() + currentColumn);
          adjustedCurrentTime.setHours(
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate
            ).getHours(),
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate
            ).getMinutes(),
            0,
            0
          );
        } else {
          adjustedCurrentTime = getTimeFromMousePosition(
            moveEvent.clientY,
            containerRect,
            currentDate
          );
        }

        currentEndTime = adjustedCurrentTime;

        // Update event with requestAnimationFrame for smooth updates
        requestAnimationFrame(() => {
          setEvents((prev) =>
            prev.map((e) => {
              if (e.id === newEventId) {
                const isReverse = adjustedCurrentTime < initialTime;
                const start = isReverse ? adjustedCurrentTime : initialTime;
                const end = isReverse ? initialTime : adjustedCurrentTime;

                // Ensure minimum 30 minute duration
                const minDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
                const duration = end.getTime() - start.getTime();

                if (duration < minDuration) {
                  if (isReverse) {
                    // If dragging upwards, adjust the start time
                    const newStart = new Date(end.getTime() - minDuration);
                    return { ...e, start: new Date(newStart.getTime()), end };
                  } else {
                    // If dragging downwards, adjust the end time
                    const newEnd = new Date(start.getTime() + minDuration);
                    return { ...e, start, end: new Date(newEnd.getTime()) };
                  }
                }

                return { ...e, start: new Date(start.getTime()), end: new Date(end.getTime()) };
              }
              return e;
            })
          );
        });
      };

      const handleUp = (upEvent) => {
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);

        // Only proceed if we actually dragged
        if (hasDragged) {
          // Get the final times, ensuring they're in the correct order
          const finalStartTime =
            initialTime < currentEndTime ? initialTime : currentEndTime;
          const finalEndTime =
            initialTime < currentEndTime ? currentEndTime : initialTime;

          // Ensure minimum duration of 30 minutes
          const minDuration = 30 * 60 * 1000;
          const duration = finalEndTime.getTime() - finalStartTime.getTime();
          const adjustedEndTime =
            duration < minDuration
              ? new Date(finalStartTime.getTime() + minDuration)
              : finalEndTime;

          // Update the event's final position
          requestAnimationFrame(() => {
            setEvents((prev) =>
              prev.map((e) => {
                if (e.id === newEventId) {
                  return {
                    ...e,
                    start: new Date(finalStartTime.getTime()),
                    end: new Date(adjustedEndTime.getTime()),
                  };
                }
                return e;
              })
            );
          });

          // Open command bar with the dragged times and event ID
          commandBarRef.current?.openWithDragData(
            finalStartTime,
            adjustedEndTime,
            newEventId
          );
        } else {
          // If we didn't drag, remove the event
          setEvents((prev) => prev.filter((e) => e.id !== newEventId));
        }

        // Reset click state after drag operation
        setClickState({
          lastClickTime: 0,
          lastClickPosition: null,
          clickCount: 0,
        });
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [
      selectedDate,
      viewType,
      currentDate,
      colors,
      setEvents,
      commandBarRef,
      setClickState,
    ]
  );

  const handleResizeStart = useCallback(
    (e, eventId, edge) => {
      e.preventDefault();
      e.stopPropagation();

      const event = events.find((e) => e.id === eventId);
      if (!event) return;

      const container = e.currentTarget.closest(".calendar-grid");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();

      // Store the original event for potential reversion
      originalEventRef.current = {
        ...event,
        start: new Date(event.start.getTime()),
        end: new Date(event.end.getTime()),
      };

      // Store the event being resized
      resizedEventRef.current = {
        ...event,
        start: new Date(event.start.getTime()),
        end: new Date(event.end.getTime()),
      };

      setDragState({
        isResizing: true,
        eventId,
        edge,
        startTime: new Date(event.start),
        initialHeight: null,
        initialWidth: null,
      });

      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        if (!container) return;

        // Get the new time while preserving the original day
        const newTimeOnCurrentDay = getTimeFromMousePosition(moveEvent.clientY, containerRect, currentDate);
        const newTime = new Date(event.start);
        newTime.setHours(newTimeOnCurrentDay.getHours());
        newTime.setMinutes(newTimeOnCurrentDay.getMinutes());

        setEvents((prevEvents) =>
          prevEvents.map((e) => {
            if (e.id === eventId) {
              const updatedEvent = { ...e };
              
              if (edge === "top" && newTime < e.end) {
                // Preserve the original day when adjusting start time
                const newStart = new Date(e.start);
                newStart.setHours(newTime.getHours());
                newStart.setMinutes(newTime.getMinutes());
                updatedEvent.start = newStart;
              } else if (edge === "bottom" && newTime > e.start) {
                // Preserve the original day when adjusting end time
                const newEnd = new Date(e.end);
                newEnd.setHours(newTime.getHours());
                newEnd.setMinutes(newTime.getMinutes());
                updatedEvent.end = newEnd;
              }

              // Update our reference to the current state
              resizedEventRef.current = {
                ...updatedEvent,
                start: new Date(updatedEvent.start.getTime()),
                end: new Date(updatedEvent.end.getTime()),
              };

              return updatedEvent;
            }
            return e;
          })
        );
      };

      const handleUp = () => {
        const resizedEvent = resizedEventRef.current;
        const originalEvent = originalEventRef.current;

        if (resizedEvent && originalEvent) {
          const startChanged = resizedEvent.start.getTime() !== originalEvent.start.getTime();
          const endChanged = resizedEvent.end.getTime() !== originalEvent.end.getTime();

          if (startChanged || endChanged) {
            // Check if this is a repeated event
            const isRepeatedEvent = resizedEvent.seriesId || (resizedEvent.repeat && resizedEvent.repeat !== "none");

            if (isRepeatedEvent) {
              // For repeated events, show the RepeatEditModal
              setRepeatEditModalState({
                isOpen: true,
                event: originalEvent,
                draggedEvent: {
                  ...resizedEvent,
                  // Add flags for the type of operation
                  _isDragging: false,
                  _isResizing: true,
                },
                originalEvent: {
                  ...originalEvent,
                  // Also add flags to original event
                  _isDragging: false,
                  _isResizing: true,
                },
                isEditOperation: false,
              });
            } else {
              // For non-repeated events, update directly
              handleUpdateEvent({
                ...resizedEvent,
                _exactPosition: {
                  start: new Date(resizedEvent.start.getTime()),
                  end: new Date(resizedEvent.end.getTime())
                },
                // Add time change information
                _timeChange: {
                  startDiff: resizedEvent.start.getTime() - originalEvent.start.getTime(),
                  endDiff: resizedEvent.end.getTime() - originalEvent.end.getTime()
                },
                // Store the original event data for proper comparison
                _originalEvent: originalEvent,
                // Update all events in the series
                _updateSeries: true,
                // Flag for the type of operation
                _isDragging: false,
                _isResizing: true,
                // Add the preserveRepeat flag to fix error
                _preserveRepeat: true
              });
            }
          }
        }

        // Reset the drag state
        setDragState({
          isResizing: false,
          eventId: null,
          edge: null,
          startTime: null,
          initialHeight: null,
          initialWidth: null,
        });

        // Clear our refs
        resizedEventRef.current = null;
        originalEventRef.current = null;

        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    },
    [events, setEvents, setRepeatEditModalState, handleUpdateEvent, currentDate]
  );

  return {
    dragState,
    setDragState,
    wasResizingRef,
    handleDragStart,
    handleCellDragStart,
    handleResizeStart,
  };
}
