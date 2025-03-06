'use client';

import { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { format, isToday, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
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
  day_today: "!bg-primary !border !border-none !text-white !rounded-[5px] !h-7 !w-7",
  day: "!h-7 !w-7 !p-0 !font-normal !text-light-text dark:!text-dark-text [&:not(.rdp-day_today)]:hover:!bg-black/10 [&:not(.rdp-day_today)]:dark:hover:!bg-white/5 !rounded-[5px]",
  day_selected: "!bg-black/5 hover:!bg-black/5 !font-bold dark:!bg-dark-bg-lighter dark:hover:!bg-dark-bg-lighter !text-dark-text !rounded-[5px] !border !border-light-border dark:!border-dark-border !h-7 !w-7",
};

const EventItem = memo(({ event }) => {
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const bgColor = event.color || '#3B82F6';
  
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
    <div className="flex items-start relative">
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
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [month, setMonth] = useState(selectedDate);
  const [viewMode, setViewMode] = useState('events'); // 'events' or 'tasks'

  // Sync with selectedDate prop
  useEffect(() => {
    setCurrentDate(selectedDate);
    setMonth(selectedDate);
  }, [selectedDate]);

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
    return tasks
      .filter(task => task.scheduledDate && isSameDay(new Date(task.scheduledDate), date))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tasks]);

  const handleDateSelect = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      onDateSelect?.(date);
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
    <div className="flex flex-col gap-4">
      <TooltipProvider delayDuration={750}>
        <div className='bg-light-bg-light dark:bg-dark-bg-light'>
        <div className="flex px-3 mt-2 justify-center">
          <DayPicker
            mode="single"
            selected={currentDate}
            month={month}
            onSelect={handleDateSelect}
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
                        handleDateSelect(today);
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
            <div className="flex gap-1 mt-2 mb-2 bg-white border border-light-border dark:border-dark-border shadow-sm dark:bg-white/5 rounded-[9px] p-1 w-fit">
              <button 
                className={`px-1 py-1 text-sm rounded-[5px] flex items-center gap-1.5 ${viewMode === 'events' ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text shadow-sm' : 'text-light-text/50 dark:text-dark-text/50'}`}
                onClick={() => setViewMode('events')}
              >
                <CalendarIcon className="w-4 h-4" />
                <span className="text-xs mr-1">
                  {filterEvents(currentDate).length}
                </span>
              </button>
              <button 
                className={`px-1 py-1 text-sm rounded-[5px] flex items-center gap-1.5 ${viewMode === 'tasks' ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text shadow-sm' : 'text-light-text/50 dark:text-dark-text/50'}`}
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
                    onComplete={onTaskComplete}
                    onDelete={onTaskDelete}
                    onDoubleClickEdit={onTaskEdit}
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
