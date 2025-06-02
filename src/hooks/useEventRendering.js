import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, addDays, startOfDay, endOfDay, isWithinInterval, parseISO } from "date-fns";

import { RRule } from "rrule";
import { Repeat } from "@/assets/icons/Repeat";
import { Tag } from "@/assets/icons/Tag";
import { ViewType } from "../constants/views";
import { motion, AnimatePresence } from "framer-motion";
import { findOverlappingGroup, getEventStyle } from "@/utils/eventUtils";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import EventTooltipContent from "@/components/EventTooltipContent";
import { Completed } from "@/assets/icons/Completed";
import Checkbox from "@/components/Checkbox";
import { Pencil } from "lucide-react";
import { Trash } from "@/assets/icons/Trash";


export const useEventRendering = (
  events,
  selectedDate,
  viewType,
  dragState,
  handleDragStart,
  handleEventClick,
  handleEventContextMenu,
  handleResizeStart,
  eventStyleGetter,
  commandBarRef,
  handleToggleTaskCompletion,
  handleTaskEdit,
  handleTaskDelete = null
) => {
  const [taskUpdateTrigger, setTaskUpdateTrigger] = useState(0);
  const [taskContextMenu, setTaskContextMenu] = useState({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });


  // Task context menu handlers
  const handleTaskContextMenu = useCallback((e, task) => {
    e.preventDefault();
    e.stopPropagation();
    setTaskContextMenu({ 
      isOpen: true, 
      taskId: task.id, 
      task,
      position: { x: e.clientX, y: e.clientY }
    });
  }, []);

  const handleTaskEditFromMenu = useCallback((task) => {
    if (handleTaskEdit) {
      handleTaskEdit(task);
    } else if (commandBarRef?.current?.openForTaskEdit) {
      commandBarRef.current.openForTaskEdit(task);
    }
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, [handleTaskEdit, commandBarRef]);

  const handleTaskDeleteInternal = useCallback((task) => {
    // If a custom task delete handler is provided, try it first
    if (handleTaskDelete) {
      const handled = handleTaskDelete(task);
      if (handled) {
        return; // Custom handler took care of it
      }
      // If custom handler returned false, continue with internal logic
    }
    
    // For calendar view, always delete the specific instance (single scope behavior)
    // Get tasks from localStorage
    const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
    
    const updatedTasks = { ...tasks };
    const taskId = task.id;
    const taskSeriesId = task.seriesId;
    const taskScheduledDate = task.scheduledDate;
    
    // Strengthen instance detection logic
    const isRecurringInstance = task.isRepeat === true || 
                               (taskSeriesId && task.originalBaseId) ||
                               (taskSeriesId && task.id && task.id.includes('_repeat_'));
    
    // Additional check: if task has seriesId but no explicit isRepeat, it's likely an instance
    const isLikelyInstance = taskSeriesId && !task.repeat && task.id !== taskSeriesId;
    
    // For recurring tasks (both instances and base tasks), implement single instance deletion behavior
    if (taskSeriesId && (isRecurringInstance || isLikelyInstance || (task.repeat && task.repeat !== 'none'))) {
      // Find the base task definition
      const allTasks = Object.values(updatedTasks).flat();
      const candidateTasks = allTasks.filter(t => t.seriesId === taskSeriesId);
      let baseTaskDefinition = candidateTasks.find(t => t.isRepeat === false || typeof t.isRepeat === 'undefined');
      
      // If we're deleting the base task itself, use it as the base definition
      if (!baseTaskDefinition && task.repeat && task.repeat !== 'none') {
        baseTaskDefinition = task;
      }
      
      if (baseTaskDefinition) {
        // For single instance deletion, update the base task's scheduledDate to the next occurrence
        setTimeout(() => {
          import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
            const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskScheduledDate));
            
            if (nextInstance) {
              // Update the base task with the next occurrence date
              Object.keys(updatedTasks).forEach((group) => {
                if (Array.isArray(updatedTasks[group])) {
                  updatedTasks[group] = updatedTasks[group].map((t) => {
                    if (t.id === baseTaskDefinition.id) {
                      return {
                        ...t,
                        scheduledDate: nextInstance.scheduledDate
                      };
                    }
                    return t;
                  });
                }
              });
            } else {
              // No more instances, remove the base task
              Object.keys(updatedTasks).forEach((group) => {
                if (Array.isArray(updatedTasks[group])) {
                  updatedTasks[group] = updatedTasks[group].filter(
                    (t) => t.id !== baseTaskDefinition.id
                  );
                }
              });
            }
            
            // Save to localStorage and dispatch events
            localStorage.setItem('tasks', JSON.stringify(updatedTasks));
            const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
            window.dispatchEvent(event);
            setTaskUpdateTrigger(prev => prev + 1);
          }).catch(error => {
            console.error('Error importing generateNextDisplayableTaskInstance:', error);
          });
        }, 0);
      } else {
        // No base task found, just remove the instance
        Object.keys(updatedTasks).forEach(key => {
          if (Array.isArray(updatedTasks[key])) {
            updatedTasks[key] = updatedTasks[key].filter(t => t.id !== task.id);
          }
        });
        
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
        window.dispatchEvent(event);
        setTaskUpdateTrigger(prev => prev + 1);
      }
    } else {
      // For non-recurring tasks, just remove directly
      Object.keys(updatedTasks).forEach(key => {
        if (Array.isArray(updatedTasks[key])) {
          updatedTasks[key] = updatedTasks[key].filter(t => t.id !== task.id);
        }
      });
      
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
      const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
      window.dispatchEvent(event);
      setTaskUpdateTrigger(prev => prev + 1);
    }
    
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, []);

  // Listen for task updates to refresh the calendar
  useEffect(() => {
    const handleTaskUpdate = () => {
      setTaskUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('storage', handleTaskUpdate);
    window.addEventListener('tasksUpdated', handleTaskUpdate);

    return () => {
      window.removeEventListener('storage', handleTaskUpdate);
      window.removeEventListener('tasksUpdated', handleTaskUpdate);
    };
  }, []);

  const expandRecurringEvents = useCallback((events, dateRangeStart, dateRangeEnd) => {
    const expandedEvents = [];

    events.forEach(event => {
      // Direct pass-through for non-recurring events
      if (!event.rruleOptions && !event.seriesId) {
        expandedEvents.push(event);
        return;
      }

      try {
        // Handle both types of recurring events: pre-defined (seriesId) and custom (rruleOptions)

        // CASE 1: Events with seriesId that were already generated
        // These should be passed through directly
        if (event.seriesId) {
          // Check if this event falls within our date range
          const eventStart = new Date(event.start);
          if (eventStart >= dateRangeStart && eventStart <= dateRangeEnd) {
            expandedEvents.push(event);
          }
          return;
        }

        // CASE 2: Root events with rruleOptions that need to be expanded
        // These are the template events that define the recurrence pattern
        if (event.rruleOptions) {
          const rule = new RRule({
            ...event.rruleOptions,
            dtstart: new Date(event.start)
          });

          // Generate occurrences within the date range
          const occurrences = rule.between(dateRangeStart, dateRangeEnd, true);

          // If no occurrences found but this is within our range, include it anyway
          if (occurrences.length === 0) {
            const eventStart = new Date(event.start);
            if (eventStart >= dateRangeStart && eventStart <= dateRangeEnd) {
              expandedEvents.push(event);
            }
            return;
          }

          // For each occurrence, create an event instance
          occurrences.forEach((occurrenceDate, index) => {
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);

            // Calculate duration to maintain it across occurrences
            const duration = endDate - startDate;

            const occurrenceStart = occurrenceDate;
            const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

            // CRITICAL: For the *first real occurrence* (index 0), use the original ID
            // This ensures the base event can be manipulated
            const isFirstOccurrence = index === 0;

            expandedEvents.push({
              ...event,
              id: isFirstOccurrence ? event.id : `${event.id}_${index}`,
              start: occurrenceStart,
              end: occurrenceEnd,
              isRecurring: true,
              seriesId: event.id // The base event itself becomes the series ID
            });
          });
        }
      } catch (error) {
        console.error('Error expanding recurring event:', error);
        expandedEvents.push(event); // Fallback to original event
      }
    });

    return expandedEvents;
  }, []);

  const renderEvents = useCallback(() => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // First expand any recurring events
      const expandedEvents = expandRecurringEvents(events, weekStart, weekEnd);

      // Then filter for events in this week
      const filteredEvents = expandedEvents.filter((event) => {
        const eventStart = new Date(event.start);
        // Check both allDay and isAllDay properties to ensure compatibility
        const isAllDayEvent = event.allDay || event.isAllDay;
        return (
          eventStart >= weekStart && eventStart < weekEnd && !isAllDayEvent
        );
      });

      return filteredEvents.map((event) => {
        const overlappingEvents = findOverlappingGroup(event, filteredEvents);
        const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
        const repeatClass = isRepeatEvent ? "repeat-event" : "";

        return (
          <TooltipProvider key={event.id} delayDuration={2000}>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div
                className={`absolute z-10 overflow-hidden cursor-pointer select-none event-item ${repeatClass} ${
                  event.isTask 
                    ? `border-1 border-dashed rounded-[5px] bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm ${
                        event.isEditing || dragState.eventId === event.id
                          ? "border-primary bg-gray-100/90 dark:bg-gray-700/90"
                          : "border-gray-300 dark:border-gray-600"
                      }`
                    : `backdrop-blur-md rounded-[9px] ${
                        event.isEditing || dragState.eventId === event.id
                          ? "bg-primary/30"
                          : "bg-primary/10"
                      }`
                }`}
                style={getEventStyle(event, overlappingEvents, viewType)}
                onMouseDown={(e) => {
                  if (e.button === 0 && !e.target.closest(".resize-handle")) {
                    handleDragStart(e, event);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (event.isTask) {
                    // Handle task click - open task edit modal
                    if (handleTaskEdit) {
                      handleTaskEdit(event.originalTask);
                    } else if (commandBarRef?.current?.openForTaskEdit) {
                      commandBarRef.current.openForTaskEdit(event.originalTask);
                    }
                  } else {
                    handleEventClick(event);
                  }
                }}
                onContextMenu={(e) => {
                  if (event.isTask) {
                    handleTaskContextMenu(e, event.originalTask);
                  } else {
                    handleEventContextMenu(e, event.id);
                  }
                }}
              >
                {!event.isTask && (
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: event.color || "#808080" }}
                  />
                )}
                {/* Resize handles */}
                <div
                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, event.id, "top");
                  }}
                />
                <div
                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleResizeStart(e, event.id, "bottom");
                  }}
                />
                <div className="px-2 py-1 relative">
                  <div className="font-medium text-xs">{event.title}</div>
                  <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                    {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
                  </div>
                  {isRepeatEvent && (
                    <div className="absolute bottom-1 right-1">
                      <Repeat className="w-3 h-3" />
                    </div>
                  )}
                </div>
              </motion.div>
            </TooltipTrigger>
            {!event.isTask && (
              <TooltipContent side="right" align="start">
                <EventTooltipContent event={event} />
              </TooltipContent>
            )}
          </Tooltip>
          </TooltipProvider>
        );
      });
    } else {
      // Day view
      const dayStart = new Date(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      // First expand any recurring events
      const expandedEvents = expandRecurringEvents(events, dayStart, dayEnd);

      // Then filter for events on this day
      const dayEvents = expandedEvents.filter((event) => {
        // Check both allDay and isAllDay properties to ensure compatibility
        const isAllDayEvent = event.allDay || event.isAllDay;
        return !isAllDayEvent && isSameDay(event.start, selectedDate);
      });

      return dayEvents.map((event) => {
        const overlappingEvents = findOverlappingGroup(event, dayEvents);
        const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
        const repeatClass = isRepeatEvent ? "repeat-event" : "";

        return (
          <TooltipProvider key={event.id} delayDuration={2000}>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  className={`absolute z-10 overflow-hidden cursor-move ${
                  event.isTask 
                    ? `border-1 border-dashed rounded-[5px] bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm ${
                        dragState.eventId === event.id
                          ? "border-primary bg-gray-100/90 dark:bg-gray-700/90"
                          : "border-gray-300 dark:border-gray-600"
                      }`
                    : `backdrop-blur-md rounded-[9px] ${
                        dragState.eventId === event.id ? "bg-primary/30" : "bg-primary/10"
                      }`
                } ${repeatClass}`}
                  style={getEventStyle(event, overlappingEvents, viewType)}
                  onMouseDown={(e) => {
                    if (e.button === 0 && !e.target.closest(".resize-handle")) {
                      handleDragStart(e, event);
                    }
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (event.isTask) {
                      // Handle task click - open task edit modal
                      if (handleTaskEdit) {
                        handleTaskEdit(event.originalTask);
                      } else if (commandBarRef?.current?.openForTaskEdit) {
                        commandBarRef.current.openForTaskEdit(event.originalTask);
                      }
                    } else {
                      handleEventClick(event);
                    }
                  }}
                  onContextMenu={(e) => {
                    if (event.isTask) {
                      handleTaskContextMenu(e, event.originalTask);
                    } else {
                      handleEventContextMenu(e, event.id);
                    }
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: event.color || "#808080" }}
                  />
                  {/* Resize handles */}
                  <div
                    className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleResizeStart(e, event.id, "top");
                    }}
                  />
                  <div
                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleResizeStart(e, event.id, "bottom");
                    }}
                  />
                  <div className="px-2 py-1 relative">
                    <div className="font-medium text-xs">{event.title}</div>
                    <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                      {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
                    </div>
                    <div className="flex items-center gap-1 ml-auto">
                      {((event.originalTask?.repeat && event.originalTask.repeat !== 'none') || (event.originalTask?.seriesId && event.originalTask?.originalBaseId)) && (
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center px-1 h-[20px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500">
                                <Repeat className="w-3 h-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Repeats {(() => {
                                if (event.originalTask.repeat && event.originalTask.repeat !== 'none') {
                                  return event.originalTask.repeat;
                                }
                                // For task instances, find the base task to get repeat pattern
                                if (event.originalTask.originalBaseId) {
                                  const savedTasks = localStorage.getItem('tasks');
                                  if (savedTasks) {
                                    const tasks = JSON.parse(savedTasks);
                                    const baseTask = tasks.all?.find(t => t.id === event.originalTask.originalBaseId);
                                    return baseTask?.repeat || 'unknown';
                                  }
                                }
                                return 'unknown';
                              })()}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {event.originalTask?.tag && (
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <div className="inline-flex items-center px-1 h-[20px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px]">
                                <Tag className="w-3 h-3" style={{ color: event.originalTask.tag.color }} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{event.originalTask.tag.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="right" align="start">
                <EventTooltipContent event={event} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
    handleEventContextMenu,
    handleResizeStart,
  ]);

  // Add this import at the top if not already present

  // In the renderAllDayEvents function, modify the section that processes events
  const renderAllDayEvents = useMemo(() => () => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
  
      // Get tasks from localStorage and filter for calendar tasks
      const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
      const allTasks = tasks.all || [];
      const calendarTasks = allTasks.filter(task => 
        task.addToCalendar && 
        task.scheduledDate && 
        !task.completed &&
        new Date(task.scheduledDate) >= weekStart && 
        new Date(task.scheduledDate) < weekEnd
      );
  
      // Convert tasks to event-like objects for rendering
      const taskEvents = calendarTasks.map(task => ({
        id: `task-${task.id}`,
        title: task.title,
        start: task.scheduledDate,
        end: task.scheduledDate,
        allDay: true,
        isAllDay: true,
        color: task.tag?.color || '#6B7280', // Use tag color or default gray
        isTask: true, // Flag to identify this as a task
        originalTask: task // Keep reference to original task
      }));
  
      // Combine events and task events
      const allItems = [...events, ...taskEvents];
  
      // Process multi-day events to determine their span across the week
      const processedEvents = [];
      const multiDayEvents = [];
  
      // First, identify multi-day events that span across days
      allItems.forEach(event => {
        // Check both allDay and isAllDay properties to ensure compatibility
        const isAllDayEvent = event.allDay || event.isAllDay;
        const isMultiDayEvent = event.isMultiDay || (!isSameDay(new Date(event.start), new Date(event.end)));
  
        if (isAllDayEvent || isMultiDayEvent) {
          const eventStart = new Date(event.start);
          const eventEnd = new Date(event.end);
  
          // Check if the event overlaps with our week view
          if (eventEnd >= weekStart && eventStart < weekEnd) {
            // Calculate the day index where this event starts and ends in our week view
            const startDayIndex = Math.max(0, Math.floor((eventStart - weekStart) / (24 * 60 * 60 * 1000)));
            const endDayIndex = Math.min(6, Math.floor((eventEnd - weekStart) / (24 * 60 * 60 * 1000)));
  
            multiDayEvents.push({
              ...event,
              startDayIndex,
              endDayIndex,
              span: endDayIndex - startDayIndex + 1
            });
          }
        }
      });
  
      // Group multi-day events by row to avoid overlaps
      const eventRows = [];
  
      // Sort multi-day events by duration (longest first) to optimize layout
      multiDayEvents.sort((a, b) => b.span - a.span);
  
      // Assign each event to a row where it fits
      multiDayEvents.forEach(event => {
        let rowIndex = 0;
        let placed = false;
  
        while (!placed) {
          // Create new row if needed
          if (!eventRows[rowIndex]) {
            eventRows[rowIndex] = [];
          }
  
          // Check if event can be placed in this row
          const canPlaceInRow = !eventRows[rowIndex].some(existingEvent => {
            return (event.startDayIndex <= existingEvent.endDayIndex && 
                    event.endDayIndex >= existingEvent.startDayIndex);
          });
  
          if (canPlaceInRow) {
            eventRows[rowIndex].push(event);
            placed = true;
          } else {
            rowIndex++;
          }
        }
      });
  
      // Calculate the total minimum height needed for the all-day section
      const numRows = eventRows.length > 0 ? eventRows.length : 1; // Ensure at least 1 row
  
      return (
        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border/50 dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          {/* Use explicit grid-template-rows based on calculated rows */}
          <div 
            className="relative grid grid-cols-7" 
            style={{ gridTemplateRows: `repeat(${numRows}, minmax(24px, auto))` }}
          >
            {/* Render the grid background cells - ensure it has a base height */}
            {Array.from({ length: 7 * numRows }).map((_, index) => (
              <div
                key={`bg-cell-${index}`}
                className={`border-l border-light-border/50 dark:border-dark-border`}
                style={{ gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 }}
              />
            ))}
  
            {/* First render the single-day all-day events within their respective columns (assuming they fit in row 1 for now) */}
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const currentDate = addDays(weekStart, dayIndex);
              const dayEvents = allItems.filter((event) => {
                const isAllDayEvent = event.allDay || event.isAllDay;
                const eventStart = new Date(event.start);
                const eventEnd = new Date(event.end);
                const isSingleDay = isSameDay(eventStart, eventEnd) || (eventEnd.getTime() - eventStart.getTime() < 24 * 60 * 60 * 1000);
                return isAllDayEvent && isSingleDay && isSameDay(eventStart, currentDate) && !multiDayEvents.some(e => e.id === event.id);
              });
  
              return (
                <div
                  key={`day-col-${dayIndex}`}
                  className="relative p-1 flex flex-col gap-1 overflow-hidden z-10"
                  style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                >
                  {dayEvents.map((event) => {
                    const now = new Date();
                    const isPastEvent = new Date(event.end) < now;
                    const isTask = event.isTask;
  
                    return (
                      <TooltipProvider key={event.id} delayDuration={2000}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              // key={event.id} // Key moved to TooltipProvider
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isTask) {
                                  // Handle task click - open task edit modal
                                  if (handleTaskEdit) {
                                    handleTaskEdit(event.originalTask);
                                  } else if (commandBarRef?.current?.openForTaskEdit) {
                                    commandBarRef.current.openForTaskEdit(event.originalTask);
                                  }
                                } else {
                                  handleEventClick(event);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onContextMenu={(e) => {
                                if (isTask) {
                                  handleTaskContextMenu(e, event.originalTask);
                                } else {
                                  handleEventContextMenu(e, event.id);
                                }
                              }}
                              className={`flex items-center text-xs cursor-pointer hover:bg-black/5 select-none dark:hover:bg-white/5 rounded-[5px] overflow-hidden ${
                                isTask ? 'border-2 border-dashed' : ''
                              }`}
                              style={{
                                backgroundColor: isTask 
                                  ? undefined
                                  : (event.color ? `${event.color}20` : "#80808020"),
                                opacity: isPastEvent ? 0.5 : 1,

                              }}
                            >
                              {!isTask && (
                                <div
                                  className="w-1 self-stretch"
                                  style={{ backgroundColor: event.color || "#808080" }}
                                />
                              )}
                              <div className="px-2 py-1 truncate">
                                <div className="font-medium text-xs truncate flex items-center gap-1">
                                  {isTask && (
                                    <Checkbox 
                                      checked={event.originalTask?.completed || false}
                                      onChange={() => {
                                        if (handleToggleTaskCompletion && event.originalTask) {
                                          handleToggleTaskCompletion(event.originalTask, 'single');
                                        }
                                      }}
                                    />
                                  )}
                                  {event.title}
                                </div>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start">
                            {isTask ? (
                              <div className="text-xs">
                                <div className="font-medium">{event.title}</div>
                                {event.originalTask.notes && (
                                  <div className="text-gray-400 mt-1">{event.originalTask.notes}</div>
                                )}
                                <div className="text-gray-400 mt-1">Task</div>
                              </div>
                            ) : (
                              <EventTooltipContent event={event} />
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              );
            })}
  
            {/* Then render the multi-day events spanning across columns */}
            {eventRows.map((row, rowIndex) => {
              return row.map((event) => {
                const now = new Date();
                const isPastEvent = new Date(event.end) < now;
                
                // Grid positioning and dynamic colors that can't be done with Tailwind
                const eventStyle = {
                  gridColumnStart: event.startDayIndex + 1,
                  gridColumnEnd: event.endDayIndex + 2, // Span includes the end day
                  gridRowStart: rowIndex + 1,
                  backgroundColor: event.isTask 
                    ? undefined
                    : (event.color ? `${event.color}20` : undefined),
                };
                
                // Tailwind classes for styling
                const eventClasses = `relative flex items-center text-xs mx-1 mt-1 mb-1 cursor-pointer select-none overflow-hidden z-10 ${
                  event.isTask 
                    ? `border border-dashed rounded-[5px] py-2 px-1 border-gray-300 dark:border-gray-600 dark:bg-gray-800/80 backdrop-blur-sm hover:bg-gray-100/90 dark:hover:bg-light-bg `
                    : `backdrop-blur-md rounded-[5px] hover:bg-black/10 dark:hover:bg-white/10`
                } ${
                  isPastEvent ? 'opacity-50' : ''
                }`.trim();
  
                return (
                  <TooltipProvider key={event.id} delayDuration={2000}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          // key={event.id} // Key moved to TooltipProvider
                          className={eventClasses}
                          style={eventStyle}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (event.isTask) {
                              // Handle task click - open task edit modal
                              if (handleTaskEdit) {
                                handleTaskEdit(event.originalTask);
                              } else if (commandBarRef?.current?.openForTaskEdit) {
                                commandBarRef.current.openForTaskEdit(event.originalTask);
                              }
                            } else {
                              handleEventClick(event);
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering cell click
                          }}
                          onContextMenu={(e) => {
                            if (event.isTask) {
                              handleTaskContextMenu(e, event.originalTask);
                            } else {
                              handleEventContextMenu(e, event.id);
                            }
                          }}
                        >
                          {!event.isTask && (
                            <div
                              className="w-1 self-stretch"
                              style={{ backgroundColor: event.color || "#808080" }}
                            />
                          )}
                          <div className="px-1 truncate justify-between flex flex-1 items-center">
                            <div className="flex flex-row gap-2 items-center">
                            {event.isTask && (
                              <Checkbox 
                                checked={event.originalTask?.completed || false}
                                onChange={() => {
                                  if (handleToggleTaskCompletion && event.originalTask) {
                                    handleToggleTaskCompletion(event.originalTask, 'single');
                                  }
                                }}
                              />
                            )}
                            <div className="font-medium text-xs truncate">
                              {event.title}
                            </div>
                            </div>
                            <div className="flex items-center gap-1 ml-auto">
                               {((event.originalTask?.repeat && event.originalTask.repeat !== 'none') || (event.originalTask?.seriesId && event.originalTask?.originalBaseId)) && (
                                 <TooltipProvider>
                                   <Tooltip delayDuration={0}>
                                     <TooltipTrigger asChild>
                                       <div className="inline-flex items-center justify-center w-[16px] h-[16px] border border-light-border dark:border-dark-border text-xs rounded-[3px] bg-white dark:bg-dark-bg-light text-blue-500">
                                         <Repeat className="w-2.5 h-2.5" />
                                       </div>
                                     </TooltipTrigger>
                                     <TooltipContent>
                                       <p>Repeats {(() => {
                                         if (event.originalTask.repeat && event.originalTask.repeat !== 'none') {
                                           return event.originalTask.repeat;
                                         }
                                         // For task instances, find the base task to get repeat pattern
                                         if (event.originalTask.originalBaseId) {
                                           const savedTasks = localStorage.getItem('tasks');
                                           if (savedTasks) {
                                             const tasks = JSON.parse(savedTasks);
                                             const baseTask = tasks.all?.find(t => t.id === event.originalTask.originalBaseId);
                                             return baseTask?.repeat || 'unknown';
                                           }
                                         }
                                         return 'unknown';
                                       })()}</p>
                                     </TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               )}
                               {event.originalTask?.tag && (
                                 <TooltipProvider>
                                   <Tooltip delayDuration={0}>
                                     <TooltipTrigger asChild>
                                       <div className="inline-flex items-center justify-center w-[16px] h-[16px] bg-white dark:bg-dark-bg-light border border-light-border dark:border-dark-border text-xs rounded-[3px]">
                                         <Tag className="w-2.5 h-2.5" style={{ color: event.originalTask.tag.color }} />
                                       </div>
                                     </TooltipTrigger>
                                     <TooltipContent>
                                       <p>{event.originalTask.tag.label}</p>
                                     </TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               )}
                             </div>
                          </div>
                          {/* Add resize handles if needed in the future */}
                        </div>
                      </TooltipTrigger>
                      {!event.isTask && (
                        <TooltipContent side="top" align="start">
                          <EventTooltipContent event={event} />
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                );
              });
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
                (event) => {
                  // Check both allDay and isAllDay properties to ensure compatibility
                  const isAllDayEvent = event.allDay || event.isAllDay;
                  const isMultiDayEvent = event.isMultiDay || (!isSameDay(new Date(event.start), new Date(event.end)));
  
                  // Include both all-day events and multi-day events that overlap with the selected date
                  const eventStart = new Date(event.start);
                  const eventEnd = new Date(event.end);
                  const selectedDateObj = new Date(selectedDate);
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(nextDay.getDate() + 1);
  
                  return (isAllDayEvent || isMultiDayEvent) && 
                         eventEnd >= selectedDateObj && 
                         eventStart < nextDay;
                }
              )
              .map((event) => {
                const now = new Date();
                const isPastEvent = new Date(event.end) < now;
  
                return (
                  <TooltipProvider key={event.id} delayDuration={2000}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          // key={event.id} // Key moved to TooltipProvider
                          className={`z-10 overflow-hidden cursor-pointer ${
                            event.isTask 
                              ? `border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg hover:bg-gray-100/90 dark:hover:bg-gray-700/90 hover:border-primary hover:ring-2 hover:ring-primary/20`
                              : `bg-primary/5 backdrop-blur-md rounded-[9px] hover:ring-2 hover:ring-white/10`
                          }`}
                          style={{
                            backgroundColor: event.isTask
                              ? undefined
                              : (event.color ? `${event.color}20` : "#80808020"),
                            opacity: isPastEvent ? 0.5 : 1
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (event.isTask) {
                              // Handle task click
                              if (handleTaskEdit) {
                                handleTaskEdit(event.originalTask);
                              } else if (commandBarRef?.current?.openForTaskEdit) {
                                commandBarRef.current.openForTaskEdit(event.originalTask);
                              }
                            } else {
                              handleEventClick(event);
                            }
                          }}
                          onContextMenu={(e) => {
                            if (event.isTask) {
                              handleTaskContextMenu(e, event.originalTask);
                            } else {
                              handleEventContextMenu(e, event.id);
                            }
                          }}
                        >
                          {!event.isTask && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1"
                              style={{ backgroundColor: event.color || "#808080" }}
                            />
                          )}
                          {event.isTask && event.color && (
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                              style={{ backgroundColor: event.color }}
                            />
                          )}
                          <div className="px-2 py-1 relative">
                            <div className="font-medium text-xs flex items-center gap-1">
                              {event.isTask && (
                                <Checkbox 
                                  checked={event.originalTask?.completed || false}
                                  onChange={() => {
                                    if (handleToggleTaskCompletion && event.originalTask) {
                                      handleToggleTaskCompletion(event.originalTask, 'single');
                                    }
                                  }}
                                />
                              )}
                              {event.title}
                              <div className="flex items-center gap-1 ml-auto">
                                 {((event.originalTask?.repeat && event.originalTask.repeat !== 'none') || (event.originalTask?.seriesId && event.originalTask?.originalBaseId)) && (
                                   <TooltipProvider>
                                     <Tooltip delayDuration={0}>
                                       <TooltipTrigger asChild>
                                         <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500">
                                           <Repeat className="w-2.5 h-2.5" />
                                         </div>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <p>Repeats {(() => {
                                           if (event.originalTask.repeat && event.originalTask.repeat !== 'none') {
                                             return event.originalTask.repeat;
                                           }
                                           // For task instances, find the base task to get repeat pattern
                                           if (event.originalTask.originalBaseId) {
                                             const savedTasks = localStorage.getItem('tasks');
                                             if (savedTasks) {
                                               const tasks = JSON.parse(savedTasks);
                                               const baseTask = tasks.all?.find(t => t.id === event.originalTask.originalBaseId);
                                               return baseTask?.repeat || 'unknown';
                                             }
                                           }
                                           return 'unknown';
                                         })()}</p>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                 )}
                                 {event.originalTask?.tag && (
                                   <TooltipProvider>
                                     <Tooltip delayDuration={0}>
                                       <TooltipTrigger asChild>
                                         <div className="inline-flex items-center px-1 h-[16px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px]">
                                           <Tag className="w-2.5 h-2.5" style={{ color: event.originalTask.tag.color }} />
                                         </div>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                         <p>{event.originalTask.tag.label}</p>
                                       </TooltipContent>
                                     </Tooltip>
                                   </TooltipProvider>
                                 )}
                               </div>
                            </div>
                            {event.isMultiDay && (
                              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                                {format(new Date(event.start), "MMM d")} - {format(new Date(event.end), "MMM d")}
                              </div>
                            )}
                          </div>
                        </div>
                      </TooltipTrigger>
                      {!event.isTask && (
                        <TooltipContent side="top" align="start">
                          <EventTooltipContent event={event} />
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
          </div>
        </div>
      </div>
    );
  }, [events, selectedDate, viewType, handleEventClick, handleEventContextMenu, commandBarRef, taskUpdateTrigger]);

  // Task Context Menu Popover Component
  const TaskContextMenuPopover = () => {
    if (!taskContextMenu.isOpen || !taskContextMenu.task) return null;

    const handleClose = () => {
      setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
    };

    const handleEdit = () => {
      handleTaskEditFromMenu(taskContextMenu.task);
      handleClose();
    };

    const handleDelete = () => {
      handleTaskDeleteInternal(taskContextMenu.task);
      handleClose();
    };

    return (
      <>
        <AnimatePresence>
          {taskContextMenu.isOpen && (
            <>
              {/* Backdrop to close menu when clicking outside */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={handleClose}
              />
              {/* Context Menu */}
              <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 w-auto p-1 min-w-[120px] bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border"
            style={{
              left: taskContextMenu.position.x,
              top: taskContextMenu.position.y,
            }}
          >
            <div className="flex flex-col gap-1">
              <button
                onClick={handleEdit}
                className="w-full px-2 py-1 text-xs text-dark-text dark:text-dark-text rounded-[5px] flex items-center gap-2 hover:bg-white/15 dark:hover:bg-white/5"
              >
                <Pencil className="w-3 h-3 text-dark-text dark:text-dark-text" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white text-[#EC0F0F]"
              >
                <Trash className="w-3 h-3" />
                Delete
              </button>
            </div>
           </motion.div>
             </>
           )}
         </AnimatePresence>

      </>
    );
  };

  return {
    renderEvents,
    renderAllDayEvents,
    TaskContextMenuPopover,
  };
}
