// Custom event utilities for calendar functionality
import { ViewType } from "@/constants/views";
import { isSameDay } from "date-fns";
// Event ID and Series ID Generation
export const generateEventId = () => crypto.randomUUID();

export const generateSeriesId = () => {
  return `series_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

export const eventsOverlap = (event1, event2) => {
  if (!isSameDay(event1.start, event2.start)) return false;
  const start1 = event1.start.getTime();
  const end1 = event1.end.getTime();
  const start2 = event2.start.getTime();
  const end2 = event2.end.getTime();
  return start1 < end2 && end1 > start2;
};

export const findOverlappingGroup = (targetEvent, allEvents) => {
  // First, find all events that overlap with any other event
  const overlapGraph = new Map();
  const allEventsList = [targetEvent, ...allEvents];

  // Build a graph of overlapping events
  allEventsList.forEach((event1) => {
    if (!overlapGraph.has(event1.id)) {
      overlapGraph.set(event1.id, new Set());
    }
    allEventsList.forEach((event2) => {
      if (event1.id !== event2.id && eventsOverlap(event1, event2)) {
        overlapGraph.get(event1.id).add(event2.id);
      }
    });
  });

  // Find all connected events using DFS
  const visited = new Set();
  const group = new Set();

  const dfs = (eventId) => {
    if (visited.has(eventId)) return;
    visited.add(eventId);

    // Add all events that are connected through overlaps
    overlapGraph.get(eventId).forEach((connectedId) => {
      const connectedEvent = allEventsList.find((e) => e.id === connectedId);
      if (connectedEvent && connectedEvent.id !== targetEvent.id) {
        group.add(connectedEvent);
      }
      dfs(connectedId);
    });
  };

  dfs(targetEvent.id);
  return Array.from(group);
};

export const getEventStyle = (event, overlappingEvents = [], viewType) => {
  const manipulatedEventId = "cb79391d-c1de-4a47-b6ca-cad9a3b524c5"; // Temporary ID for debugging

  // Log times specifically for the manipulated event ID
  if (event.id === manipulatedEventId) {
    console.log(`[getEventStyle] Received times for manipulated event (${event.id}):`, {
      start: event.start,
      end: event.end,
    });
  }

  const style = {
    position: "absolute",
    backgroundColor: event.color ? `${event.color}20` : "#80808020",
    zIndex: 10,
    borderRadius: "4px",
    margin: "0",
    padding: "2px 4px",
    fontSize: "12px",
    overflow: "hidden",
    cursor: "pointer",
  };

  // Add lower opacity for past events
  const now = new Date();
  if (event.end < now) {
    style.opacity = 0.5;
  }

  if (event.isAllDay) {
    style.top = "8px"; // Fixed position at the top
  } else {
    if (event.start) {
      const minutes = event.start.getHours() * 60 + event.start.getMinutes();
      style.top = `${minutes * (80 / 60)}px`;
    }

    if (event.end) {
      const startMinutes =
        event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const calculatedHeight = (endMinutes - startMinutes) * (80 / 60);
      const minHeight = 15; // Minimum height in pixels
      style.height = `${Math.max(calculatedHeight - 2, minHeight - 2)}px`;
    }
  }

  if (viewType === ViewType.WEEK) {
    const startDayIndex = event.start.getDay();
    const baseLeft = startDayIndex * (100 / 7);

    // Find all transitively overlapping events
    const overlappingInTime = findOverlappingGroup(event, overlappingEvents);

    if (overlappingInTime.length > 0) {
      // Sort overlapping events by start time, then by duration
      const sortedEvents = [event, ...overlappingInTime].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;

        // If start times are equal, sort by duration (longer events first)
        const aDuration = a.end.getTime() - a.start.getTime();
        const bDuration = b.end.getTime() - b.start.getTime();
        if (aDuration !== bDuration) return bDuration - aDuration;

        // If durations are equal, sort by ID for consistency
        return (a.id || "").localeCompare(b.id || "");
      });

      const eventIndex = sortedEvents.findIndex((e) => e.id === event.id);
      const totalEvents = overlappingInTime.length + 1;

      // Calculate width and offset
      const columnWidth = 100 / 7; // Width of one day column
      const eventWidth = (columnWidth * 0.95) / totalEvents; // 95% of column width divided by number of events
      const offset = eventWidth * eventIndex + columnWidth * 0.025; // Add 2.5% padding on each side

      style.width = `calc(${eventWidth}% - 8px)`;
      style.left = `${baseLeft + offset}%`;
    } else {
      // No overlapping events, use full column width with small margins
      style.width = `calc(${100 / 7}% - 20px)`;
      style.left = `calc(${baseLeft}% + 2px)`;
    }
  } else {
    // Find all transitively overlapping events
    const overlappingInTime = findOverlappingGroup(event, overlappingEvents);

    if (overlappingInTime.length > 0) {
      // Sort overlapping events by start time, then by duration
      const sortedEvents = [event, ...overlappingInTime].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;

        // If start times are equal, sort by duration (longer events first)
        const aDuration = a.end.getTime() - a.start.getTime();
        const bDuration = b.end.getTime() - b.start.getTime();
        if (aDuration !== bDuration) return bDuration - aDuration;

        // If durations are equal, sort by ID for consistency
        return (a.id || "").localeCompare(b.id || "");
      });

      const eventIndex = sortedEvents.findIndex((e) => e.id === event.id);
      const totalEvents = overlappingInTime.length + 1;

      // Calculate width and offset for day view
      const eventWidth = 95 / totalEvents; // 95% of total width divided by number of events
      const offset = eventWidth * eventIndex + 2.5; // Add 2.5% padding on each side

      style.width = `calc(${eventWidth}% - 16px)`;
      style.left = `${offset}%`;
    } else {
      // No overlapping events in day view, use 95% width with centered position
      style.width = "calc(95% - 16px)";
      style.left = "2.5%";
    }
  }

  return style;
};

export const generateRepeatedEvents = (baseEvent, repeatType, count = 52) => {
  // Don't generate events if no repeat type is specified
  if (!repeatType || repeatType === "none") {
    return [baseEvent];
  }

  // Create the base repeat event with the series ID
  // Use the existing seriesId if provided, otherwise generate a new one
  const seriesId = baseEvent.seriesId || generateSeriesId();
  const events = [];

  // Create the first event in the series - KEEP THE ORIGINAL ID if it exists
  const firstEvent = {
    ...baseEvent,
    id: baseEvent.id || generateEventId(), // Keep original ID if it exists
    seriesId, // Always use the seriesId (existing or generated)
    repeat: repeatType,
    isRepeat: true,
  };
  events.push(firstEvent);

  let nextDate = new Date(firstEvent.start);
  let nextEndDate = new Date(firstEvent.end);
  const duration = firstEvent.end - firstEvent.start;

  // Get the weekday (0-6, where 0 is Sunday) of the original event
  const originalWeekday = firstEvent.start.getDay();

  // Get the day of month of the original event (1-31)
  const originalDayOfMonth = firstEvent.start.getDate();

  // Check which week of the month the event falls on (1st, 2nd, 3rd, 4th, or 5th/last)
  const getWeekOfMonth = (date) => {
    const dayOfMonth = date.getDate();
    return Math.ceil(dayOfMonth / 7);
  };

  // Is this the last occurrence of this weekday in the month?
  const isLastWeekdayOfMonth = (date) => {
    const dayOfMonth = date.getDate();
    const lastDayOfMonth = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0
    ).getDate();
    const daysLeftInMonth = lastDayOfMonth - dayOfMonth;
    // If there are fewer than 7 days left in the month or no more occurrences of this weekday
    return daysLeftInMonth < 7 && date.getDay() === originalWeekday;
  };

  const originalWeekOfMonth = getWeekOfMonth(firstEvent.start);
  const originalIsLastWeekday = isLastWeekdayOfMonth(firstEvent.start);

  // For subsequent events in the series
  for (let i = 1; i < count; i++) {
    switch (repeatType) {
      case "daily":
        nextDate = addDays(nextDate, 1);
        nextEndDate = addDays(nextEndDate, 1);
        break;

      case "weekday":
        nextDate = addDays(nextDate, 1);
        nextEndDate = addDays(nextEndDate, 1);
        // Skip weekends
        if (getDay(nextDate) === 0) {
          // Sunday
          nextDate = addDays(nextDate, 1);
          nextEndDate = addDays(nextEndDate, 1);
        } else if (getDay(nextDate) === 6) {
          // Saturday
          nextDate = addDays(nextDate, 2);
          nextEndDate = addDays(nextEndDate, 2);
        }
        break;

      case "weekly":
        nextDate = addWeeks(nextDate, 1);
        nextEndDate = addWeeks(nextEndDate, 1);
        break;

      case "biweekly":
        nextDate = addWeeks(nextDate, 2);
        nextEndDate = addWeeks(nextEndDate, 2);
        break;

      case "monthly":
        // Simple monthly repeat - same day each month
        nextDate = addMonths(nextDate, 1);
        nextEndDate = new Date(nextDate.getTime() + duration);
        break;

      case "monthlyWeekday":
        // Monthly on a specific weekday (e.g., 3rd Monday)
        nextDate = addMonths(nextDate, 1);
        nextEndDate = addMonths(nextEndDate, 1);

        // Adjust to correct week of month for the same weekday
        // First find the first day of the month
        const firstOfMonth = new Date(
          nextDate.getFullYear(),
          nextDate.getMonth(),
          1
        );

        // Find the first occurrence of the target weekday
        let dayDiff = originalWeekday - firstOfMonth.getDay();
        if (dayDiff < 0) dayDiff += 7;
        const firstWeekdayOfMonth = new Date(firstOfMonth);
        firstWeekdayOfMonth.setDate(firstOfMonth.getDate() + dayDiff);

        // Now calculate the target date by adding the right number of weeks
        const targetDate = new Date(firstWeekdayOfMonth);
        targetDate.setDate(
          firstWeekdayOfMonth.getDate() + (originalWeekOfMonth - 1) * 7
        );

        // Ensure we're still in the same month
        if (targetDate.getMonth() !== nextDate.getMonth()) {
          // Skip this month if the pattern doesn't fit (e.g., 5th Monday in a month with only 4 Mondays)
          continue;
        }

        // Adjust the time to match the original event's time
        targetDate.setHours(
          nextDate.getHours(),
          nextDate.getMinutes(),
          nextDate.getSeconds()
        );

        // Update next dates
        nextDate = targetDate;
        nextEndDate = new Date(nextDate.getTime() + duration);
        break;

      case "monthlyLastWeekday":
        // Monthly on the last specific weekday (e.g., last Monday)
        nextDate = addMonths(nextDate, 1);
        nextEndDate = addMonths(nextEndDate, 1);

        // Find the last day of the month
        const lastOfMonth = new Date(
          nextDate.getFullYear(),
          nextDate.getMonth() + 1,
          0
        );

        // Find the last occurrence of the target weekday
        let lastDayDiff = originalWeekday - lastOfMonth.getDay();
        // If the last day is already our target weekday, lastDayDiff will be 0
        // Otherwise, we need to go back to the previous occurrence
        if (lastDayDiff > 0) lastDayDiff -= 7;

        // Calculate the last occurrence of this weekday
        const lastWeekdayOfMonth = new Date(lastOfMonth);
        lastWeekdayOfMonth.setDate(lastOfMonth.getDate() + lastDayDiff);

        // Adjust the time to match the original event's time
        lastWeekdayOfMonth.setHours(
          nextDate.getHours(),
          nextDate.getMinutes(),
          nextDate.getSeconds()
        );

        // Update next dates
        nextDate = lastWeekdayOfMonth;
        nextEndDate = new Date(nextDate.getTime() + duration);
        break;

      case "yearly":
        nextDate = addYears(nextDate, 1);
        nextEndDate = new Date(nextDate.getTime() + duration);
        break;

      default:
        continue;
    }

    events.push({
      ...firstEvent,
      id: generateEventId(), // Always generate new IDs for subsequent events
      start: new Date(nextDate),
      end: new Date(nextEndDate),
    });
  }

  return events;
};

// Helper functions for date manipulation
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addWeeks(date, weeks) {
  const result = new Date(date);
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addYears(date, years) {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function getDay(date) {
  return date.getDay();
}
