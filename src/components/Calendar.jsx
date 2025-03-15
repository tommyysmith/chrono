"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { format, addDays, isSameDay } from "date-fns";
import { motion } from "framer-motion";
import Sidebar from "./Sidebar";
import DeleteEventModal from "./DeleteEventModal";
import RepeatEditModal from "./RepeatEditModal";
import CommandBar from "./CommandBar";
import GoToDateCommand from "./GoToDateCommand";
import Day from "./views/Day";
import Week from "./views/Week";
import Month from "./views/Month";
import {
  generateRepeatedEvents,
  generateEventId,
  findOverlappingGroup,
  getEventStyle,
} from "../utils/eventUtils";
import {
  handlePrevious,
  handleNext,
  handleToday,
} from "@/hooks/navHandlers.js";

import {
  getTimeFromMousePosition,
  getColumnFromMousePosition,
} from "@/utils/positionUtils.js";
import { TAG_COLORS } from "../constants/colors";
import { Repeat } from "@/assets/icons/Repeat";
import { Trash } from "@/assets/icons/Trash";
import { Copy } from "@/assets/icons/Copy";

// import {

// }

const ViewType = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
};

export default function Calendar({ selectedDate = new Date(), onDateSelect }) {
  const [viewType, setViewType] = useState(ViewType.WEEK);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [events, setEvents] = useState([]);
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
  const [dragState, setDragState] = useState({
    isDragging: false,
    eventId: null,
    dropPreview: null,
    initialOffset: { x: 0, y: 0 },
    originalEvent: null,
    currentColumn: null,
    isEventCreationOpen: false,
  });
  const [contextMenu, setContextMenu] = useState({
    show: false,
    x: 0,
    y: 0,
    eventId: null,
  });
  const [isGoToDateOpen, setIsGoToDateOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const colors = TAG_COLORS;
  const commandBarRef = useRef(null);
  const timeGridRef = useRef(null);
  const contextMenuRef = useRef(null);
  const wasResizingRef = useRef(false);
  const viewDropdownRef = useRef(null);

  // Sync with selectedDate prop
  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Load events from localStorage when component mounts
  useEffect(() => {
    const savedEvents = localStorage.getItem("calendarEvents");
    if (savedEvents) {
      const parsedEvents = JSON.parse(savedEvents).map((event) => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end),
      }));
      setEvents(parsedEvents);
    }
  }, []);

  // Add pendingEventCell state
  const [pendingEventCell, setPendingEventCell] = useState(null);
  //check for prop drilling - can this be moved?

  // Add click tracking state
  const [clickState, setClickState] = useState({
    lastClickTime: 0,
    lastClickPosition: null,
    clickCount: 0,
  });

  const handleCreateEvent = useCallback((eventData) => {
    const newEvent = {
      ...eventData,
      id: generateEventId(),
      seriesId: null,
    };

    setEvents((prev) => {
      const newEvents = [...prev, newEvent];
      localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
      return newEvents;
    });

    // Immediately open CommandBar for editing
    if (commandBarRef.current) {
      commandBarRef.current.openForEdit(newEvent);
    }

    return newEvent;
  }, []);

  const handleUpdateEvent = useCallback((eventData) => {
    // Create a clean copy of the event data without internal properties
    const cleanEventData = { ...eventData };

    // Store important metadata before we remove it
    const editScope = eventData._editScope;

    // Remove internal properties that shouldn't be stored
    const preserveSeriesEvents = eventData._preserveSeriesEvents;
    delete cleanEventData._editScope;
    delete cleanEventData._repeatChanged;
    delete cleanEventData._timeChange;
    delete cleanEventData._originalSeriesId;
    delete cleanEventData._preserveSeriesEvents;

    setEvents((prev) => {
      // Find the existing event to determine if it's part of a series
      const existingEvent = prev.find((e) => e.id === eventData.id);

      // If converting from repeat to non-repeat
      if (
        existingEvent?.seriesId &&
        (!eventData.repeat || eventData.repeat === "none")
      ) {
        // This condition might be removing all series events!
        // If preserve flag is set, only update this event and don't remove others
        if (preserveSeriesEvents || eventData._editScope === "single") {
          // Update only this event without affecting others
          const newEvents = prev.map((event) => {
            if (event.id === existingEvent.id) {
              return {
                ...eventData,
                id: existingEvent.id,
                seriesId: null,
                repeat: "none",
                isRepeat: false,
              };
            }
            return event;
          });

          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        } else {
          // Original behavior - Keep only this event and remove the series
          const otherEvents = prev.filter(
            (e) => e.seriesId !== existingEvent.seriesId
          );
          const singleEvent = {
            ...eventData,
            id: existingEvent.id,
            seriesId: null,
            repeat: "none",
            isRepeat: false,
          };
          const newEvents = [...otherEvents, singleEvent];
          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }
      }

      // If updating a series event
      if (existingEvent?.seriesId) {
        // If editing only this event, detach it from the series while preserving other events
        if (editScope === "single") {
          const updatedEvent = {
            ...cleanEventData,
            id: existingEvent.id,
            seriesId: null, // Detach from series
            repeat: "none", // No longer repeating
            isRepeat: false,
            _preserveSeriesEvents: true, // Add flag to preserve other events
          };

          // Simply update this event while keeping all others unchanged
          const newEvents = prev.map((event) =>
            event.id === existingEvent.id ? updatedEvent : event
          );

          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }

        // If the repeat option changed (indicated by _repeatChanged flag)
        // or if the event is changing from one repeat type to another
        if (
          eventData._repeatChanged ||
          (existingEvent.repeat !== eventData.repeat &&
            eventData.repeat !== "none")
        ) {
          // Remove all events in the current series
          const otherEvents = prev.filter(
            (e) => e.seriesId !== existingEvent.seriesId
          );

          // Generate a new series with the updated repeat option
          const repeatedEvents = generateRepeatedEvents(
            {
              ...eventData,
              id: existingEvent.id, // Keep the original ID for the first event
            },
            eventData.repeat
          );

          const newEvents = [...otherEvents, ...repeatedEvents];
          localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
          return newEvents;
        }

        // Handle future-only edits specifically
        if (editScope === "future") {
          // Get the current event's start time as the cutoff point
          const cutoffDate = new Date(existingEvent.start);

          // Calculate time differences if provided
          let startDiff = 0;
          let endDiff = 0;

          if (eventData._timeChange) {
            startDiff = eventData._timeChange.startDiff;
            endDiff = eventData._timeChange.endDiff;
          } else {
            startDiff = eventData.start - existingEvent.start;
            endDiff = eventData.end - existingEvent.end;
          }

          // Update only this and future events
          return prev.map((e) => {
            // If this event is part of the same series
            if (e.seriesId === existingEvent.seriesId) {
              // Only update events on or after the cutoff date
              if (e.start >= cutoffDate) {
                // If this is the specific event being edited
                if (e.id === existingEvent.id) {
                  return {
                    ...cleanEventData,
                    id: e.id,
                    seriesId: existingEvent.seriesId,
                    isRepeat: true,
                    _lastUpdated: new Date().getTime(), // Add timestamp to track updates
                  };
                }

                // For other future events, apply the same properties and time shift
                const newStart = new Date(e.start.getTime() + startDiff);
                const newEnd = new Date(e.end.getTime() + endDiff);

                return {
                  ...e,
                  title: eventData.title,
                  description: eventData.description,
                  color: eventData.color,
                  isAllDay: eventData.isAllDay,
                  repeat: eventData.repeat,
                  start: newStart,
                  end: newEnd,
                  _lastUpdated: new Date().getTime(),
                };
              }
            }
            // Keep all other events unchanged
            return e;
          });
        }

        // Calculate the time difference if start/end times changed
        const startDiff = eventData.start - existingEvent.start;
        const endDiff = eventData.end - existingEvent.end;
        const timeChanged = startDiff !== 0 || endDiff !== 0;

        return prev.map((event) => {
          if (event.seriesId === existingEvent.seriesId) {
            const updatedEvent = {
              ...event,
              title: eventData.title,
              description: eventData.description,
              color: eventData.color,
              isAllDay: eventData.isAllDay,
              repeat: eventData.repeat,
            };

            // If time changed, adjust all events in the series by the same amount
            if (timeChanged) {
              updatedEvent.start = new Date(event.start.getTime() + startDiff);
              updatedEvent.end = new Date(event.end.getTime() + endDiff);
            }

            return updatedEvent;
          }
          return event;
        });
      }

      // If converting a single event to a repeat series
      if (
        !existingEvent?.seriesId &&
        eventData.repeat &&
        eventData.repeat !== "none"
      ) {
        // Remove the original event since it will be included in the series
        const otherEvents = prev.filter((e) => e.id !== eventData.id);

        // Generate the series events, keeping the original event's ID for the first one
        const repeatedEvents = generateRepeatedEvents(
          {
            ...eventData,
            id: eventData.id, // This ensures the first event keeps its ID
          },
          eventData.repeat
        );

        const newEvents = [...otherEvents, ...repeatedEvents];
        localStorage.setItem("calendarEvents", JSON.stringify(newEvents));
        return newEvents;
      }

      // Otherwise, update a single event
      const updatedEvents = prev.map((event) => {
        if (event.id === eventData.id) {
          return {
            ...event,
            ...cleanEventData,
            id: event.id, // Preserve the original ID
            _lastUpdated: new Date().getTime(), // Add timestamp to track updates
          };
        }
        return event;
      });
      localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
      return updatedEvents;
    });
  }, []);

  const handleDeleteEvent = (event) => {
    // Only treat as repeated event if it has a repeat property and it's not 'none'
    const isRepeatedEvent = event.repeat && event.repeat !== "none";

    if (isRepeatedEvent) {
      setDeleteModalState({
        isOpen: true,
        event,
      });
    } else {
      // If not a repeated event, delete directly
      setEvents((prevEvents) => {
        const updatedEvents = prevEvents.filter((e) => e.id !== event.id);
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      });
    }
  };

  const handleDeleteConfirm = (deleteAll) => {
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
  };

  const handleDeleteModalClose = () => {
    setDeleteModalState({
      isOpen: false,
      event: null,
    });
  };

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
    [selectedDate, viewType, currentDate]
  );

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
                seriesId: event.seriesId,
                repeat: event.repeat,
                isRepeat: true,
              };
            }
            return e;
          });
        } else if (editScope === "all") {
          // Update all events in the series
          updatedEvents = prev.map((e) => {
            if (e.seriesId === event.seriesId) {
              // For the dragged event itself
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
                seriesId: event.seriesId,
                repeat: event.repeat,
                isRepeat: true,
              };
            }
            return e;
          });
        }

        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        return updatedEvents;
      });

      // Open the CommandBar for editing after state updates
      if (editTargetEvent) {
        queueMicrotask(() => {
          commandBarRef.current?.openForEdit({
            ...editTargetEvent,
            repeat: editScope === "single" ? "none" : event.repeat,
            seriesId: editScope === "single" ? null : event.seriesId,
            isRepeat: editScope !== "single",
          });
        });
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
    [repeatEditModalState]
  );

  const handleRepeatEditDiscard = useCallback(() => {
    const { originalEvent } = repeatEditModalState;

    // Revert the event to its original position
    if (originalEvent) {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id === originalEvent.id) {
            return originalEvent;
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
  }, [repeatEditModalState]);

  const handleEventClick = useCallback(
    (event) => {
      if (dragState.isDragging) return;

      // If it's a repeat event (has seriesId), open the RepeatEditModal
      if (event.seriesId) {
        setRepeatEditModalState({
          isOpen: true,
          event: event,
          draggedEvent: event,
          originalEvent: event,
          isEditOperation: true,
        });
        return;
      }

      // For non-repeat events, open the CommandBar as usual
      commandBarRef.current?.openForEdit({
        ...event,
        repeatOption: event.repeat,
      });
    },
    [dragState.isDragging]
  );

  const handleCellClick = useCallback(
    (e, date) => {
      e.preventDefault();
      e.stopPropagation(); // Add this to prevent event bubbling

      const currentTime = Date.now();
      const clickPosition = { x: e.clientX, y: e.clientY };

      // Check if this is a double click
      const isDoubleClick =
        currentTime - clickState.lastClickTime < 300 &&
        clickState.lastClickPosition &&
        Math.abs(clickState.lastClickPosition.x - clickPosition.x) < 10 &&
        Math.abs(clickState.lastClickPosition.y - clickPosition.y) < 10;

      if (isDoubleClick) {
        // Open command bar with the clicked time
        const clickedDate = new Date(date);
        commandBarRef.current?.openWithTime(clickedDate);

        // Reset click state
        setClickState({
          lastClickTime: 0,
          lastClickPosition: null,
          clickCount: 0,
        });
      } else {
        // Update click state for potential double-click
        setClickState({
          lastClickTime: currentTime,
          lastClickPosition: clickPosition,
          clickCount: clickState.clickCount + 1,
        });
      }
    },
    [clickState]
  );

  const handleCellDragStart = useCallback(
    (e) => {
      // Don't create events if context menu is open or if not left click
      if (contextMenu.show || e.button !== 0) return;

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
            containerRect
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
    [selectedDate, viewType, currentDate, colors, contextMenu.show]
  );

  const handleEventContextMenu = useCallback((e, eventId) => {
    e.preventDefault();
    e.stopPropagation();

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Context menu dimensions (hardcoded since they're fixed in CSS)
    const menuWidth = 280; // matches w-[280px] in CSS
    const menuHeight = 180; // approximate height of context menu

    // Calculate initial position
    let x = e.clientX;
    let y = e.clientY;

    // Adjust position if menu would overflow right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 16; // 16px padding from edge
    }

    // Adjust position if menu would overflow bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 16; // 16px padding from edge
    }

    // Ensure menu doesn't go off the left or top edge
    x = Math.max(16, x);
    y = Math.max(16, y);

    setContextMenu({
      show: true,
      x,
      y,
      eventId,
    });
  }, []);

  const handleColorSelect = useCallback(
    (e, color) => {
      e.stopPropagation();
      e.preventDefault();

      const eventToUpdate = events.find(
        (event) => event.id === contextMenu.eventId
      );
      if (!eventToUpdate) return;

      // Check if this is part of a repeated series
      const isRepeatedEvent =
        eventToUpdate.repeat && eventToUpdate.repeat !== "none";

      setEvents((prevEvents) => {
        let updatedEvents;

        if (isRepeatedEvent) {
          // Update all events in the series
          const seriesId = eventToUpdate.seriesId;
          updatedEvents = prevEvents.map((event) => {
            if (event.seriesId === seriesId) {
              return { ...event, color };
            }
            return event;
          });
        } else {
          // Update single event
          updatedEvents = prevEvents.map((event) =>
            event.id === contextMenu.eventId ? { ...event, color } : event
          );
        }

        try {
          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        } catch (error) {
          console.error("Error saving events to localStorage:", error);
        }
        return updatedEvents;
      });

      setContextMenu({ show: false, x: 0, y: 0, eventId: null });
    },
    [contextMenu.eventId, events]
  );

  const handleEventDelete = useCallback(
    (e) => {
      e.stopPropagation();
      const event = events.find((event) => event.id === contextMenu.eventId);
      handleDeleteEvent(event);
      setContextMenu({ show: false, x: 0, y: 0, eventId: null });
    },
    [contextMenu.eventId, events]
  );

  const handleEventDuplicate = useCallback(
    (e) => {
      e.stopPropagation();
      const eventToDuplicate = events.find(
        (event) => event.id === contextMenu.eventId
      );
      if (!eventToDuplicate) return;

      // Create a duplicate with a new ID
      const duplicateEvent = {
        ...eventToDuplicate,
        id: crypto.randomUUID(),
        seriesId:
          eventToDuplicate.repeat !== "none" ? crypto.randomUUID() : undefined,
      };

      setEvents((prevEvents) => {
        const updatedEvents = [...prevEvents, duplicateEvent];

        try {
          localStorage.setItem("calendarEvents", JSON.stringify(updatedEvents));
        } catch (error) {
          console.error("Error saving events to localStorage:", error);
        }
        return updatedEvents;
      });

      setContextMenu({ show: false, x: 0, y: 0, eventId: null });
    },
    [contextMenu.eventId, events]
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
    [events, selectedDate]
  );

  const handleCommandBarClose = useCallback((eventId) => {
    // If an eventId is provided, remove that specific event
    if (eventId) {
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  }, []);

  const renderEvents = useCallback(() => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const filteredEvents = events.filter((event) => {
        const eventStart = new Date(event.start);
        return (
          eventStart >= weekStart && eventStart < weekEnd && !event.isAllDay
        );
      });

      return filteredEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, filteredEvents);

        return (
          <motion.div
            key={`${event.id}-${index}`}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer ${
              event.isEditing || dragState.eventId === event.id
                ? "bg-primary/30"
                : "bg-primary/10"
            } event-item`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0) {
                // Left click only
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: event.color || "#808080" }}
            />
            {/* Only show resize handles for non-editing events */}
            {!event.isEditing && (
              <>
                {/* Vertical resize handles */}
                <div
                  className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "top")}
                />
                <div
                  className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "bottom")}
                />
                {/* Horizontal resize handles */}
                <div
                  className="absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "left")}
                />
                <div
                  className="absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "right")}
                />
              </>
            )}
            <div className="px-3 py-1">
              <div className="font-medium text-xs">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {event.repeat && event.repeat !== "none" && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </motion.div>
        );
      });
    } else {
      // Day view
      const dayEvents = events.filter(
        (event) => !event.isAllDay && isSameDay(event.start, selectedDate)
      );

      return dayEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, dayEvents);

        return (
          <motion.div
            key={`${event.id}-${index}`}
            whileTap={{ scale: 0.95 }}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-move ${
              dragState.eventId === event.id ? "bg-primary/30" : "bg-primary/10"
            }`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0) {
                // Left click only
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: event.color || "#808080" }}
            />
            <div className="px-2 py-1">
              <div className="font-medium text-sm">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {event.repeat && event.repeat !== "none" && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </motion.div>
        );
      });
    }
  }, [
    events,
    selectedDate,
    viewType,
    dragState,
    handleDragStart,
    handleEventClick,
  ]);

  const renderAllDayEvents = () => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      return (
        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          <div className="relative grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const currentDate = addDays(weekStart, dayIndex);
              const dayEvents = events.filter(
                (event) => event.isAllDay && isSameDay(event.start, currentDate)
              );

              return (
                <div
                  key={dayIndex}
                  className="relative border-l border-light-border dark:border-dark-border min-h-[32px]"
                >
                  <div className="flex flex-col gap-1 p-1">
                    {dayEvents.map((event, index) => (
                      <div
                        key={`${event.id}-${index}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onContextMenu={(e) =>
                          handleEventContextMenu(e, event.id)
                        }
                        className="flex items-center text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] overflow-hidden"
                        style={{
                          backgroundColor: event.color
                            ? `${event.color}20`
                            : "#80808020",
                        }}
                      >
                        <div
                          className="w-1 self-stretch mr-1.5"
                          style={{ backgroundColor: event.color || "#808080" }}
                        />
                        <div className="px-3 py-1">
                          <div className="font-medium text-xs">
                            {event.title}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
        <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
          All-day
        </div>
        <div className="relative">
          <div className="flex flex-col gap-1 p-1">
            {events
              .filter(
                (event) =>
                  event.isAllDay && isSameDay(event.start, selectedDate)
              )
              .map((event, index) => (
                <div
                  key={`${event.id}-${index}`}
                  className="z-10 bg-primary/5 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/10"
                  style={{
                    backgroundColor: event.color
                      ? `${event.color}20`
                      : "#80808020",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                  onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: event.color || "#808080" }}
                  />
                  <div className="px-3 py-1">
                    <div className="font-medium text-xs">{event.title}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHeader = () => {
    const dateFormat = { month: "long", year: "numeric" };
    if (viewType === ViewType.DAY) {
      dateFormat.weekday = "long";
      dateFormat.day = "numeric";
    }

    return (
      <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
        <div className="flex w-full justify-between items-center gap-4">
          <div className="flex items-baseline">
            <h1 className="text-xl font-semibold">
              {selectedDate.toLocaleString("en-US", { month: "long" })}
            </h1>
            <span className="text-xl font-regular text-gray-400 ml-2">
              {selectedDate.getFullYear()}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <div className="relative">
              <div
                className="flex items-center bg-light-bg shadow-sm border border-light-border dark:border-dark-border dark:bg-dark-bg gap-1 cursor-pointer p-2 hover:bg-light-bg-light dark:hover:bg-dark-bg-light rounded-[7px]"
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              >
                <span className="text-xs px-0.5  font-medium text-light-text dark:text-dark-text">
                  {viewType === ViewType.DAY
                    ? "Day"
                    : viewType === ViewType.WEEK
                    ? "Week"
                    : "Month"}
                </span>
                <svg
                  className={`w-4 h-4 text-light-text/50 dark:text-dark-text/50 transition-transform ${
                    isViewDropdownOpen ? "rotate-180" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M19 9l-7 7-7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {isViewDropdownOpen && (
                <div
                  ref={viewDropdownRef}
                  className="absolute flex flex-col gap-1 top-full right-0 mt-1 bg-dark-bg-lighter p-1 dark:bg-dark-bg border border-light-border dark:border-dark-border text-xs rounded-[9px] shadow-lg py-1 min-w-[120px] z-50"
                >
                  {Object.values(ViewType).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setViewType(type);
                        setIsViewDropdownOpen(false);
                      }}
                      className={`w-full rounded text-left px-2 py-1 text-xs font-medium flex items-center justify-between ${
                        viewType === type
                          ? "text-dark-text text-xs dark:text-dark-text bg-black/5 dark:bg-white/5"
                          : "text-dark-text/50 text-xs dark:text-dark-text/50 hover:bg-white/15 dark:hover:bg-white/5"
                      }`}
                    >
                      <span>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </span>
                      <span className="text-dark-text/30 dark:text-dark-text/30 text-[8px] border h-[20px] w-[20px] rounded-[5px] flex items-center justify-center border-light-border-2 dark:border-dark-border">
                        {type.charAt(0).toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleDrop = (e, date) => {
    e.preventDefault();
    try {
      const taskData = JSON.parse(e.dataTransfer.getData("application/json"));
      let dropTime;

      if (viewType === ViewType.MONTH) {
        // For month view, default to 9 AM of the dropped date
        dropTime = new Date(date);
        dropTime.setHours(9, 0, 0, 0);
      } else {
        const timeGridRect = e.currentTarget.getBoundingClientRect();

        // Calculate vertical position for time
        const dropY = e.clientY - timeGridRect.top;
        const totalMinutes = Math.floor(
          (dropY / timeGridRect.height) * 24 * 60
        );
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (viewType === ViewType.WEEK) {
          // Calculate horizontal position for day in week view
          const dropX = e.clientX - timeGridRect.left;
          const dayWidth = timeGridRect.width;
          const dayIndex = Math.floor(dropX / dayWidth);

          // Get the start of the week and add days based on drop position
          const startOfWeek = getStartOfWeek(selectedDate);
          dropTime = addDays(startOfWeek, dayIndex);
        } else {
          // Day view - use the selected date
          dropTime = new Date(date);
        }

        dropTime.setHours(
          Math.max(0, Math.min(23, hours)), // Clamp hours between 0-23
          Math.max(0, Math.min(59, minutes)), // Clamp minutes between 0-59
          0,
          0
        );
      }

      const newEvent = {
        id: `task-${taskData.id}`,
        title: taskData.title,
        start: dropTime,
        end: new Date(dropTime.getTime() + 60 * 60 * 1000), // 1 hour duration
        color:
          taskData.tag?.color ||
          colors[Math.floor(Math.random() * colors.length)],
      };

      setEvents((prevEvents) => {
        // Remove any existing repeated events with the same base ID
        const nonRepeatedEvents = prevEvents.filter(
          (e) => !e.id.includes(newEvent.id)
        );

        // Generate repeated events if repeat option is set
        let allEvents;
        if (newEvent.repeat && newEvent.repeat !== "none") {
          const repeatedEvents = generateRepeatedEvents(
            newEvent,
            newEvent.repeat
          );
          allEvents = [...nonRepeatedEvents, ...repeatedEvents];
        } else {
          allEvents = [...nonRepeatedEvents, newEvent];
        }

        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(allEvents));
        return allEvents;
      });

      setDragState((prevState) => {
        const currentPreview = prevState.dropPreview;
        if (!currentPreview) return prevState;

        const snapToInterval = (date) => {
          const minutes = date.getMinutes();
          const snappedMinutes = Math.round(minutes / 15) * 15;
          const newDate = new Date(date);
          newDate.setMinutes(snappedMinutes);
          return newDate;
        };

        const isReverse = currentPreview.end < currentPreview.start;
        const snappedStart = snapToInterval(
          isReverse ? currentPreview.end : currentPreview.start
        );
        const snappedEnd = snapToInterval(
          isReverse ? currentPreview.start : currentPreview.end
        );

        // Only open command bar if we're not dragging an existing event
        if (!prevState.eventId) {
          commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
        }

        const newState = {
          ...prevState,
          isDragging: false,
          isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
          dropPreview: {
            start: snappedStart,
            end: snappedEnd,
          },
        };
        return newState;
      });

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleUp = () => {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);

    setDragState((prevState) => {
      const currentPreview = prevState.dropPreview;
      if (!currentPreview) return prevState;

      const snapToInterval = (date) => {
        const minutes = date.getMinutes();
        const snappedMinutes = Math.round(minutes / 15) * 15;
        const newDate = new Date(date);
        newDate.setMinutes(snappedMinutes);
        return newDate;
      };

      const isReverse = currentPreview.end < currentPreview.start;
      const snappedStart = snapToInterval(
        isReverse ? currentPreview.end : currentPreview.start
      );
      const snappedEnd = snapToInterval(
        isReverse ? currentPreview.start : currentPreview.end
      );

      // Only open command bar if we're not dragging an existing event
      if (!prevState.eventId) {
        commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
      }

      const newState = {
        ...prevState,
        isDragging: false,
        isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
        dropPreview: {
          start: snappedStart,
          end: snappedEnd,
        },
      };
      return newState;
    });

    // Reset click state after drag operation
    setClickState({
      lastClickTime: 0,
      lastClickPosition: null,
      clickCount: 0,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        contextMenu.show &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(event.target)
      ) {
        setContextMenu({ show: false, x: 0, y: 0, eventId: null });
      }
    };

    if (contextMenu.show) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [contextMenu.show]);

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

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar
        commandBarRef={commandBarRef}
        events={events}
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
      />
      <div className="flex-1 flex flex-col h-full bg-light-bg-light dark:bg-dark-bg-light relative">
        {/* Add header with z-index to ensure it's clickable */}
        <div className="z-10 relative">{renderHeader()}</div>
        {/* Calendar views */}
        <div className="flex-1 overflow-auto">
          {viewType === ViewType.WEEK && (
            <Week
              selectedDate={selectedDate}
              events={events}
              dragState={dragState}
              setPendingEventCell={setPendingEventCell}
              pendingEventCell={pendingEventCell}
              handleEventClick={handleEventClick}
              handleEventContextMenu={handleEventContextMenu}
              handleCellDragStart={handleCellDragStart}
              handleCellClick={handleCellClick}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              getTimeFromMousePosition={getTimeFromMousePosition}
              getColumnFromMousePosition={getColumnFromMousePosition}
              renderEvents={renderEvents}
              renderAllDayEvents={renderAllDayEvents}
              timeGridRef={timeGridRef}
            />
          )}
          {viewType === ViewType.DAY && (
            <Day
              selectedDate={selectedDate}
              events={events}
              dragState={dragState}
              pendingEventCell={pendingEventCell}
              setPendingEventCell={setPendingEventCell}
              handleEventClick={handleEventClick}
              handleEventContextMenu={handleEventContextMenu}
              handleCellDragStart={handleCellDragStart}
              handleCellClick={handleCellClick}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              getTimeFromMousePosition={getTimeFromMousePosition}
              getColumnFromMousePosition={getColumnFromMousePosition}
              renderEvents={renderEvents}
              timeGridRef={timeGridRef}
            />
          )}
          {viewType === ViewType.MONTH && (
            <Month
              selectedDate={selectedDate}
              events={events}
              handleEventClick={handleEventClick}
              handleEventContextMenu={handleEventContextMenu}
            />
          )}
        </div>
        {/* Context menu */}
        {contextMenu.show && (
          <div
            ref={contextMenuRef}
            className="fixed bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden z-50 border border-light-border dark:border-dark-border w-[280px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="">
              <div className="flex flex-wrap gap-2 pb-2 p-3">
                {colors.map((color) => (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.02 }}
                    className="w-5 h-5 rounded-md hover:ring-1 hover:ring-offset-1 hover:ring-light-border hover:dark:ring-dark-border transition-all"
                    style={{ backgroundColor: color }}
                    onClick={(e) => handleColorSelect(e, color)}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                ))}
              </div>
              <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
              <div className="p-1">
                <button
                  className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-dark-border-2 transition-all"
                  onClick={(e) => handleEventDuplicate(e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Copy className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Duplicate
                </button>

                <button
                  className="w-full group text-left px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                  onClick={(e) => handleEventDelete(e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white  group-hover:dark:text-white group-hover:dark:text-white" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <DeleteEventModal
          isOpen={deleteModalState.isOpen}
          eventTitle={deleteModalState.event?.title}
          onClose={handleDeleteModalClose}
          onDelete={handleDeleteConfirm}
        />
        <RepeatEditModal
          isOpen={repeatEditModalState.isOpen}
          eventTitle={repeatEditModalState.event?.title}
          onClose={handleRepeatEditDiscard}
          onEditConfirm={handleRepeatEditConfirm}
          originalEvent={repeatEditModalState.originalEvent}
          draggedEvent={repeatEditModalState.draggedEvent}
          isEditOperation={repeatEditModalState.isEditOperation}
          commandBarRef={commandBarRef}
        />
        <CommandBar
          ref={commandBarRef}
          onCreateEvent={useCallback(handleCreateEvent, [])}
          onUpdateEvent={useCallback(handleUpdateEvent, [])}
          onPrevious={useCallback(
            () => handlePrevious(viewType, currentDate, onDateSelect),
            [viewType, currentDate, onDateSelect]
          )}
          onNext={useCallback(
            () => handleNext(viewType, currentDate, onDateSelect),
            [viewType, currentDate, onDateSelect]
          )}
          onToday={useCallback(() => handleToday(onDateSelect), [onDateSelect])}
          onClose={useCallback(handleCommandBarClose, [])}
          onCreateTask={useCallback((task) => {
            // Store the task in localStorage
            const savedTasks = localStorage.getItem("tasks") || "{}";
            const tasks = JSON.parse(savedTasks);

            // Add task to its tag group and the 'all' group
            const tagGroup = task.tag ? task.tag.id : "all";
            const updatedTasks = {
              ...tasks,
              [tagGroup]: [...(tasks[tagGroup] || []), task],
              all: [...(tasks.all || []), task],
            };

            // Save back to localStorage
            localStorage.setItem("tasks", JSON.stringify(updatedTasks));
          }, [])}
          onUpdateTask={useCallback((task) => {
            // Get current tasks from localStorage
            const savedTasks = localStorage.getItem("tasks") || "{}";
            const tasks = JSON.parse(savedTasks);

            // Remove task from all groups
            const cleanedTasks = Object.keys(tasks).reduce((acc, key) => {
              acc[key] = tasks[key].filter((t) => t.id !== task.id);
              return acc;
            }, {});

            // Add updated task to its groups
            const tagGroup = task.tag ? task.tag.id : "all";
            const updatedTasks = {
              ...cleanedTasks,
              [tagGroup]: [...(cleanedTasks[tagGroup] || []), task],
              all: [...(cleanedTasks.all || []), task],
            };

            // Save back to localStorage
            localStorage.setItem("tasks", JSON.stringify(updatedTasks));
          }, [])}
        />
        <GoToDateCommand
          isOpen={isGoToDateOpen}
          onClose={() => setIsGoToDateOpen(false)}
          onDateSelect={onDateSelect}
        />
      </div>
    </div>
  );
}
