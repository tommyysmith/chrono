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

  const wasResizingRef = useRef(false);

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
                start: newStart,
                end: newEnd,
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
              event: event,
              draggedEvent: finalDraggedEvent,
              originalEvent: dragStartOriginalEvent,
              isEditOperation: false,
            });
          } else if (finalDraggedEvent) {
            // For non-repeated events, update directly
            handleUpdateEvent(finalDraggedEvent);
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
        start: initialTime,
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
                    return { ...e, start: newStart, end };
                  } else {
                    // If dragging downwards, adjust the end time
                    const newEnd = new Date(start.getTime() + minDuration);
                    return { ...e, start, end: newEnd };
                  }
                }

                return { ...e, start, end };
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
                    start: finalStartTime,
                    end: adjustedEndTime,
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

      const eventElement = e.currentTarget.closest(".event-item");
      if (!eventElement) return;

      const event = events.find((ev) => ev.id === eventId);
      if (!event) return;

      const container = eventElement.closest(".calendar-grid");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const hourHeight = 64;
      const timeColumnWidth = 60;
      const availableWidth = containerRect.width - timeColumnWidth;
      const dayWidth = availableWidth / 7;

      // Store original event with deep copied dates to preserve original state
      const originalEvent = {
        ...event,
        start: new Date(event.start.getTime()),
        end: new Date(event.end.getTime()),
      };

      // Reference for tracking the latest state of the event during resize
      const resizedEventRef = {
        current: { ...originalEvent },
      };

      setDragState({
        isResizing: true,
        eventId: eventId,
        startTime: ["left", "top"].includes(edge) ? event.end : event.start,
        initialHeight: eventElement.offsetHeight,
        initialWidth: eventElement.offsetWidth,
        edge,
        originalEvent: originalEvent,
      });

      const getTimeFromY = (y) => {
        const scrollTop = container.scrollTop;
        const relativeY = y - containerRect.top + scrollTop;
        const totalMinutes = (relativeY / hourHeight) * 60;
        const roundedMinutes = Math.round(totalMinutes / 15) * 15;

        const hours = Math.floor(roundedMinutes / 60);
        const minutes = roundedMinutes % 60;

        // Create new date while preserving the original date
        const time =
          edge === "top" ? new Date(event.start) : new Date(event.end);
        time.setHours(hours);
        time.setMinutes(minutes);
        time.setSeconds(0);
        time.setMilliseconds(0);
        return time;
      };

      const getDayFromX = (x) => {
        const relativeX = x - containerRect.left - timeColumnWidth;
        const dayIndex = Math.floor(relativeX / dayWidth);

        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        const newDate = new Date(weekStart);
        newDate.setDate(weekStart.getDate() + dayIndex);

        // Preserve the original time
        const originalTime = edge === "left" ? event.end : event.start;
        newDate.setHours(
          originalTime.getHours(),
          originalTime.getMinutes(),
          0,
          0
        );

        return newDate;
      };

      const handleMove = (moveEvent) => {
        moveEvent.preventDefault();
        if (!container) return;

        let newTime;
        if (edge === "left" || edge === "right") {
          newTime = getDayFromX(moveEvent.clientX);
        } else {
          newTime = getTimeFromY(moveEvent.clientY);
        }

        setEvents((prevEvents) => {
          const updatedEvents = prevEvents.map((e) => {
            if (e.id === eventId) {
              const newEvent = { ...e };
              if (edge === "bottom") {
                if (newTime > e.start) {
                  // Preserve the date of the end time, only update hours and minutes
                  const updatedEnd = new Date(e.end);
                  updatedEnd.setHours(
                    newTime.getHours(),
                    newTime.getMinutes(),
                    0,
                    0
                  );
                  newEvent.end = updatedEnd;
                }
              } else if (edge === "top") {
                if (newTime < e.end) {
                  // Preserve the date of the start time, only update hours and minutes
                  const updatedStart = new Date(e.start);
                  updatedStart.setHours(
                    newTime.getHours(),
                    newTime.getMinutes(),
                    0,
                    0
                  );
                  newEvent.start = updatedStart;
                }
              } else if (edge === "right") {
                const endOfDay = new Date(newTime);
                endOfDay.setHours(e.end.getHours(), e.end.getMinutes(), 0, 0);
                if (endOfDay >= e.start) {
                  newEvent.end = endOfDay;
                }
              } else if (edge === "left") {
                const startOfDay = new Date(newTime);
                startOfDay.setHours(
                  e.start.getHours(),
                  e.start.getMinutes(),
                  0,
                  0
                );
                if (startOfDay <= e.end) {
                  newEvent.start = startOfDay;
                }
              }

              // Update our resizedEventRef with the latest state
              resizedEventRef.current = {
                ...newEvent,
                start: new Date(newEvent.start.getTime()),
                end: new Date(newEvent.end.getTime()),
              };

              return newEvent;
            }
            return e;
          });

          return updatedEvents;
        });
      };

      const handleUp = () => {
        setTimeout(() => {
          wasResizingRef.current = false;
        }, 0);

        // Use our tracked resized event from the reference
        const resizedEvent = resizedEventRef.current;

        // Check if this is a repeating event
        if (resizedEvent && (resizedEvent.repeat || resizedEvent.seriesId)) {
          const isRepeatingEvent =
            resizedEvent.repeat !== "none" || resizedEvent.seriesId;

          if (isRepeatingEvent) {
            // Create deep copies to ensure we don't have reference issues
            const draggedEvent = {
              ...resizedEvent,
              start: new Date(resizedEvent.start.getTime()),
              end: new Date(resizedEvent.end.getTime()),
            };

            // Only open the modal if the times actually changed
            const startChanged =
              originalEvent.start.getTime() !== draggedEvent.start.getTime();
            const endChanged =
              originalEvent.end.getTime() !== draggedEvent.end.getTime();

            if (startChanged || endChanged) {
              // Open the RepeatEditModal with the original and resized event
              setRepeatEditModalState({
                isOpen: true,
                event: draggedEvent,
                draggedEvent: draggedEvent,
                originalEvent: originalEvent,
                isEditOperation: false,
              });
            }
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
    [events, selectedDate, setEvents, setRepeatEditModalState, setClickState]
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
