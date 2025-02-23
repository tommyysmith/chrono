'use client';

import { useMemo, useState, useCallback, memo, useEffect } from 'react';
import { format, isToday, isSameDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Repeat } from '../assets/icons/Repeat';
import { Chevron } from '../assets/icons/Chevron';
import { DayPicker } from 'react-day-picker';
import { cn } from '@/lib/utils';
import 'react-day-picker/dist/style.css';

const dayPickerStyles = {
  day: "!h-7 !w-7 !p-0 !font-normal !text-light-text dark:!text-dark-text [&:not([aria-selected])]:hover:!bg-black/5 [&:not([aria-selected])]:dark:hover:!bg-white/5 !rounded-[5px]",
  day_selected: "!bg-black/5 !font-bold dark:!bg-dark-bg-lighter !text-dark-text !rounded-[5px] !border !border-light-border dark:!border-dark-border !h-7 !w-7",
  day_today: "!bg-primary !border !border-none !text-dark-text !rounded-[5px] !h-7 !w-7",
};

const EventItem = memo(({ event }) => {
  const startTime = new Date(event.start);
  const endTime = new Date(event.end);
  const bgColor = event.color || '#3B82F6';
  
  return (
    <div
      className="relative flex items-start rounded-[5px] transition-colors duration-200 group overflow-hidden"
      style={{
        backgroundColor: `${bgColor}10`,
      }}
    >
      <div 
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: bgColor }}
      />
      <div className="flex flex-col items-start ml-3">
        <div className="text-xs text-light-text/50 dark:text-dark-text/50">
          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </div>
        <div className="text-sm text-light-text dark:text-dark-text font-medium flex items-center gap-1">
          {event.title}
          {event.repeat && (
            <Repeat className="w-3.5 h-3.5 text-light-text/50 dark:text-dark-text/50" />
          )}
        </div>
      </div>
    </div>
  );
});

EventItem.displayName = 'EventItem';

const IconLeft = memo(() => <Chevron className="rotate-180 w-4 h-4" />);
const IconRight = memo(() => <Chevron className="w-4 h-4" />);

IconLeft.displayName = 'IconLeft';
IconRight.displayName = 'IconRight';

export default function AgendaView({ events = [], selectedDate = new Date(), onDateSelect, isWeekView = false }) {
  const [currentDate, setCurrentDate] = useState(selectedDate);

  // Sync with selectedDate prop
  useEffect(() => {
    setCurrentDate(selectedDate);
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

  const handleDateSelect = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      onDateSelect?.(date);
    }
  }, [onDateSelect]);

  const filteredEvents = useMemo(() => {
    return filterEvents(currentDate);
  }, [filterEvents, currentDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={currentDate}
          onSelect={handleDateSelect}
          className="rounded-md w-[280px] [--week-bg:rgba(0,0,0,0.05)] dark:[--week-bg:rgba(255,255,255,0.05)]"
          showOutsideDays={true}
          classNames={{
            root: "w-full",
            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
            month: "space-y-4 w-full",
            caption: "flex justify-between pt-1 relative items-center px-1",
            caption_label: "text-sm font-semibold text-light-text dark:text-dark-text",
            nav: "flex items-center",
            nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-light-text dark:text-dark-text flex items-center justify-center",
            nav_button_previous: "",
            nav_button_next: "",
            table: "w-full border-collapse space-y-2",
            head_row: "flex w-full justify-between px-2",
            head_cell: "text-light-text/50 dark:text-dark-text/50 rounded-md w-7 font-normal text-[0.8rem] text-center",
            row: "flex w-full justify-between px-2 py-1 [&:has([aria-selected=true])]:bg-black/5 dark:[&:has([aria-selected=true])]:bg-white/5 [&:has([aria-selected=true])]:rounded-[5px]",
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
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center text-light-text/50 dark:text-dark-text/50">
          No events scheduled for {isToday(currentDate) ? 'today' : format(currentDate, 'MMM d, yyyy')}
        </div>
      ) : (

        <div className="flex flex-col gap-2 px-1">
          {filteredEvents.map((event) => {
        const startTime = new Date(event.start);
        const endTime = new Date(event.end);
        const bgColor = event.color || '#3B82F6';
        
        return (
          <div
            key={event.id}
            className="relative flex items-start p-2 rounded-[5px] transition-colors duration-200 group overflow-hidden"
            style={{
              backgroundColor: `${bgColor}10`,
            }}
          >
            {/* Left border */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: bgColor }}
            />

            {/* Content */}
            <div className="flex flex-col items-start ml-3">
              <div className="text-xs text-light-text/50 dark:text-dark-text/50">
                {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
              </div>
              <div className="text-sm text-light-text dark:text-dark-text font-medium flex items-center gap-1">
                {event.title}
                {event.repeat && (
                  <Repeat className="w-3.5 h-3.5 text-light-text/50 dark:text-dark-text/50" />
                )}
              </div>
            </div>
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}
