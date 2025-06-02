'use client';

import { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { format, isToday, isSameDay, startOfWeek, endOfWeek, isWithinInterval, addDays } from 'date-fns';
import { useTaskManagement } from '../hooks/useTaskManagement';
import { Repeat } from '../assets/icons/Repeat';
import { Chevron } from '../assets/icons/Chevron';
import { Return } from '../assets/icons/Return';
import { Task } from '../assets/icons/Task';
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import TaskItem from './TaskItem';
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
      {/* Left color bar - absolute positioned to fill height */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-[4px] rounded-full"
        style={{ backgroundColor: bgColor }}
      />
      
      {/* Content with padding to accommodate the color bar */}
      <div className="flex flex-col pl-4">
        <div className="text-sm mb-1 font-semibold" style={{ color: bgColor }}>
          {event.title}
          
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
  const { getRecurringTaskInstances, handleToggleTaskCompletion, ensureActiveRecurringInstances } = useTaskManagement();
  
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [month, setMonth] = useState(selectedDate);
  const [viewMode, setViewMode] = useState('events'); // 'events' or 'tasks'

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
    
    // Start by loading all tasks from localStorage to ensure we have the latest
    let allTasks = [];
    try {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        const parsedTasks = JSON.parse(savedTasks);
        // Collect all tasks from all collections
        Object.values(parsedTasks)
          .filter(Array.isArray)
          .forEach(group => {
            allTasks.push(...group);
          });
        // Remove duplicates based on id
        allTasks = Array.from(new Map(allTasks.map(task => [task.id, task])).values());
      }
    } catch (e) {
      console.error('Error parsing tasks from localStorage:', e);
      // Fallback to the passed tasks prop
      allTasks = tasks;
    }
    
    console.log(`[AgendaView] Found ${allTasks.length} total tasks in localStorage`);
    
    // Process tasks similar to Sidebar's approach
    const uniqueTasks = allTasks
      .filter(task => !task.completed) // Skip completed tasks
      .reduce((unique, task) => {
        // For recurring tasks, handle them specially
        if (task.repeat && task.repeat !== 'none') {
          // For base tasks (isRepeat === false), check if there's an active instance
          if (task.isRepeat === false) {
            const hasActiveInstance = allTasks.some(t => 
              t.seriesId === task.seriesId && 
              t.isRepeat === true && 
              !t.completed
            );
            
            if (hasActiveInstance) {
              return unique; // Skip the base task if an active instance exists
            }
            
            // If no active instance and no scheduled date, set to today
            if (!task.scheduledDate && task.repeat && task.repeat !== 'none') {
              task = {
                ...task,
                scheduledDate: new Date().toISOString() 
              };
            }
          }
          
          // Check if we already have an instance for this series
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
                return unique; // existing instance is earlier or same, keep it
              }
            } else if (task.isRepeat) { 
              return unique; // prefer existing by default
            }
          } else {
            unique[task.id] = task; // No existing instance, add this one
          }
          return unique;
        }
        
        // For non-recurring tasks
        unique[task.id] = task;
        return unique;
      }, {});
    
    // Now filter for tasks scheduled for this specific date
    const tasksForDate = Object.values(uniqueTasks).filter(task => {
      if (!task.scheduledDate) return false;
      
      try {
        const taskDate = new Date(task.scheduledDate);
        return isSameDay(taskDate, date);
      } catch (error) {
        console.error('Error parsing task date:', task.id, error);
        return false;
      }
    }).sort((a, b) => {
      return a.title.localeCompare(b.title);
    });
    
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

  const filteredEvents = useMemo(() => {
    return events
      .filter(event => isSameDay(new Date(event.start), currentDate))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [events, currentDate]);

  const filteredTasks = useMemo(() => {
    const tasks = filterTasks(currentDate);
    console.log('AgendaView filteredTasks:', tasks);
    return tasks;
  }, [filterTasks, currentDate]);
  
  // Handler for completing a task instance
  const handleTaskComplete = useCallback((task) => {
    console.log('[AgendaView] Handling task completion:', JSON.parse(JSON.stringify(task)));
    
    if (handleToggleTaskCompletion) {
      if (task.isRepeat) {
        // For any recurring instance, pass the full task object.
        // handleToggleTaskCompletion is now responsible for ensuring it exists or creating it.
        console.log('[AgendaView] Toggling recurring task instance (passing full object):', task.id);
        handleToggleTaskCompletion(task, 'single');
      } else {
        // For regular, non-recurring tasks, passing the ID is fine.
        console.log('[AgendaView] Toggling regular task with ID:', task.id);
        handleToggleTaskCompletion(task.id, 'single');
      }
    }

    // If the parent component has its own onTaskComplete, call it.
    // This is usually for UI updates or other side effects in the parent.
    if (onTaskComplete) {
      onTaskComplete(task.id); // Parent might only need the ID.
    }
    
    // Force a re-render to update the UI immediately after initiating the toggle.
    // The actual data update will happen asynchronously via localStorage and events.
    setCurrentDate(prev => new Date(prev.getTime()));
  }, [onTaskComplete, handleToggleTaskCompletion, setCurrentDate]);

  // Add an effect to refresh tasks when tasks are updated
  useEffect(() => {
    // Listen for localStorage changes (for cross-tab updates)
    const handleStorageChange = (e) => {
      if (e.key === 'tasks') {
        console.log('[AgendaView] Tasks updated in localStorage, refreshing view');
        // Force a re-render by updating the current date
        setCurrentDate(prev => new Date(prev.getTime()));
      }
    };
    
    // Listen for custom task update events (for in-app updates)
    const handleTasksUpdated = (event) => {
      console.log('[AgendaView] Received tasksUpdated event');
      // Force a re-render by updating the current date
      setCurrentDate(prev => new Date(prev.getTime()));
    };
    
    // Listen for tags-updated events to refresh task data when tag names change
    const handleTagsUpdated = (event) => {
      console.log('[AgendaView] Received tags-updated event');
      // Force a re-render by updating the current date to refresh task data
      setCurrentDate(prev => new Date(prev.getTime()));
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
  }, []);
  
  // Add a function to handle task deletion
  const handleTaskDelete = useCallback((taskId, scope = 'single') => {
    console.log(`[AgendaView] Deleting task ${taskId} with scope: ${scope}`);
    
    if (onTaskDelete) {
      onTaskDelete(taskId, scope);
    }
    
    // Force a refresh after deletion
    setCurrentDate(prev => new Date(prev.getTime()));
  }, [onTaskDelete]);
  
  // Add an effect to ensure active recurring instances when component mounts
  useEffect(() => {
    if (ensureActiveRecurringInstances) {
      console.log('[AgendaView] Calling ensureActiveRecurringInstances');
      ensureActiveRecurringInstances();
      
      // After ensuring active instances, force a refresh of the current view
      setTimeout(() => {
        setCurrentDate(prev => {
          console.log('[AgendaView] Refreshing view after ensuring active instances');
          return new Date(prev.getTime());
        });
      }, 200); // Small delay to allow state updates to propagate
    }
  }, [ensureActiveRecurringInstances]);

  // Determine if we need to show the selector
  const showSelector = filteredEvents.length > 0 && filteredTasks.length > 0;

  // If no events but tasks exist, default to tasks view
  useEffect(() => {
    if (filteredEvents.length === 0 && filteredTasks.length > 0) {
      setViewMode('tasks');
    } else {
      setViewMode('events');
    }
  }, [filteredEvents.length, filteredTasks.length]);

  return (
    <div className="flex h-full flex-col gap-4">
      <TooltipProvider delayDuration={750}>
        <div className="flex flex-col">
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
          
          {showSelector && (
            <div className="flex group gap-1 mt-2 mb-2 bg-white border border-light-border dark:border-dark-border shadow-sm dark:bg-white/5 rounded-[9px] p-1 w-fit">
              <button 
                className={`px-1 py-1 text-sm rounded-[5px] flex items-center gap-1.5 ${viewMode === 'events' ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text' : 'text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text'}`}
                onClick={() => setViewMode('events')}
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="text-xs mr-1">
                  {filteredEvents.length}
                </span>
              </button>
              <button 
                className={`px-1 py-1 text-sm rounded-[5px] flex items-center gap-1.5 ${viewMode === 'tasks' ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text' : 'text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text'}`}
                onClick={() => setViewMode('tasks')}
              >
                <Task className="w-4 h-4" />
                <span className="text-xs mr-1">
                  {filterTasks(currentDate).length}
                </span>
              </button>
            </div>
          )}
        </div>
        </div>

        {viewMode === 'events' ? (
          <>
            {filteredEvents.length === 0 ? (
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
                                                  // If commandBarRef is available, open CommandBar with the current date
                                                  if (commandBarRef?.current) {
                                                    // Use the new openForNewTask method which opens the task creation flow
                                                    commandBarRef.current.openForNewTask(new Date(currentDate));
                                                  } else {
                                                    // Fallback to the original behavior if commandBarRef is not available
                                                    onDateSelect?.(new Date(currentDate));
                                                  }
                                                }}
                                                className="flex mt-3 items-center cursor-pointer flex-row px-3 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text/50 dark:text-dark-text/50 text-xs hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
                                              >
                                                Add task
                                              </button>
                                              <button 
                                                onClick={() => {
                                                  // If commandBarRef is available, open CommandBar with the current date
                                                  if (commandBarRef?.current) {
                                                    // Use the new openForNewEvent method which doesn't create an event immediately
                                                    commandBarRef.current.openForNewEvent(new Date(currentDate));
                                                  } else {
                                                    // Fallback to the original behavior if commandBarRef is not available
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
              <div className="flex flex-col gap-6 px-3 py-2">
                {filteredEvents.map((event) => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {filteredTasks.length === 0 ? (
              <div className="text-center text-light-text/50 dark:text-dark-text/50 px-4">
                No tasks scheduled for {isToday(currentDate) ? 'today' : format(currentDate, 'MMM d, yyyy')}
              </div>
            ) : (
              <div className="flex px-2 flex-col gap-2">
                {filteredTasks.map((task) => {
                  // Handle completed tasks behavior consistently
                  // Skip completed tasks unless user is specifically viewing completed tasks
                  if (task.completed && viewMode !== 'completed') return null;
                  
                  return (
                    <TaskItem 
                      key={task.id} 
                      task={{
                        ...task,
                        tag: task.tag || null  // Ensure tag is always passed
                      }}
                      hideScheduledDate={true}  // Hide scheduled date in AgendaView
                      onComplete={() => handleTaskComplete(task)}
                      checked={task.completed}
                      onDelete={(id) => handleTaskDelete(id, 'single')}
                      onDoubleClickEdit={(task) => {
                        // If this is a recurring task instance, we need to find and edit the base task
                        if (task.isRepeat && task.seriesId) {
                          // Use same approach as Sidebar - get the base task
                          try {
                            const savedTasks = JSON.parse(localStorage.getItem('tasks') || '{}');
                            // Find base task (task with seriesId that isn't an instance)
                            let baseTask = null;
                            
                            // Look through all collections
                            Object.values(savedTasks)
                              .filter(Array.isArray)
                              .forEach(collection => {
                                const found = collection.find(t => 
                                  t.seriesId === task.seriesId && !t.isRepeat
                                );
                                if (found && !baseTask) baseTask = found;
                              });
                            
                            if (baseTask) {
                              // Edit the base task instead
                              onTaskEdit(baseTask);
                            } else {
                              // Fallback to editing the instance
                              onTaskEdit(task);
                            }
                          } catch (e) {
                            console.error('Error finding base task:', e);
                            // Fallback to editing the instance
                            onTaskEdit(task);
                          }
                        } else {
                          // Regular task, edit normally
                          onTaskEdit(task);
                        }
                      }}
                      isRecurring={task.repeat && task.repeat !== 'none' || task.isRepeat}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </TooltipProvider>
    </div>
  );
}
