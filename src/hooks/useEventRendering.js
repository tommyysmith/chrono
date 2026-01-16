import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, addDays } from "date-fns";

import { ViewType } from "../constants/views";
import { findOverlappingGroup, getEventStyle } from "@/utils/eventUtils";
import EventItem from "@/components/EventItem";
import TaskEventItem from "@/components/TaskEventItem";
import AllDayEventItem from "@/components/AllDayEventItem";
import EnhancedTaskContextMenu from "@/components/EnhancedTaskContextMenu";
import { useEventFiltering } from "./useEventFiltering";


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
  handleTaskDelete = null,
  selectedEventId = null,
  setSelectedEventId = null
) => {
  const [taskUpdateTrigger, setTaskUpdateTrigger] = useState(0);
  const [tagUpdateKey, setTagUpdateKey] = useState(0);
  const [taskContextMenu, setTaskContextMenu] = useState({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  const [currentDefaultColor, setCurrentDefaultColor] = useState('#F59E0B');

  // Initialize and listen for default event color updates
  useEffect(() => {
    // Set initial value from localStorage after hydration
    setCurrentDefaultColor(localStorage.getItem('defaultEventColor') || '#F59E0B');

    const handleDefaultColorUpdate = () => {
      setCurrentDefaultColor(localStorage.getItem('defaultEventColor') || '#F59E0B');
    };

    window.addEventListener('default-event-color-updated', handleDefaultColorUpdate);
    return () => window.removeEventListener('default-event-color-updated', handleDefaultColorUpdate);
  }, []);

  // Helper function to get fresh tag data from localStorage
  const getFreshTagData = useCallback((tagId) => {
    try {
      const tags = JSON.parse(localStorage.getItem('tags') || '{}');
      return tags[tagId] || null;
    } catch (e) {
      return null;
    }
  }, [tagUpdateKey]); // Include tagUpdateKey to force re-computation when tags update


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
    // Get current tasks from localStorage
    const savedTasks = localStorage.getItem('tasks');
    if (!savedTasks) {
      setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
      return;
    }

    const updatedTasks = JSON.parse(savedTasks);
    
    // Check if this is a recurring task instance
    if (task.isRepeat === true && task.originalBaseId) {
      // For recurring task instances, handle based on series
      const baseTask = Object.values(updatedTasks).flat().find(t => t.id === task.originalBaseId);
      
      if (baseTask) {
        // Create an exclusion for this specific instance
        if (!baseTask.excludedDates) {
          baseTask.excludedDates = [];
        }
        
        // Add the scheduled date as an exclusion
        if (task.scheduledDate && !baseTask.excludedDates.includes(task.scheduledDate)) {
          baseTask.excludedDates.push(task.scheduledDate);
        }
        
        // Update the base task in localStorage
        Object.keys(updatedTasks).forEach(key => {
          if (Array.isArray(updatedTasks[key])) {
            updatedTasks[key] = updatedTasks[key].map(t => 
              t.id === baseTask.id ? baseTask : t
            );
          }
        });
        
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
        window.dispatchEvent(event);
        // Task update handled by parent component
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
        // Task update handled by parent component
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
      // Task update handled by parent component
    }
    
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, []);

  const handleRemoveFromCalendar = useCallback((task) => {
    // Get current tasks from localStorage
    const savedTasks = localStorage.getItem('tasks');
    if (!savedTasks) {
      setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
      return;
    }

    const updatedTasks = JSON.parse(savedTasks);
    
    // Update the task to remove calendar information (keep scheduledDate but remove time component)
    const updatedTask = {
      ...task,
      addToCalendar: false,
      duration: null,
      updatedAt: new Date().toISOString()
    };
    
    // If there's a scheduledDate, reset it to midnight to remove time component
    if (task.scheduledDate) {
      const dateOnly = new Date(task.scheduledDate);
      dateOnly.setHours(0, 0, 0, 0);
      updatedTask.scheduledDate = dateOnly.toISOString();
    }
    
    // Update the task in all collections
    Object.keys(updatedTasks).forEach(key => {
      if (Array.isArray(updatedTasks[key])) {
        updatedTasks[key] = updatedTasks[key].map(t => 
          t.id === task.id ? updatedTask : t
        );
      }
    });
    
    // Save to localStorage
    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
    
    // Dispatch events for UI updates
    const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
    window.dispatchEvent(event);
    window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { tasks: updatedTasks } }));
    
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, []);

  const handleTaskUpdate = useCallback((updatedTask) => {
    // Get current tasks from localStorage
    const savedTasks = localStorage.getItem('tasks');
    if (!savedTasks) return;

    const tasks = JSON.parse(savedTasks);
    
    // Update the task in all collections
    Object.keys(tasks).forEach(key => {
      if (Array.isArray(tasks[key])) {
        tasks[key] = tasks[key].map(t => 
          t.id === updatedTask.id ? updatedTask : t
        );
      }
    });
    
    // Save to localStorage
    localStorage.setItem('tasks', JSON.stringify(tasks));
    
    // Dispatch events for UI updates
    const event = new CustomEvent('tasks-updated', { detail: tasks });
    window.dispatchEvent(event);
    window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { tasks } }));
  }, []);

  const { filterEventsForView, getTaskEventsForView, isEventPast: isEventPastUtil } = useEventFiltering();

  // Listen for task updates to refresh the calendar
  useEffect(() => {
    const handleTaskUpdate = () => {
      // Use setTimeout to avoid React state update during render
      setTimeout(() => {
        setTaskUpdateTrigger(prev => prev + 1);
      }, 0);
    };

    // Listen for tags-updated events to refresh tag display only
    const handleTagsUpdated = () => {
      setTagUpdateKey(prev => prev + 1);
    };

    window.addEventListener('storage', handleTaskUpdate);
    window.addEventListener('tasksUpdated', handleTaskUpdate);
    window.addEventListener('tasks-updated', handleTaskUpdate);
    window.addEventListener('tags-updated', handleTagsUpdated);

    return () => {
      window.removeEventListener('storage', handleTaskUpdate);
      window.removeEventListener('tasksUpdated', handleTaskUpdate);
      window.removeEventListener('tasks-updated', handleTaskUpdate);
      window.removeEventListener('tags-updated', handleTagsUpdated);
    };
  }, []);

  // Pre-compute filtered events and styles with useMemo for performance
  const { filteredEvents, eventStylesMap } = useMemo(() => {
    const { filteredEvents } = filterEventsForView(events, selectedDate, viewType, currentDefaultColor);
    
    // Pre-compute all event styles to avoid O(n²) on each render
    const stylesMap = new Map();
    for (const event of filteredEvents) {
      const overlappingEvents = findOverlappingGroup(event, filteredEvents);
      stylesMap.set(event.id, getEventStyle(event, overlappingEvents, viewType));
    }
    
    return { filteredEvents, eventStylesMap: stylesMap };
  }, [events, selectedDate, viewType, currentDefaultColor, filterEventsForView, taskUpdateTrigger]);

  // Memoize click handlers outside of render to prevent recreation
  const handleEventSingleClick = useCallback((event) => {
    if (event.isTask || event.isTaskBlock) {
      if (handleTaskEdit) {
        handleTaskEdit(event.originalTask);
      } else if (commandBarRef?.current?.openForTaskEdit) {
        commandBarRef.current.openForTaskEdit(event.originalTask);
      }
    } else {
      // Use requestAnimationFrame to defer state updates and improve INP
      requestAnimationFrame(() => {
        if (setSelectedEventId) {
          setSelectedEventId(event.id);
        }
        handleEventClick(event);
      });
    }
  }, [handleTaskEdit, commandBarRef, setSelectedEventId, handleEventClick]);

  const handleEventDoubleClick = useCallback((event) => {
    // Double-click is now a no-op since single-click handles selection
  }, []);

  const handleEventContextMenuClick = useCallback((e, event) => {
    if (event.isTask || event.isTaskBlock) {
      handleTaskContextMenu(e, event.originalTask);
    } else {
      handleEventContextMenu(e, event.id);
    }
  }, [handleTaskContextMenu, handleEventContextMenu]);

  const renderEvents = useCallback(() => {
    return filteredEvents.map((event) => {
      const eventStyle = eventStylesMap.get(event.id);

      if (event.isTask || event.isTaskBlock) {
        return (
          <TaskEventItem
            key={event.id}
            event={event}
            eventStyle={eventStyle}
            viewType={viewType}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDoubleClick={handleEventDoubleClick}
            onContextMenu={handleEventContextMenuClick}
            onResizeStart={handleResizeStart}
            onToggleTaskCompletion={handleToggleTaskCompletion}
            getFreshTagData={getFreshTagData}
          />
        );
      }

      return (
        <EventItem
          key={event.id}
          event={event}
          eventStyle={eventStyle}
          viewType={viewType}
          dragState={dragState}
          onDragStart={handleDragStart}
          onClick={handleEventSingleClick}
          onDoubleClick={handleEventDoubleClick}
          onContextMenu={handleEventContextMenuClick}
          onResizeStart={handleResizeStart}
          isSelected={selectedEventId === event.id}
        />
      );
    });
  }, [
    filteredEvents,
    eventStylesMap,
    viewType,
    dragState,
    handleDragStart,
    handleEventSingleClick,
    handleEventDoubleClick,
    handleEventContextMenuClick,
    handleResizeStart,
    handleToggleTaskCompletion,
    tagUpdateKey,
    getFreshTagData,
    selectedEventId,
  ]);



  const renderAllDayEvents = useMemo(() => () => {
    // Only include regular events, NOT tasks in all-day section
    const allItems = [...events];

    const handleEventDoubleClick = (event) => {
      if (event.isTask || event.isTaskBlock) {
        if (handleTaskEdit) {
          handleTaskEdit(event.originalTask);
        } else if (commandBarRef?.current?.openForTaskEdit) {
          commandBarRef.current.openForTaskEdit(event.originalTask);
        }
      } else {
        handleEventClick(event);
      }
    };

    const handleEventContextMenuClick = (e, event) => {
      if (event.isTask || event.isTaskBlock) {
        handleTaskContextMenu(e, event.originalTask);
      } else {
        handleEventContextMenu(e, event.id);
      }
    };

    if (viewType === ViewType.WEEK) {
      return renderWeekAllDayEvents(allItems, selectedDate, handleEventDoubleClick, handleEventContextMenuClick);
    }

    if (viewType === ViewType.DAY) {
      return renderDayAllDayEvents(allItems, selectedDate, handleEventDoubleClick, handleEventContextMenuClick);
    }

    return null;
  }, [events, selectedDate, viewType, handleEventClick, handleEventContextMenu, commandBarRef, taskUpdateTrigger, tagUpdateKey, currentDefaultColor]);

  const renderWeekAllDayEvents = useCallback((allItems, selectedDate, handleEventDoubleClick, handleEventContextMenuClick) => {
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Process multi-day events to determine their span across the week
    const multiDayEvents = [];

    // First, identify multi-day events that span across days
    allItems.forEach(event => {
      const isAllDayEvent = event.allDay || event.isAllDay;
      const isMultiDayEvent = event.isMultiDay || (!isSameDay(new Date(event.start), new Date(event.end)));

      if (isAllDayEvent || isMultiDayEvent) {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Check if the event overlaps with our week view
        if (eventEnd >= weekStart && eventStart < weekEnd) {
          const startDayIndex = Math.max(0, Math.floor((eventStart - weekStart) / (24 * 60 * 60 * 1000)));
          const adjustedEventEnd = new Date(eventEnd.getTime() - 1);
          const endDayIndex = Math.min(6, Math.floor((adjustedEventEnd - weekStart) / (24 * 60 * 60 * 1000)));

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
    multiDayEvents.sort((a, b) => b.span - a.span);

    multiDayEvents.forEach(event => {
      let rowIndex = 0;
      let placed = false;

      while (!placed) {
        if (!eventRows[rowIndex]) {
          eventRows[rowIndex] = [];
        }

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

    const numRows = eventRows.length > 0 ? eventRows.length : 1;

    return (
      <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border/50 dark:border-dark-border">
        <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
          All-day
        </div>
        <div 
          className="relative grid grid-cols-7" 
          style={{ gridTemplateRows: `repeat(${numRows}, minmax(24px, auto))` }}
        >
          {/* Grid background cells */}
          {Array.from({ length: 7 * numRows }).map((_, index) => (
            <div
              key={`bg-cell-${index}`}
              className="border-l border-light-border/50 dark:border-dark-border"
              style={{ gridColumn: (index % 7) + 1, gridRow: Math.floor(index / 7) + 1 }}
            />
          ))}

          {/* Single-day all-day events */}
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
                {dayEvents.map((event) => (
                  <AllDayEventItem
                    key={event.id}
                    event={event}
                    onDoubleClick={handleEventDoubleClick}
                    onContextMenu={handleEventContextMenuClick}
                    onToggleTaskCompletion={handleToggleTaskCompletion}
                    getFreshTagData={getFreshTagData}
                    isEventPast={isEventPastUtil}
                  />
                ))}
              </div>
            );
          })}

          {/* Multi-day events spanning across columns */}
          {eventRows.map((row, rowIndex) => {
            return row.map((event) => {
              const eventStyle = {
                gridColumnStart: event.startDayIndex + 1,
                gridColumnEnd: event.endDayIndex + 2,
                gridRowStart: rowIndex + 1,
                backgroundColor: event.isTask ? undefined : (event.color ? `${event.color}20` : undefined),
              };

              return (
                <div key={event.id} style={eventStyle}>
                  <AllDayEventItem
                    event={event}
                    onDoubleClick={handleEventDoubleClick}
                    onContextMenu={handleEventContextMenuClick}
                    onToggleTaskCompletion={handleToggleTaskCompletion}
                    getFreshTagData={getFreshTagData}
                    isEventPast={isEventPastUtil}
                  />
                </div>
              );
            });
          })}
        </div>
      </div>
    );
  }, [handleToggleTaskCompletion, getFreshTagData, isEventPastUtil]);

  const renderDayAllDayEvents = useCallback((allEventsAndTasks, selectedDate, handleEventDoubleClick, handleEventContextMenuClick) => {
    const filteredEvents = allEventsAndTasks.filter((event) => {
      const isAllDayEvent = event.allDay || event.isAllDay;
      const isMultiDayEvent = event.isMultiDay || (!isSameDay(new Date(event.start), new Date(event.end)));

      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      const selectedDateObj = new Date(selectedDate);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      return (isAllDayEvent || isMultiDayEvent) && 
             eventEnd >= selectedDateObj && 
             eventStart < nextDay;
    });

    return (
      <div className="flex flex-col p-1">
        {filteredEvents.map((event) => {
          let eventWithMultiDayInfo = { ...event };
          if (event.isMultiDay) {
            eventWithMultiDayInfo.multiDayText = `${format(new Date(event.start), "MMM d")} - ${format(new Date(event.end), "MMM d")}`;
          }

          return (
            <AllDayEventItem
              key={event.id}
              event={eventWithMultiDayInfo}
              onDoubleClick={handleEventDoubleClick}
              onContextMenu={handleEventContextMenuClick}
              onToggleTaskCompletion={handleToggleTaskCompletion}
              getFreshTagData={getFreshTagData}
              isEventPast={isEventPastUtil}
            />
          );
        })}
      </div>
    );
  }, [handleToggleTaskCompletion, getFreshTagData, isEventPastUtil]);

  // Enhanced context menu handlers
  const handleMarkAsDone = useCallback((task) => {
    if (handleToggleTaskCompletion) {
      handleToggleTaskCompletion(task, 'single');
    }
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, [handleToggleTaskCompletion]);

  const handlePriorityChange = useCallback((task, priority) => {
    if (handleTaskUpdate) {
      const updatedTask = {
        ...task,
        priority: priority,
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      handleTaskUpdate(updatedTask);
    }
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, [handleTaskUpdate]);

  const handleTagChange = useCallback((task, tag) => {
    if (handleTaskUpdate) {
      const updatedTask = {
        ...task,
        tag: tag, // Store the full tag object, not just the ID
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      handleTaskUpdate(updatedTask);
    }
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, [handleTaskUpdate]);

  const handleScheduleChange = useCallback((task, dateOrOption) => {
    if (handleTaskUpdate) {
      let scheduledDate = null;
      
      if (dateOrOption === 'custom') {
        // For now, just open the edit dialog - could enhance with date picker later
        if (handleTaskEdit) {
          handleTaskEdit(task);
        } else if (commandBarRef?.current?.openForTaskEdit) {
          commandBarRef.current.openForTaskEdit(task);
        }
        setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
        return;
      } else if (dateOrOption instanceof Date) {
        // Keep the date but set time to midnight (00:00) for date-only scheduling
        const date = new Date(dateOrOption);
        date.setHours(0, 0, 0, 0);
        scheduledDate = date.toISOString();
      }
      
      const updatedTask = {
        ...task,
        scheduledDate: scheduledDate,
        addToCalendar: false, // Don't automatically add to calendar - user must explicitly set time
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      handleTaskUpdate(updatedTask);
    }
    setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  }, [handleTaskUpdate, handleTaskEdit, commandBarRef]);

  // Task Context Menu Popover Component
  const TaskContextMenuPopover = () => {
    return (
      <EnhancedTaskContextMenu
        isOpen={taskContextMenu.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
          }
        }}
        task={taskContextMenu.task}
        position={taskContextMenu.position}
        onEdit={handleTaskEditFromMenu}
        onDelete={handleTaskDeleteInternal}
        onRemoveFromCalendar={handleRemoveFromCalendar}
        onMarkAsDone={handleMarkAsDone}
        onPriorityChange={handlePriorityChange}
        onTagChange={handleTagChange}
        onScheduleChange={handleScheduleChange}
      >
        {/* Invisible trigger positioned at click coordinates */}
        <div className="fixed w-0 h-0 overflow-hidden" style={{ 
          top: `${taskContextMenu.position.y}px`, 
          left: `${taskContextMenu.position.x}px` 
        }} />
      </EnhancedTaskContextMenu>
    );
  };

  return {
    renderEvents,
    renderAllDayEvents,
    TaskContextMenuPopover,
  };
}
