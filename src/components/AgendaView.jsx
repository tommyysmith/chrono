'use client';

import { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { format, isToday, isSameDay, startOfWeek, endOfWeek, isWithinInterval, addDays, parseISO, isAfter } from 'date-fns';
import { useTaskManagement } from '../hooks/useTaskManagement';
import { Repeat } from '../assets/icons/Repeat';
import { Chevron } from '../assets/icons/Chevron';
import { Return } from '../assets/icons/Return';
import { Task } from '../assets/icons/Task';
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';
import { Anytime } from '../assets/icons/Anytime';
import { Clock } from '../assets/icons/Clock';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import TaskItem from './TaskItem';
import Checkbox from './Checkbox';
import 'react-day-picker/dist/style.css';

const dayPickerStyles = {
  day_today: "!bg-primary hover:!text-light-text dark:hover:!text-dark-text !border !border-none !text-white !rounded-[5px] !h-7 !w-7",
  day: "!h-7 !w-7 !p-0 !font-normal !text-light-text dark:!text-dark-text [&:not(.rdp-day_today)]:hover:!bg-black/10 [&:not(.rdp-day_today)]:dark:hover:!bg-white/5 !rounded-[5px]",
  day_selected: "!bg-dark-bg-lighter  hover:!text-light-text dark:hover:!text-dark-text dark:!bg-white/15 !border !border-dark-border dark:border-dark-border !text-white !font-semibold dark:text-dark-text rounded-[5px]",
};

const EventItem = memo(({ event }) => {
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const bgColor = event.color || '#3B82F6';
  const now = new Date();
  const isPastEvent = endTime < now;
  
  // Calculate duration in minutes
  const durationMs = endTime - startTime;
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  
  // Format duration text
  const getDurationText = () => {
    if (durationMinutes < 60) {
      return `${durationMinutes}m`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  };
  
  return (
    <div className="flex items-start relative" style={{ opacity: isPastEvent ? 0.5 : 1 }}>
      {/* Left color bar container - same width as checkbox */}
      <div className="absolute left-0 top-0 w-[14px] h-full flex items-start justify-center pt-1">
        {!event.isDraft && (
          <div 
            className="w-[4px] h-full rounded-full"
            style={{ backgroundColor: bgColor }}
          />
        )}
      </div>
      
      {/* Content with padding to accommodate the color bar container */}
      <div className="flex flex-col pl-6">
        <div className="text-sm mb-1 font-semibold" style={{ color: bgColor }}>
          {event.title || 'New Event'}
          
        </div>
        <div className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
          {format(startTime, 'h:mm a')}
        </div>
        <div className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
          {getDurationText()}
        </div>
      </div>
    </div>
  );
});

EventItem.displayName = 'EventItem';

// TaskEventItem component that looks like EventItem but with checkbox
const TaskEventItem = memo(({ task, onToggleTaskCompletion, events }) => {
  // Find the corresponding event from the events array to get the actual time
  const correspondingEvent = events.find(event => 
    (event.isTaskBlock || event.originalTask || event.type === 'task') &&
    event.originalTask?.id === task.id
  );
  
  let taskDate, duration;
  
  if (correspondingEvent) {
    // Use the event's start time and calculate duration from event
    taskDate = new Date(correspondingEvent.start);
    const eventEnd = new Date(correspondingEvent.end);
    duration = Math.floor((eventEnd - taskDate) / (60 * 1000)); // Duration in minutes
  } else {
    // Fallback to task's scheduled date with default time
    taskDate = new Date(task.scheduledDate);
    duration = task.duration || 60; // Default to 1 hour if no duration
  }
  
  const endTime = new Date(taskDate.getTime() + (duration * 60 * 1000));
  const now = new Date();
  const isPastTask = endTime < now;
  
  // Format duration text
  const getDurationText = () => {
    if (duration < 60) {
      return `${duration}m`;
    } else {
      const hours = Math.floor(duration / 60);
      const remainingMinutes = duration % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };
  
  return (
    <div className="flex items-start relative" style={{ opacity: isPastTask ? 0.5 : 1 }}>
      {/* Checkbox instead of color bar */}
      <div className="absolute left-0 top-0 pt-1">
        <Checkbox 
          checked={task.completed || false}
          onChange={() => {
            if (onToggleTaskCompletion) {
              onToggleTaskCompletion(task, 'single');
            }
          }}
        />
      </div>
      
      {/* Content with padding to accommodate the checkbox */}
      <div className="flex flex-col pl-6">
        <div className="text-sm mb-1 font-semibold text-light-text dark:text-dark-text">
          {task.title || 'New Task'}
        </div>
        <div className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
          {format(taskDate, 'h:mm a')}
        </div>
        <div className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
          {getDurationText()}
        </div>
      </div>
    </div>
  );
});

TaskEventItem.displayName = 'TaskEventItem';


const IconLeft = memo(() => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Chevron className="rotate-180 w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>Previous month</TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

const IconRight = memo(() => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div>
          <Chevron className="w-4 h-4" />
        </div>
      </TooltipTrigger>
      <TooltipContent>Next month</TooltipContent>
    </Tooltip>
  </TooltipProvider>
));

IconLeft.displayName = 'IconLeft';
IconRight.displayName = 'IconRight';

export default function AgendaView({ events = [], tasks = [], selectedDate = new Date(), onDateSelect, isWeekView = false, onTaskComplete, onTaskDelete, onTaskEdit, commandBarRef }) {
  // Get task management functions
  const { getRecurringTaskInstances, handleToggleTaskCompletion, ensureActiveRecurringInstances, handleUpdateTask } = useTaskManagement();
  
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [month, setMonth] = useState(selectedDate);
  const [commandBarSelectedTasks, setCommandBarSelectedTasks] = useState(new Set());

  // Sync CommandBar selected tasks with local state using callbacks
  useEffect(() => {
    console.log('[AgendaView] Selection callback useEffect triggered');
    if (commandBarRef?.current?.onSelectionChange) {
      console.log('[AgendaView] Registering selection callback');
      const unsubscribe = commandBarRef.current.onSelectionChange((selectedTaskIds) => {
        console.log('[AgendaView] Selection callback executed with:', selectedTaskIds.length, 'tasks');
        setTimeout(() => {
          setCommandBarSelectedTasks(new Set(selectedTaskIds));
        }, 0);
      });
      
      // Initial sync
      if (commandBarRef?.current?.getSelectedTasks) {
        const selectedTasks = commandBarRef.current.getSelectedTasks();
        console.log('[AgendaView] Initial sync with:', selectedTasks.length, 'tasks');
        setTimeout(() => {
          setCommandBarSelectedTasks(new Set(selectedTasks));
        }, 0);
      }
      
      return () => {
        console.log('[AgendaView] Unregistering selection callback');
        unsubscribe();
      };
    }
  }, []);

  // Sync with selectedDate prop
  useEffect(() => {
    // Only update if the dates are different to prevent loops
    if (!isSameDay(currentDate, selectedDate)) {
      setCurrentDate(selectedDate);
      setMonth(selectedDate);
    }
  }, [selectedDate, currentDate]);

  const isDateInSelectedWeek = useCallback((date) => {
    if (!isWeekView) return false;
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return isWithinInterval(date, { start, end });
  }, [currentDate, isWeekView]);

  const filterTasks = useCallback((date) => {
    console.log(`[AgendaView] Filtering tasks for date: ${format(date, 'yyyy-MM-dd')}`);
    
    // Load all tasks from localStorage to ensure we have the latest
    let storedTasks = {};
    try {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        storedTasks = JSON.parse(savedTasks);
      }
    } catch (e) {
      console.error('Error parsing tasks from localStorage:', e);
      storedTasks = tasks || {};
    }
    
    console.log(`[AgendaView] Processing tasks from localStorage`);
    
    // Use the exact same filtering logic as Sidebar
    const allTasks = Object.values(storedTasks)
      .filter(Array.isArray) // Filter out any non-array values
      .reduce((unique, group) => {
        group.forEach((task) => {
          // Skip completed tasks (they should only appear in the completed tab)
          if (task.completed) {
            return;
          }
          
          // For recurring tasks, we want to handle them specially
          if (task.repeat && task.repeat !== 'none') {
            // For base tasks (isRepeat === false), we should check if there's an active instance
            if (task.isRepeat === false) {
              const hasActiveInstance = Object.values(storedTasks)
                .filter(Array.isArray)
                .some(taskGroup => 
                  taskGroup.some(t => {
                    return t.seriesId === task.seriesId && 
                           t.isRepeat === true && 
                           !t.completed;
                  })
                );
              
              if (hasActiveInstance) {
                return; // Skip the base task if an active instance exists
              }
              
              if (!task.scheduledDate && task.repeat && task.repeat !== 'none') {
                task = {
                  ...task,
                  scheduledDate: new Date().toISOString() 
                };
              }
            }
            
            const existingSeriesInstance = Object.values(unique).find(
              t => t.seriesId === task.seriesId && t.isRepeat && !t.completed
            );
            
            if (existingSeriesInstance) {
              if (task.isRepeat && task.scheduledDate && existingSeriesInstance.scheduledDate) {
                const taskDate = parseISO(task.scheduledDate);
                const existingDate = parseISO(existingSeriesInstance.scheduledDate);
                if (isAfter(existingDate, taskDate)) { // current task is earlier
                  delete unique[existingSeriesInstance.id]; // remove later instance
                  unique[task.id] = task; // add earlier instance
                } else {
                   // existing instance is earlier or same, so keep it and skip current task
                  return; 
                }
              } else if (task.isRepeat) { 
                // if existing is found, and current is an instance, but date issue, prefer existing by default
                return; 
              }
              // If current task is base and existing instance found, base was already skipped if instance active
            } else {
              unique[task.id] = task; // No existing instance, or current task is preferred
            }
            return; // Handled recurring task
          }
          
          // For non-recurring tasks
          unique[task.id] = task;
        });
        return unique;
      }, {});

    const allTasksArray = Object.values(allTasks);
    
    // Now filter for tasks scheduled for this specific date
    const tasksForDate = allTasksArray
      .filter(task => {
        if (!task.scheduledDate) return false;
        
        try {
          const taskDate = new Date(task.scheduledDate);
          return isSameDay(taskDate, date);
        } catch (error) {
          console.error('Error parsing task date:', task.id, error);
          return false;
        }
      })
      .sort((a, b) => a.title.localeCompare(b.title));
    
    console.log(`[AgendaView] Tasks for ${format(date, 'yyyy-MM-dd')}: ${tasksForDate.length}`);
    return tasksForDate;
  }, [tasks]);

  const handleDateSelect = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      // Create a new Date object to ensure we're not passing references
      onDateSelect?.(new Date(date));
      console.log('handleDateSelect called with date:', date);
    }
  }, [onDateSelect]);

  // Unified scheduled items combining events and tasks
  const allScheduledItems = useMemo(() => {
    // Filter out task-events from the events array to avoid duplicates
    // Only show actual calendar events, not tasks converted to events
    const regularEvents = events
      .filter(event => {
        // Skip task-events (tasks that were converted to events)
        if (event.isTaskBlock || event.originalTask || event.type === 'task') {
          return false;
        }
        return isSameDay(new Date(event.start), currentDate);
      })
      .map(event => ({
        ...event,
        itemType: 'event',
        hasTime: true,
        sortTime: new Date(event.start).getTime()
      }));

    const tasks = filterTasks(currentDate);
    console.log(`[AgendaView] Filtered tasks for ${format(currentDate, 'yyyy-MM-dd')}:`, tasks);
    
    const taskItems = tasks.map(task => {
      // Check if this task has an active TaskEventItem in the events array
      // All TaskEventItems are time-scheduled, so if a task has one, it's timed
      const hasActiveTaskEvent = events.some(event => 
        (event.isTaskBlock || event.originalTask || event.type === 'task') &&
        event.originalTask?.id === task.id &&
        isSameDay(new Date(event.start), currentDate)
      );
      
      let sortTime = 0;
      
      console.log(`[AgendaView] Task "${task.title}" - hasActiveTaskEvent: ${hasActiveTaskEvent}`);
      
      if (hasActiveTaskEvent) {
        // Find the corresponding event to get the sort time
        const correspondingEvent = events.find(event => 
          (event.isTaskBlock || event.originalTask || event.type === 'task') &&
          event.originalTask?.id === task.id &&
          isSameDay(new Date(event.start), currentDate)
        );
        
        if (correspondingEvent) {
          sortTime = new Date(correspondingEvent.start).getTime();
          console.log(`[AgendaView] Task "${task.title}" found corresponding event, sortTime: ${sortTime}`);
        }
      }

      return {
        ...task,
        itemType: 'task',
        hasTime: hasActiveTaskEvent,
        sortTime
      };
    });

    const allItems = [...regularEvents, ...taskItems];
    
    // Separate timed and anytime items
    const timedItems = allItems
      .filter(item => item.hasTime)
      .sort((a, b) => a.sortTime - b.sortTime);
    
    const anytimeItems = allItems
      .filter(item => !item.hasTime)
      .sort((a, b) => a.title.localeCompare(b.title));

    console.log(`[AgendaView] AllScheduledItems - Timed: ${timedItems.length}, Anytime: ${anytimeItems.length}`);
    return { timedItems, anytimeItems, totalCount: allItems.length };
  }, [events, filterTasks, currentDate]);
  
  // Force a re-render when tasks change to update the UI
  const forceRefresh = useCallback(() => {
    setCurrentDate(prev => new Date(prev.getTime()));
  }, []);

  // Add an effect to refresh tasks when tasks are updated
  useEffect(() => {
    // Listen for localStorage changes (for cross-tab updates)
    const handleStorageChange = (e) => {
      if (e.key === 'tasks') {
        console.log('[AgendaView] Tasks updated in localStorage, refreshing view');
        forceRefresh();
      }
    };
    
    // Listen for custom task update events (for in-app updates)
    const handleTasksUpdated = (event) => {
      console.log('[AgendaView] Received tasksUpdated event');
      forceRefresh();
    };
    
    // Listen for tags-updated events to refresh task data when tag names change
    const handleTagsUpdated = (event) => {
      console.log('[AgendaView] Received tags-updated event');
      forceRefresh();
    };
    
    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tasksUpdated', handleTasksUpdated);
    window.addEventListener('tags-updated', handleTagsUpdated);
    
    // Listen for specific events from useTaskManagement hook
    window.addEventListener('tasks-updated', handleTasksUpdated);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tasksUpdated', handleTasksUpdated);
      window.removeEventListener('tags-updated', handleTagsUpdated);
      window.removeEventListener('tasks-updated', handleTasksUpdated);
    };
  }, [forceRefresh]);
  
  // Add a function to handle task deletion
  const handleTaskDelete = useCallback((taskId) => {
    console.log(`[AgendaView] Deleting task ${taskId}`);
    
    if (onTaskDelete) {
      onTaskDelete(taskId);
    }
    
    // Force a refresh after deletion
    forceRefresh();
  }, [onTaskDelete, forceRefresh]);
  
  // Note: Task instance generation is handled automatically by useTaskManagement
  // AgendaView delegates to the task management system for all recurring task logic


  return (
    <div className="flex h-full flex-col">
      <TooltipProvider delayDuration={750}>
        {/* Fixed header section with calendar and date */}
        <div className="flex-shrink-0 flex flex-col gap-4">
        <div className="flex px-3 justify-center">
          <DayPicker
            mode="single"
            selected={currentDate}
            month={month}
            onSelect={(date) => {
              if (date) {
                setCurrentDate(date);
                // Ensure we're passing a new Date object to prevent reference issues
                onDateSelect?.(new Date(date));
                console.log('AgendaView date selected:', date);
              }
            }}
            onMonthChange={setMonth}
            className="rounded-md w-[260px] [--week-bg:rgba(0,0,0,0.05)] dark:[--week-bg:rgba(255,255,255,0.05)]"
            showOutsideDays={true}
            classNames={{
              root: "w-full",
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4 w-full",
              caption: "flex justify-between pt-1 relative items-center pr-0 px-2",
              caption_label: "flex items-center gap-1 text-sm font-semibold",
              nav: "flex items-center",
              nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-light-text dark:text-dark-text flex items-center justify-center",
              nav_button_previous: "",
              nav_button_next: "",
              table: "w-full border-collapse space-y-2",
              head_row: "flex w-full justify-between px-1",
              head_cell: "text-light-text/50 dark:text-dark-text/50 rounded-md w-7 font-normal text-[0.8rem] text-center",
              row: "flex w-full justify-between px-1 py-1 [&:has([aria-selected=true])]:bg-black/5 dark:[&:has([aria-selected=true])]:bg-white/5 [&:has([aria-selected=true])]:rounded-[5px]",
              cell: "text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
              day: dayPickerStyles.day,
              day_selected: dayPickerStyles.day_selected,
              day_today: dayPickerStyles.day_today,
              day_outside: "opacity-30 text-light-text dark:text-dark-text",
              day_disabled: "text-light-text/30 dark:text-dark-text/30 opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
            components={{
              IconLeft,
              IconRight,
            }}
            footer={
              !isToday(currentDate) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        const today = new Date();
                        setMonth(today);
                        // Use the inline handler to be consistent
                        setCurrentDate(today);
                        onDateSelect?.(new Date(today));
                        console.log('Today button clicked:', today);
                      }}
                      className="absolute top-[7px] right-[70px] p-1 rounded hover:text-light-text dark:hover:text-dark-text text-light-text/50 dark:text-dark-text/50"
                      aria-label="Return to today"
                    >
                      <Return className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Return to today</TooltipContent>
                </Tooltip>
              )
            }
          />
        </div>

        <div className='flex h-[56px] px-3 mt-2 border-b border-light-border dark:border-dark-border items-center justify-between w-full'>
          <h2 className="text-md font-bold text-light-text dark:text-dark-text">
            {isToday(currentDate) ? 'Today' : format(currentDate, 'EEE d MMM')}
          </h2>
          
          {allScheduledItems.totalCount > 0 && (
            <div className="flex items-center gap-1 text-light-text/50 dark:text-dark-text/50">
              <span className="text-xs">
                {allScheduledItems.totalCount} item{allScheduledItems.totalCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        </div>

        {allScheduledItems.totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 rounded-[9px] py-6 text-center">
            <div className="text-light-text/50 dark:text-dark-text/50 mb-3">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
              Nothing scheduled
            </p>
            <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1 leading-relaxed">
              Schedule an event or task for this date and you will see it here!
            </p> 
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  if (commandBarRef?.current) {
                    commandBarRef.current.openForNewTask(new Date(currentDate));
                  } else {
                    onDateSelect?.(new Date(currentDate));
                  }
                }}
                className="flex mt-3 items-center cursor-pointer flex-row px-3 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text/50 dark:text-dark-text/50 text-xs hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
              >
                Add task
              </button>
              <button 
                onClick={() => {
                  if (commandBarRef?.current) {
                    commandBarRef.current.openForNewEvent(new Date(currentDate));
                  } else {
                    onDateSelect?.(new Date(currentDate));
                  }
                }}
                className="flex mt-3 items-center cursor-pointer flex-row px-3 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text/50 dark:text-dark-text/50 text-xs hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
              >
                Add event
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto scrollbar-hide pt-2">
            <div className="flex flex-col gap-4 px-3 py-2">
              {/* Anytime Items Section - moved to top */}
              {allScheduledItems.anytimeItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  {/* Anytime header */}
                  <div className="flex items-center gap-2 px-1">
                    <Anytime className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                    <span className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
                      Anytime
                    </span>
                  </div>
                  
                  {allScheduledItems.anytimeItems.map((item) => {
                    if (item.itemType === 'event') {
                      return <EventItem key={item.id} event={item} />;
                    } else {
                      return (
                        <TaskItem 
                          key={`agenda-${item.id}`} 
                          task={{
                            ...item,
                            tag: item.tag || null
                          }}
                          hideScheduledDate={true}
                          hideTag={false}
                          showTagIconOnly={true}
                          hideSchedule={true}
                          onComplete={handleToggleTaskCompletion}
                          checked={item.completed}
                          onDelete={handleTaskDelete}
                          onDoubleClickEdit={(task) => {
                            onTaskEdit(task);
                          }}
                          isSelected={commandBarSelectedTasks.has(item.id)}
                          onSelect={(taskId, e, isSelected) => {
                             if (commandBarRef?.current?.selectTask) {
                               commandBarRef.current.selectTask(taskId, e, isSelected);
                             }
                           }}
                          isRecurring={item.repeat && item.repeat !== 'none' || item.isRepeat}
                          onUpdateTask={(updatedTask) => {
                            handleUpdateTask(updatedTask);
                            forceRefresh();
                          }}
                        />
                      );
                    }
                  })}
                </div>
              )}
              
              {/* Timed Items Section */}
              {allScheduledItems.timedItems.length > 0 && (
                <div className="flex flex-col gap-3">
                  {/* Scheduled header */}
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <Clock className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                    <span className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
                      Scheduled
                    </span>
                  </div>
                  
                  {allScheduledItems.timedItems.map((item) => {
                    if (item.itemType === 'event') {
                      return (
                        <div key={item.id} className="px-1">
                          <EventItem event={item} />
                        </div>
                      );
                    } else {
                      return (
                        <div key={`agenda-${item.id}`} className="px-1">
                          <TaskEventItem 
                            task={item}
                            events={events}
                            onToggleTaskCompletion={handleToggleTaskCompletion}
                          />
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </TooltipProvider>
    </div>
  );
}
