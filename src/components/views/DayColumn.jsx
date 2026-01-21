import { memo, useMemo } from 'react';
import { format, isSameDay, isToday } from 'date-fns';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DayColumn = memo(function DayColumn({
  date,
  dayWidth,
  events = [],
  onDoubleClick,
  onMouseDown,
  isDropTarget = false,
  children,
}) {
  const isCurrentDay = isToday(date);
  const dayOfWeek = DAYS[date.getDay()];
  const dayNumber = format(date, 'd');

  const dayEvents = useMemo(() => {
    return events.filter(event => {
      if (!event.start) return false;
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  }, [events, date]);

  const handleDoubleClick = (e) => {
    if (onDoubleClick) {
      onDoubleClick(e, date);
    }
  };

  const handleMouseDown = (e) => {
    if (onMouseDown) {
      onMouseDown(e, date);
    }
  };

  return (
    <div
      className="day-column flex-shrink-0 relative h-full"
      style={{ 
        width: dayWidth,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        contain: 'layout style paint',
      }}
      data-date={date.toISOString()}
    >
      <div className="absolute inset-0 border-l border-light-border/50 dark:border-dark-border">
        {HOURS.map((hour) => (
          <div 
            key={hour} 
            className={`${hour === 23 ? 'h-40' : 'h-20'} relative`}
          >
            {hour !== 0 && (
              <div className="absolute left-0 right-0 top-0 border-t border-light-border/50 dark:border-dark-border" />
            )}
          </div>
        ))}
      </div>

      <div 
        className={`absolute inset-0 ${isDropTarget ? 'bg-primary/5' : ''}`}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
      />

      <div className="absolute inset-0 pointer-events-none">
        {children}
      </div>
    </div>
  );
});

export const DayColumnHeader = memo(function DayColumnHeader({
  date,
  dayWidth,
}) {
  const isCurrentDay = isToday(date);
  const dayOfWeek = DAYS[date.getDay()];
  const dayNumber = format(date, 'd');

  return (
    <div
      className="day-column-header flex-shrink-0 h-12 flex gap-1 flex-row items-center justify-center"
      style={{ 
        width: dayWidth,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
        {dayOfWeek}
      </div>
      <div className="text-xs text-light-text dark:text-dark-text font-semibold">
        {isCurrentDay ? (
          <span className="text-white bg-primary h-5 w-5 flex items-center justify-center rounded-[5px]">
            {dayNumber}
          </span>
        ) : (
          dayNumber
        )}
      </div>
    </div>
  );
});

export default DayColumn;
