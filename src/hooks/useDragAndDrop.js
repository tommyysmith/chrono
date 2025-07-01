import { useState, useEffect, useCallback, useRef } from "react";
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

  // Track current default event color
  const [currentDefaultColor, setCurrentDefaultColor] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem('defaultEventColor') || '#F59E0B';
    }
    return '#F59E0B';
  });

  // Listen for default color changes
  useEffect(() => {
    const handleDefaultColorChange = (event) => {
      setCurrentDefaultColor(event.detail);
    };

    window.addEventListener('default-event-color-updated', handleDefaultColorChange);
    return () => {
      window.removeEventListener('default-event-color-updated', handleDefaultColorChange);
    };
  }, []);

  const resizedEventRef = useRef(null);
  const wasResizingRef = useRef(false);
  const originalEventRef = useRef(null);
  const finalDraggedEventRef = useRef(null);

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

      // Reset the dragged event ref
      finalDraggedEventRef.current = null;

      console.log('[DragDebug] handleDragStart event:', JSON.parse(JSON.stringify(event))); // Log initial event

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
          
          // Production debugging for initial drag
          if (process.env.NODE_ENV === 'production') {
            alert(`DRAG STARTED: ${event.id} at ${event.start.toISOString()}`);
          }
          
          console.log('[DragDebug] handleDragStart dragStartOriginalEvent (set on first move):', JSON.parse(JSON.stringify(dragStartOriginalEvent)));
        }

        if (!hasMoved) return;

        const currentTime = getTimeFromMousePosition(
          moveEvent.clientY,
          containerRect,
          currentDate,
          80
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
              currentDate,
              80
            ).getHours(),
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate,
              80
            ).getMinutes(),
            0,
            0
          );
        } else {
          adjustedCurrentTime = currentTime;
        }
        console.log('[DragDebug] handleMove adjustedCurrentTime:', adjustedCurrentTime);

        // Update the event position
        setEvents((prev) =>
          prev.map((e) => {
            if (e.id === event.id) {
              const duration =
                originalEvent.end.getTime() - originalEvent.start.getTime();

              console.log(`[DragDebug] handleMove Before Constraint: duration=${duration}, adjustedCurrentTime=${adjustedCurrentTime}`);

              // --- Revised Constraint Logic ---
              let finalStartTime = new Date(adjustedCurrentTime.getTime());
              let finalEndTime = new Date(finalStartTime.getTime() + duration);

              const endOfDay = new Date(finalStartTime);
              endOfDay.setHours(23, 59, 59, 999); // End of the day for the start time

              if (finalEndTime > endOfDay) {
                // If the calculated end time exceeds the end of the day,
                // keep the start time derived from mouse position and cap the end time.
                finalEndTime = endOfDay;
              }
              console.log(`[DragDebug] handleMove Final Times: start=${finalStartTime}, end=${finalEndTime}`);
              // --- End Revised Constraint Logic ---

              // Store the constrained dragged event details for later use in handleUp
              const draggedEventUpdate = {
                ...e,
                start: new Date(finalStartTime.getTime()), // Use final start
                end: new Date(finalEndTime.getTime()),   // Use final end
              };
              
              // Store in ref for reliable access in handleUp
              finalDraggedEventRef.current = {
                ...draggedEventUpdate,
                start: new Date(draggedEventUpdate.start.getTime()),
                end: new Date(draggedEventUpdate.end.getTime()),
              };
              
              console.log('[DragDebug] handleMove finalDraggedEvent (stored in ref):', JSON.parse(JSON.stringify(finalDraggedEventRef.current)));

              return draggedEventUpdate; // Update the preview
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
          
          // Get the final dragged event from ref
          const finalDraggedEvent = finalDraggedEventRef.current;
          
          // Use alert for production debugging - this won't be stripped
          if (process.env.NODE_ENV === 'production') {
            alert(`DRAG DEBUG: ${finalDraggedEvent ? `Found dragged event: ${finalDraggedEvent.start.toISOString()} -> ${finalDraggedEvent.end.toISOString()}` : 'NO DRAGGED EVENT FOUND!'}`);
          }
          console.log('[DragDebug] handleUp - Using finalDraggedEvent from ref:', finalDraggedEvent ? {
            id: finalDraggedEvent.id,
            start: finalDraggedEvent.start.toISOString(),
            end: finalDraggedEvent.end.toISOString()
          } : 'null');

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
            // *** THE FIX ***
            // Return here to prevent the code below from running and reverting the state
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
            return;
          } else if (finalDraggedEvent) {
            // For non-repeated events, update directly with exact position information
            console.log('[useDragAndDrop] Calling handleUpdateEvent for non-repeated DRAG');
            const nonRepeatedTimeChange = {
              startDiff: finalDraggedEvent.start.getTime() - dragStartOriginalEvent.start.getTime(),
              endDiff: finalDraggedEvent.end.getTime() - dragStartOriginalEvent.end.getTime()
            };
            
            // Task block drag operations are now handled by @dnd-kit in Calendar.jsx
            // This manual drag logic is only for regular events
            
            // Add timestamp for recent drag tracking
            const eventWithTimestamp = {
              ...finalDraggedEvent,
              lastDragTime: Date.now(),
              _editScope: 'single', 
              _timeChange: nonRepeatedTimeChange, 
              _isDragging: false, // Drag is complete
              _isResizing: false,
            };
            
            // Update the event in state first
            setEvents(prev => prev.map(e => 
              e.id === finalDraggedEvent.id ? eventWithTimestamp : e
            ));
            
            handleUpdateEvent(eventWithTimestamp);
          }
        }

        // Clean up the ref
        finalDraggedEventRef.current = null;

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
        currentDate,
        80
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
            currentDate,
            80
          ).getHours(),
          getTimeFromMousePosition(
            e.clientY,
            containerRect,
            currentDate,
            80
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

      // Get the default event color from current state
      const getDefaultEventColor = () => {
        return currentDefaultColor;
      };

      // Get the last selected color from localStorage or use default color if none exists
      const getLastSelectedColor = () => {
        // Always use the current default color for drag-to-create events
        // This ensures consistency with the user's current settings
        return currentDefaultColor;
      };

      // Create a draft event immediately with a unique ID
      const newEventId = crypto.randomUUID();
      // Get default duration from localStorage (default to 60 minutes)
      const defaultDuration = parseInt(localStorage.getItem('defaultEventDuration') || '60');
      const newEvent = {
        id: newEventId,
        title: "",
        start: new Date(initialTime.getTime()),
        end: new Date(initialTime.getTime() + defaultDuration * 60 * 1000), // Use default duration
        color: getLastSelectedColor(),
        repeat: "none",
        isDraft: true, // Mark as draft event
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
              currentDate,
              80
            ).getHours(),
            getTimeFromMousePosition(
              moveEvent.clientY,
              containerRect,
              currentDate,
              80
            ).getMinutes(),
            0,
            0
          );
        } else {
          adjustedCurrentTime = getTimeFromMousePosition(
            moveEvent.clientY,
            containerRect,
            currentDate,
            80
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

                // Ensure minimum 15 minute duration
                const minDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
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

          // Ensure minimum duration of 15 minutes
          const minDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
          const duration = finalEndTime.getTime() - finalStartTime.getTime();
          let adjustedEndTime =
            duration < minDuration
              ? new Date(finalStartTime.getTime() + minDuration)
              : finalEndTime;

          // Cap end time at 23:59:59 of the start day
          const endOfDay = new Date(finalStartTime);
          endOfDay.setHours(23, 59, 59, 999);
          if (adjustedEndTime > endOfDay) {
            adjustedEndTime = endOfDay;
          }

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
      currentDefaultColor,
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
        const newTimeOnCurrentDay = getTimeFromMousePosition(moveEvent.clientY, containerRect, currentDate, 80);
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
              // *** THE FIX ***
              // Return here to prevent the code below from running and reverting the state
              window.removeEventListener("pointermove", handleMove);
              window.removeEventListener("pointerup", handleUp);
              return;
            } else {
                              // Check if this is a task block and update the original task
                if (resizedEvent.isTaskBlock && resizedEvent.originalTask) {
                  const handleTaskUpdate = (updatedTask) => {
                    // Update task in localStorage
                    const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
                    
                    // Update in all collections
                    Object.keys(tasks).forEach(groupKey => {
                      if (Array.isArray(tasks[groupKey])) {
                        tasks[groupKey] = tasks[groupKey].map(t => 
                          t.id === updatedTask.id ? updatedTask : t
                        );
                      }
                    });
                    
                    // Save back to localStorage
                    localStorage.setItem('tasks', JSON.stringify(tasks));
                    
                    // Dispatch events for UI updates - ensure both event types are dispatched
                    window.dispatchEvent(new CustomEvent('tasks-updated', { detail: tasks }));
                    window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { tasks } }));
                    window.dispatchEvent(new StorageEvent('storage', {
                      key: 'tasks',
                      newValue: JSON.stringify(tasks),
                      url: window.location.href
                    }));
                  };
                  
                  // Update the original task with new scheduled date and duration
                  const durationMinutes = Math.round((resizedEvent.end.getTime() - resizedEvent.start.getTime()) / (1000 * 60));
                  const updatedTask = {
                    ...resizedEvent.originalTask,
                    scheduledDate: resizedEvent.start.toISOString(),
                    duration: durationMinutes, // Update duration on resize
                    addToCalendar: true,
                    updatedAt: new Date().toISOString()
                  };
                  
                  // Handle recurring tasks
                  if (updatedTask.isRepeat === true && updatedTask.seriesId) {
                    updatedTask._editScope = 'single';
                  }
                  
                  handleTaskUpdate(updatedTask);
                }
              
              // For non-repeated events, update directly
              const eventWithTimestamp = {
                ...resizedEvent,
                lastDragTime: Date.now(), // Add timestamp for recent resize tracking
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
                _isResizing: false, // Resize is complete
                // Add the preserveRepeat flag to fix error
                _preserveRepeat: true
              };
              
              // Update the event in state first
              setEvents(prev => prev.map(e => 
                e.id === resizedEvent.id ? eventWithTimestamp : e
              ));
              
              handleUpdateEvent(eventWithTimestamp);
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

        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
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
