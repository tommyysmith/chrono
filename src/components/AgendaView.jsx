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
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Chevron className="rotate-180 w-4 h-4" />
      </div>
    </TooltipTrigger>
    <TooltipContent>Previous month</TooltipContent>
  </Tooltip>
));

const IconRight = memo(() => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div>
        <Chevron className="w-4 h-4" />
      </div>
    </TooltipTrigger>
    <TooltipContent>Next month</TooltipContent>
  </Tooltip>
));

IconLeft.displayName = 'IconLeft';
IconRight.displayName = 'IconRight';

export default function AgendaView({ events = [], tasks = [], selectedDate = new Date(), onDateSelect, isWeekView = false, onTaskComplete, onTaskDelete, onTaskEdit }) {
  // Get task management functions
  const { getRecurringTaskInstances } = useTaskManagement();
  
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

  const filterEvents = useCallback((date) => {
    return events
      .filter(event => isSameDay(new Date(event.start), date))
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [events]);

  const filterTasks = useCallback((date) => {
    // First, identify all base recurring tasks
    const recurringBaseTasks = tasks.filter(task => 
      task.repeat && task.repeat !== 'none' && !task.isRepeat
    );
    
    // Get the IDs of all base recurring tasks
    const recurringBaseTaskIds = recurringBaseTasks.map(task => task.id);
    
    // Get regular non-recurring tasks scheduled for this date
    // Exclude base recurring tasks (we'll show their instances instead)
    const regularTasks = tasks.filter(task => {
      const isScheduledForDate = task.scheduledDate && isSameDay(new Date(task.scheduledDate), date);
      const isBaseRecurringTask = recurringBaseTaskIds.includes(task.id);
      return isScheduledForDate && !isBaseRecurringTask;
    });
    
    // Get recurring task instances for this date
    const endDateForRecurring = addDays(date, 30); // Look ahead 30 days
    const recurringInstances = getRecurringTaskInstances(date, endDateForRecurring)
      .filter(task => task.scheduledDate && isSameDay(new Date(task.scheduledDate), date));
    
    // Combine and sort all tasks
    return [...regularTasks, ...recurringInstances]
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks, getRecurringTaskInstances]);

  const handleDateSelect = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      // Create a new Date object to ensure we're not passing references
      onDateSelect?.(new Date(date));
      console.log('handleDateSelect called with date:', date);
    }
  }, [onDateSelect]);

  const filteredEvents = useMemo(() => {
    return filterEvents(currentDate);
  }, [filterEvents, currentDate]);

  const filteredTasks = useMemo(() => {
    const tasks = filterTasks(currentDate);
    console.log('AgendaView filteredTasks:', tasks);
    return tasks;
  }, [filterTasks, currentDate]);
  
  // State to track completion status of recurring task instances
  const [completedInstances, setCompletedInstances] = useState(() => {
    const saved = localStorage.getItem('completedTaskInstances');
    return saved ? JSON.parse(saved) : {};
  });

  // Effect to save completed instances to localStorage
  useEffect(() => {
    localStorage.setItem('completedTaskInstances', JSON.stringify(completedInstances));
  }, [completedInstances]);

  // Handler for completing a task instance
  const handleTaskComplete = useCallback((task) => {
    if (task.isRepeat || task.repeat) {
      // For recurring task instances, store completion state separately using a unique key
      const instanceKey = `${task.id}_${task.scheduledDate}`;
      setCompletedInstances(prev => ({
        ...prev,
        [instanceKey]: !prev[instanceKey]
      }));
    } else {
      // For regular tasks, use the normal completion handler
      onTaskComplete(task.id);
    }
  }, [onTaskComplete]);

  // Add an effect to refresh tasks when tasks are updated
  useEffect(() => {
    // Listen for localStorage changes (for cross-tab updates)
    const handleStorageChange = (e) => {
      if (e.key === 'tasks' || e.key === 'completedTaskInstances') {
        // Force a re-render by updating the current date
        setCurrentDate(prev => new Date(prev.getTime()));
      }
    };
    
    // Listen for custom task update events (for in-app updates)
    const handleTasksUpdated = () => {
      console.log('AgendaView: Received tasksUpdated event');
      // Force a re-render by updating the current date
      setCurrentDate(prev => new Date(prev.getTime()));
    };
    
    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tasksUpdated', handleTasksUpdated);
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tasksUpdated', handleTasksUpdated);
    };
  }, []);

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
    <div className="flex bg-light-bg h-full rounded-t-[13px] border-t border-light-border dark:border-dark-border dark:bg-dark-bg flex-col gap-4">
      <TooltipProvider delayDuration={750}>
        <div className="flex flex-col">
        <div className="flex px-3 mt-2 justify-center">
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
                      className="absolute top-[15px] right-[70px] p-1 rounded hover:text-light-text dark:hover:text-dark-text text-light-text/50 dark:text-dark-text/50"
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
                  {filterEvents(currentDate).length}
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
              <div className="text-center text-light-text/50 dark:text-dark-text/50 px-4">
                No events scheduled for {isToday(currentDate) ? 'today' : format(currentDate, 'MMM d, yyyy')}
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
                {filteredTasks.map((task) => (
                  <TaskItem 
                    key={task.id} 
                    task={{
                      ...task,
                      tag: task.tag || null  // Ensure tag is always passed
                    }}
                    hideScheduledDate={true}  // Hide scheduled date in AgendaView
                    onComplete={() => handleTaskComplete(task)}
                    checked={task.isRepeat || task.repeat ? completedInstances[`${task.id}_${task.scheduledDate}`] : task.completed}
                    onDelete={onTaskDelete}
                    onDoubleClickEdit={(task) => {
                      // If this is a recurring task instance, we need to find and edit the base task
                      if (task.isRepeat && task.originalTaskId) {
                        // Get the base task from localStorage
                        const savedTasks = JSON.parse(localStorage.getItem('tasks') || '{}');
                        const allTasks = savedTasks.all || [];
                        const baseTask = allTasks.find(t => t.id === task.originalTaskId);
                        
                        if (baseTask) {
                          // Edit the base task instead
                          onTaskEdit(baseTask);
                        } else {
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
                ))}
              </div>
            )}
          </>
        )}
      </TooltipProvider>
    </div>
  );
}
