import { useCallback, useEffect, useMemo, useState } from "react";
import { format, isSameDay, addDays } from "date-fns";

import { ViewType } from "../constants/views";
import { findOverlappingGroup, getEventStyle } from "@/utils/eventUtils";
import EventItem from "@/components/EventItem";
import TaskEventItem from "@/components/TaskEventItem";
import AllDayEventItem from "@/components/AllDayEventItem";
import TaskContextMenu from "@/components/TaskContextMenu";
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
  handleTaskDelete = null
) => {
  const [taskUpdateTrigger, setTaskUpdateTrigger] = useState(0);
  const [tagUpdateKey, setTagUpdateKey] = useState(0);
  const [taskContextMenu, setTaskContextMenu] = useState({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } });
  const [currentDefaultColor, setCurrentDefaultColor] = useState(() => localStorage.getItem('defaultEventColor') || '#F59E0B');

  // Listen for default event color updates
  useEffect(() => {
    const handleDefaultColorUpdate = () => {
      setCurrentDefaultColor(localStorage.getItem('defaultEventColor') || '#F59E0B');
    };

    window.addEventListener('default-event-color-updated', handleDefaultColorUpdate);
    return () => window.removeEventListener('default-event-color-updated', handleDefaultColorUpdate);
  }, []);

  // Helper function to get fresh tag data from localStorage
  const getFreshTagData = useCallback((tagId) => {
    const tags = JSON.parse(localStorage.getItem('tags') || '{}');
    return tags[tagId] || null;
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
            // Task update handled by parent component
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

  const renderEvents = useCallback(() => {
    const { filteredEvents } = filterEventsForView(events, selectedDate, viewType, currentDefaultColor);

    const handleEventDoubleClick = (event) => {
      if (event.isTask || event.isTaskBlock) {
        // Handle task click - open task edit modal for the original task
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

    return filteredEvents.map((event) => {
      const overlappingEvents = findOverlappingGroup(event, filteredEvents);
      const eventStyle = getEventStyle(event, overlappingEvents, viewType);

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
          onDoubleClick={handleEventDoubleClick}
          onContextMenu={handleEventContextMenuClick}
          onResizeStart={handleResizeStart}
        />
      );
    });
  }, [
    events,
    selectedDate,
    viewType,
    dragState,
    handleDragStart,
    handleEventClick,
    handleEventContextMenu,
    handleResizeStart,
    handleToggleTaskCompletion,
    currentDefaultColor,
    taskUpdateTrigger,
    tagUpdateKey,
    getFreshTagData,
    filterEventsForView,
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

  // Task Context Menu Popover Component
  const TaskContextMenuPopover = () => {
    return (
      <TaskContextMenu
        isOpen={taskContextMenu.isOpen}
        position={taskContextMenu.position}
        task={taskContextMenu.task}
        onEdit={handleTaskEditFromMenu}
        onDelete={handleTaskDeleteInternal}
        onClose={() => setTaskContextMenu({ isOpen: false, taskId: null, task: null, position: { x: 0, y: 0 } })}
      />
    );
  };

  return {
    renderEvents,
    renderAllDayEvents,
    TaskContextMenuPopover,
  };
}
