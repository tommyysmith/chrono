import { useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, addYears, isBefore, isAfter, addDays } from 'date-fns';
import { ViewType } from '@/constants/views';

const BUFFER_WEEKS = 4; // Number of weeks to buffer on each side
const BUFFER_MONTHS = 2; // Number of months to buffer on each side

export function useVirtualizedEvents(events, viewType, currentDate) {
  return useMemo(() => {
    // Get visible range based on view type
    let visibleStart, visibleEnd;
    
    switch (viewType) {
      case ViewType.MONTH:
        visibleStart = startOfMonth(addMonths(currentDate, -BUFFER_MONTHS));
        visibleEnd = endOfMonth(addMonths(currentDate, BUFFER_MONTHS));
        break;
      case ViewType.WEEK:
        visibleStart = startOfWeek(addWeeks(currentDate, -BUFFER_WEEKS));
        visibleEnd = endOfWeek(addWeeks(currentDate, BUFFER_WEEKS));
        break;
      case ViewType.DAY:
        visibleStart = addWeeks(currentDate, -1);
        visibleEnd = addWeeks(currentDate, 1);
        break;
      default:
        visibleStart = startOfWeek(currentDate);
        visibleEnd = endOfWeek(currentDate);
    }

    // Process all events and generate repeats within the visible range
    return events.flatMap(event => {
      // If not a repeat event, return as is
      if (!event.repeat || event.repeat === 'none' || !event.seriesId) {
        return [event];
      }

      const result = [event]; // Always include the original event
      let nextDate = new Date(event.start);
      let nextEndDate = new Date(event.end);
      const duration = event.end.getTime() - event.start.getTime();

      // Generate events until we're past the visible range
      while (isBefore(nextDate, visibleEnd)) {
        switch (event.repeat) {
          case 'daily':
            nextDate = addDays(nextDate, 1);
            break;
          case 'weekday':
            nextDate = addDays(nextDate, nextDate.getDay() === 5 ? 3 : 1);
            break;
          case 'weekly':
            nextDate = addWeeks(nextDate, 1);
            break;
          case 'biweekly':
            nextDate = addWeeks(nextDate, 2);
            break;
          case 'monthly':
            nextDate = addMonths(nextDate, 1);
            break;
          case 'yearly':
            nextDate = addYears(nextDate, 1);
            break;
          default:
            continue;
        }

        // Skip if we're before the visible range
        if (isBefore(nextDate, visibleStart)) {
          continue;
        }

        // Add the event instance if it's within our visible range
        if (isBefore(nextDate, visibleEnd)) {
          nextEndDate = new Date(nextDate.getTime() + duration);
          result.push({
            ...event,
            id: `${event.id}_${result.length}`,
            start: new Date(nextDate),
            end: new Date(nextEndDate),
            isRepeat: true
          });
        }
      }

      return result;
    });
  }, [events, viewType, currentDate]);
}
