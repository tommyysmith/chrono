// Event utilities based on react-big-calendar logic
export const localizer = {
  startOf: (date, unit) => {
    const d = new Date(date);
    if (unit === 'day') {
      d.setHours(0, 0, 0, 0);
    }
    return d;
  },

  endOf: (date, unit) => {
    const d = new Date(date);
    if (unit === 'day') {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  },

  add: (date, amount, unit) => {
    const d = new Date(date);
    if (unit === 'day') {
      d.setDate(d.getDate() + amount);
    }
    return d;
  },

  diff: (a, b, unit) => {
    const diffTime = Math.abs(b - a);
    if (unit === 'day') {
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    return 0;
  },

  max: (a, b) => new Date(Math.max(a, b)),
  min: (a, b) => new Date(Math.min(a, b)),

  ceil: (date, unit) => {
    const d = new Date(date);
    if (unit === 'day') {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  },

  isSameDate: (a, b) => {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  },

  inEventRange: ({ event, range }) => {
    const eStart = event.start;
    const eEnd = event.end;
    const rStart = range.start;
    const rEnd = range.end;

    return (
      (eStart >= rStart && eStart < rEnd) ||
      (eEnd > rStart && eEnd <= rEnd) ||
      (eStart <= rStart && eEnd >= rEnd)
    );
  },

  daySpan: (start, end) => {
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  sortEvents: ({ evtA, evtB }) => {
    if (evtA.allDay && !evtB.allDay) return -1;
    if (!evtA.allDay && evtB.allDay) return 1;

    return evtA.start - evtB.start;
  },

  segmentOffset: 0,
};

export const accessors = {
  start: event => event.start,
  end: event => event.end,
  allDay: event => event.allDay || false,
  title: event => event.title,
};

export function eventSegments(event, range) {
  const first = range[0];
  const last = localizer.add(range[range.length - 1], 1, 'day');

  const slots = localizer.diff(first, last, 'day');
  const start = localizer.max(
    localizer.startOf(accessors.start(event), 'day'),
    first
  );
  const end = localizer.min(localizer.ceil(accessors.end(event), 'day'), last);

  const padding = range.findIndex(x => localizer.isSameDate(x, start));
  let span = localizer.diff(start, end, 'day');

  span = Math.min(span, slots);
  span = Math.max(span - localizer.segmentOffset, 1);

  return {
    event,
    span,
    left: padding + 1,
    right: Math.max(padding + span, 1),
  };
}

export function segsOverlap(seg, otherSegs) {
  return otherSegs.some(
    otherSeg => otherSeg.left <= seg.right && otherSeg.right >= seg.left
  );
}

export function eventLevels(rowSegments, limit = Infinity) {
  const levels = [];
  const extra = [];

  for (let i = 0; i < rowSegments.length; i++) {
    const seg = rowSegments[i];
    let j = 0;

    for (; j < levels.length; j++) {
      if (!segsOverlap(seg, levels[j])) break;
    }

    if (j >= limit) {
      extra.push(seg);
    } else {
      (levels[j] || (levels[j] = [])).push(seg);
    }
  }

  for (let i = 0; i < levels.length; i++) {
    levels[i].sort((a, b) => a.left - b.left);
  }

  return { levels, extra };
}

export function inRange(event, start, end) {
  const eventStart = accessors.start(event);
  const eventEnd = accessors.end(event);
  const range = { start, end };
  return localizer.inEventRange({ 
    event: { start: eventStart, end: eventEnd }, 
    range 
  });
}

export function getWeekRange(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay() + 1); // Start from Monday
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  
  const range = [];
  let current = new Date(start);
  
  while (current <= end) {
    range.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return range;
}

export function getDayRange(date) {
  const start = localizer.startOf(date, 'day');
  const end = localizer.endOf(date, 'day');
  return [start, end];
}

export function getOverlappingGroups(events) {
  if (!events || events.length === 0) return [];

  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Initialize groups array
  const groups = [];
  
  // Helper function to check if an event overlaps with any event in a group
  const overlapsWithGroup = (event, group) => {
    return group.some(groupEvent => eventsOverlap(event, groupEvent));
  };

  // Helper function to merge groups that share any events
  const mergeOverlappingGroups = (groups) => {
    let merged = false;
    
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        // Check if any event in group i overlaps with any event in group j
        const hasOverlap = groups[i].some(event1 => 
          groups[j].some(event2 => eventsOverlap(event1, event2))
        );
        
        if (hasOverlap) {
          // Merge groups[j] into groups[i]
          groups[i] = [...new Set([...groups[i], ...groups[j]])];
          // Remove groups[j]
          groups.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
    
    return merged;
  };

  // Process each event
  for (const event of sortedEvents) {
    let addedToExisting = false;
    
    // Try to add to an existing group
    for (const group of groups) {
      if (overlapsWithGroup(event, group)) {
        group.push(event);
        addedToExisting = true;
        break;
      }
    }
    
    // If not added to any existing group, create a new group
    if (!addedToExisting) {
      groups.push([event]);
    }
    
    // Keep merging groups until no more merges are possible
    while (mergeOverlappingGroups(groups)) {}
  }

  return groups;
};

export function eventsOverlap(event1, event2) {
  // Handle all-day events separately
  if (event1.allDay && event2.allDay) {
    return localizer.isSameDate(event1.start, event2.start);
  }

  // If only one event is all-day, they don't overlap
  if (event1.allDay || event2.allDay) {
    return false;
  }

  // For regular events, check actual time overlap
  if (!localizer.isSameDate(event1.start, event2.start)) {
    return false;
  }

  const e1Start = event1.start.getTime();
  const e1End = event1.end.getTime();
  const e2Start = event2.start.getTime();
  const e2End = event2.end.getTime();

  // Events overlap if one starts before the other ends
  return e1Start < e2End && e2Start < e1End;
}

export function calculateEventPosition(event, overlappingEvents) {
  const totalOverlapping = overlappingEvents.length;
  if (totalOverlapping === 0) return { width: '100%', left: '0%' };

  // Sort events by start time first, then by duration (longer events first), then by ID
  const sortedEvents = overlappingEvents.sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) return startDiff;
    
    // If start times are the same, sort by duration (longer events first)
    const aDuration = a.end.getTime() - a.start.getTime();
    const bDuration = b.end.getTime() - b.start.getTime();
    if (aDuration !== bDuration) return bDuration - aDuration;
    
    // If durations are the same, sort by ID for consistency
    return (a.id || '').localeCompare(b.id || '');
  });

  // Find all events that start at the same time as the current event
  const eventStartTime = event.start.getTime();
  const sameStartGroup = sortedEvents.filter(e => e.start.getTime() === eventStartTime);
  
  // If there are multiple events starting at the same time, position them side by side
  // Longer events will be positioned on the left due to the sorting above
  if (sameStartGroup.length > 1) {
    const position = sameStartGroup.findIndex(e => e === event);
    const width = 100 / sameStartGroup.length;
    const left = position * width;

    return {
      width: `calc(${width}% - 12px)`,
      left: `${left}%`,
      zIndex: position + 1
    };
  }

  // For events with different start times, find the position in the overall group
  const position = sortedEvents.findIndex(e => e === event);
  const width = 100 / totalOverlapping;
  const left = position * width;

  return {
    width: `calc(${width}% - 12px)`,
    left: `${left}%`,
    zIndex: position + 1
  };
}

export function getEventStyle(event, isWeekView = false, overlappingEvents = []) {
  const start = new Date(event.start);
  const end = new Date(event.end);
  
  // Calculate top and height based on time
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  
  const totalMinutesInDay = 24 * 60;
  const eventStartMinutes = (start.getHours() * 60) + start.getMinutes();
  const eventEndMinutes = (end.getHours() * 60) + end.getMinutes();
  
  const top = (eventStartMinutes / totalMinutesInDay) * 100;
  const height = ((eventEndMinutes - eventStartMinutes) / totalMinutesInDay) * 100;

  // Get position relative to overlapping events
  const { width, left, zIndex } = calculateEventPosition(event, overlappingEvents);

  return {
    top: `${top}%`,
    height: `${height}%`,
    width,
    left,
    zIndex,
    position: 'absolute',
    background: event.color || '#60A5FA',
    borderRadius: '4px',
    padding: '4px',
    overflow: 'hidden',
    color: '#fff',
    fontSize: '0.875rem',
    cursor: 'pointer',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s ease',
    '&:hover': {
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      transform: 'scale(1.02)'
    }
  };
}

// Event ID and Series ID Generation
export const generateEventId = () => {
  return `evt_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

export const generateSeriesId = () => {
  return `series_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
};

// Repeat Event Utilities
export const createRepeatEvent = (baseEvent, repeatType) => {
  // Generate new IDs for the repeat series
  const seriesId = generateSeriesId();
  const eventId = generateEventId();
  
  return {
    ...baseEvent,
    id: eventId,
    seriesId,
    repeat: repeatType,
    isRepeat: true
  };
};

export const updateRepeatEvents = (events, seriesId, updates) => {
  // Simply update all events in the series with the changes
  return events.map(event => {
    if (event.seriesId === seriesId) {
      return {
        ...event,
        ...updates
      };
    }
    return event;
  });
};

export const generateRepeatedEvents = (baseEvent, repeatType, count = 52) => {
  // Don't generate events if no repeat type is specified
  if (!repeatType || repeatType === 'none') {
    return [baseEvent];
  }

  // Create the base repeat event with the series ID
  const seriesId = baseEvent.seriesId || generateSeriesId();
  const events = [];
  
  // Create the first event in the series - KEEP THE ORIGINAL ID if it exists
  const firstEvent = {
    ...baseEvent,
    id: baseEvent.id || generateEventId(), // Keep original ID if it exists
    seriesId,
    repeat: repeatType,
    isRepeat: true
  };
  events.push(firstEvent);

  let nextDate = new Date(firstEvent.start);
  let nextEndDate = new Date(firstEvent.end);
  const duration = firstEvent.end - firstEvent.start;

  // For subsequent events in the series
  for (let i = 1; i < count; i++) {
    switch (repeatType) {
      case 'daily':
        nextDate = addDays(nextDate, 1);
        nextEndDate = addDays(nextEndDate, 1);
        break;
      case 'weekday':
        nextDate = addDays(nextDate, 1);
        nextEndDate = addDays(nextEndDate, 1);
        // Skip weekends
        if (getDay(nextDate) === 0) { // Sunday
          nextDate = addDays(nextDate, 1);
          nextEndDate = addDays(nextEndDate, 1);
        } else if (getDay(nextDate) === 6) { // Saturday
          nextDate = addDays(nextDate, 2);
          nextEndDate = addDays(nextEndDate, 2);
        }
        break;
      case 'weekly':
        nextDate = addWeeks(nextDate, 1);
        nextEndDate = addWeeks(nextEndDate, 1);
        break;
      case 'biweekly':
        nextDate = addWeeks(nextDate, 2);
        nextEndDate = addWeeks(nextEndDate, 2);
        break;
      case 'monthly':
        nextDate = addMonths(nextDate, 1);
        nextEndDate = new Date(nextDate.getTime() + duration);
        break;
      case 'yearly':
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
      end: new Date(nextEndDate)
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
