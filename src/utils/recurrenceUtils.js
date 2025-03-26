import { addDays, addWeeks, addMonths, addYears, isAfter, startOfDay, endOfDay, parseISO } from 'date-fns';
import { RRule, rrulestr } from 'rrule';
import { generateEventId } from './eventUtils';

/**
 * Convert a simple repeat pattern to an RRule
 * @param {Object} event - The event with a repeat value
 * @returns {RRule} The corresponding RRule object
 */
export function eventToRRule(event) {
  if (!event.repeat || event.repeat === 'none') {
    return null;
  }

  const options = {
    dtstart: new Date(event.start), // Start with the event's start date
    until: addYears(new Date(), 1), // Default 1 year limit
  };

  switch (event.repeat) {
    case 'daily':
      options.freq = RRule.DAILY;
      break;
    case 'weekday':
      options.freq = RRule.WEEKLY;
      options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
      break;
    case 'weekly':
      options.freq = RRule.WEEKLY;
      // Keep the same day of week as the original event
      options.byweekday = [event.start.getDay()];
      break;
    case 'biweekly':
      options.freq = RRule.WEEKLY;
      options.interval = 2;
      // Keep the same day of week as the original event
      options.byweekday = [event.start.getDay()];
      break;
    case 'monthly':
      options.freq = RRule.MONTHLY;
      // Either use the day of month (e.g., 15th of each month)
      // or the position in month (e.g., 3rd Tuesday)
      // We'll use the day of month for simplicity
      options.bymonthday = [event.start.getDate()];
      break;
    case 'yearly':
      options.freq = RRule.YEARLY;
      break;
    default:
      // For custom rrule strings, just parse them
      if (event.rrule) {
        return rrulestr(event.rrule);
      }
      return null;
  }

  return new RRule(options);
}

/**
 * Convert RRule to a simple repeat value for UI
 * @param {RRule} rrule - The RRule object
 * @returns {string} A simple repeat value
 */
export function rruleToEventRepeat(rrule) {
  if (!rrule) return 'none';

  const options = rrule.options;

  switch (options.freq) {
    case RRule.DAILY:
      return 'daily';
    case RRule.WEEKLY:
      if (options.interval === 2) return 'biweekly';
      
      if (options.byweekday && 
          options.byweekday.length === 5 && 
          options.byweekday.includes(RRule.MO) &&
          options.byweekday.includes(RRule.TU) &&
          options.byweekday.includes(RRule.WE) &&
          options.byweekday.includes(RRule.TH) &&
          options.byweekday.includes(RRule.FR)) {
        return 'weekday';
      }
      
      return 'weekly';
    case RRule.MONTHLY:
      return 'monthly';
    case RRule.YEARLY:
      return 'yearly';
    default:
      return 'custom';
  }
}

/**
 * Generates all instances of a recurring event series using rrule.js
 * @param {Object} baseEvent - The base event to generate recurrences from
 * @param {Date} [endDate] - Optional end date to limit recurrences
 * @param {number} [maxInstances=52] - Maximum number of instances to generate
 * @returns {Array} Array of event objects
 */
export function generateRecurringEvents(baseEvent, endDate, maxInstances = 52) {
  if (!baseEvent.repeat || baseEvent.repeat === 'none') {
    return [baseEvent]; // Not a recurring event
  }

  // Always include the original event in the result
  const result = [baseEvent];
  
  // Default limit to 1 year if no end date is provided
  const limitDate = endDate || addYears(new Date(), 1);
  
  // Create RRule from event's repeat pattern
  let rrule;
  
  // If the event already has an rrule string, use that
  if (baseEvent.rrule) {
    rrule = rrulestr(baseEvent.rrule);
  } else {
    // Otherwise, create a new rrule from the repeat value
    rrule = eventToRRule(baseEvent);
  }
  
  // If we couldn't create a valid rrule, just return the base event
  if (!rrule) return [baseEvent];
  
  // Set the until date for the rrule
  rrule = new RRule({
    ...rrule.options,
    until: limitDate,
    count: maxInstances
  });
  
  // Calculate the duration of the base event
  const duration = baseEvent.end.getTime() - baseEvent.start.getTime();

  // Generate dates using RRule
  const dates = rrule.all();
  
  // Skip the first date if it's the same as the base event
  const startIndex = isSameDateTime(dates[0], baseEvent.start) ? 1 : 0;
  
  // Create events for each date
  for (let i = startIndex; i < dates.length; i++) {
    const start = dates[i];
    const end = new Date(start.getTime() + duration);
    
    result.push({
      ...baseEvent,
      id: generateEventId(),
      seriesId: baseEvent.seriesId,
      start: new Date(start),
      end: new Date(end),
      isRepeat: true,
      // Store the rrule string for future reference
      rrule: rrule.toString(),
      // Add a reference to the original event ID
      originalEventId: baseEvent.id
    });
  }
  
  return result;
}

/**
 * Helper function to check if two dates have the same date and time
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if dates are the same
 */
function isSameDateTime(date1, date2) {
  return date1.getTime() === date2.getTime();
}

/**
 * Retrieves all events from a series
 * @param {Array} allEvents - All events in the calendar
 * @param {string} seriesId - The series ID to filter by
 * @returns {Array} Events in the series
 */
export function getEventsInSeries(allEvents, seriesId) {
  if (!seriesId) return [];
  return allEvents.filter(event => event.seriesId === seriesId);
}

/**
 * Updates all events in a series based on changes to the base event
 * @param {Array} allEvents - All events in the calendar
 * @param {Object} updatedBaseEvent - The updated base event
 * @param {Object} options - Options for the update
 * @returns {Array} Updated events array
 */
export const updateSeriesEvents = (allEvents, updatedBaseEvent, options = {}) => {
  // Extract options
  const { 
    timeChange = true, 
    propertiesOnly = false,
    regenerate = false,
    isNonBaseEdit = false,
    baseEvent = null, // Accept the base event as a parameter
    isBaseEventBeingDragged = false, // Flag for when base event is dragged
    isDragging = false, // Flag for drag operations (either base or non-base)
    isResizing = false // Flag for resize operations (either base or non-base)
  } = options;
  
  const seriesId = updatedBaseEvent.seriesId;
  if (!seriesId) return allEvents;
  
  // Clone the events array
  let updatedEvents = [...allEvents];
  
  // Get all events in the series
  const seriesEvents = updatedEvents.filter(event => event.seriesId === seriesId);
  
  // Find the actual base event (first occurrence) in the series if not provided
  const actualBaseEvent = baseEvent || seriesEvents.reduce((earliest, event) => 
    event.start < earliest.start ? event : earliest, seriesEvents[0]);
  
  // If we need to regenerate the entire series using rrule
  if (regenerate) {
    // Find all events that are NOT part of this series
    const nonSeriesEvents = updatedEvents.filter(event => event.seriesId !== seriesId);
    
    // Get time changes from the updated event if it was manipulated
    const timeChanges = updatedBaseEvent._timeChange || {
      startDiff: 0,
      endDiff: 0
    };
    
    // Create the base event for generating the series
    const eventToUseForGeneration = {
      ...updatedBaseEvent,
      id: actualBaseEvent.id, // Always use the base event's ID
      start: new Date(actualBaseEvent.start.getTime() + timeChanges.startDiff),
      end: new Date(actualBaseEvent.end.getTime() + timeChanges.endDiff),
      seriesId,
      isRepeat: true,
      // Update or create the rrule based on the repeat value
      rrule: updatedBaseEvent.rrule || eventToRRule({
        ...updatedBaseEvent,
        start: new Date(actualBaseEvent.start.getTime() + timeChanges.startDiff)
      })?.toString()
    };
    
    // Add the base event to our results
    nonSeriesEvents.push(eventToUseForGeneration);
    
    // Generate new instances using RRule
    const newInstances = generateRecurringEvents(eventToUseForGeneration)
      .filter(event => event.id !== eventToUseForGeneration.id)
      .map(event => ({
        ...event,
        // Apply the same time changes to all instances
        start: new Date(event.start.getTime() + timeChanges.startDiff),
        end: new Date(event.end.getTime() + timeChanges.endDiff)
      }));
    
    // Ensure no duplicate dates
    const includedDates = new Set([eventToUseForGeneration.start.getTime()]);
    const uniqueInstances = newInstances.filter(event => {
      const startTime = event.start.getTime();
      if (includedDates.has(startTime)) return false;
      includedDates.add(startTime);
      return true;
    });
    
    // Return combined events
    return [...nonSeriesEvents, ...uniqueInstances];
  }
  
  // If we're not regenerating, proceed with normal updates
  
  // Calculate time differences based on the updated event
  let startDiff = 0;
  let endDiff = 0;
  let durationDiff = 0;
  
  // If we're updating times
  if (timeChange) {
    // Find the original event before update
    const originalEvent = allEvents.find(e => e.id === updatedBaseEvent.id);
    
    if (originalEvent) {
      // Calculate absolute time differences (for moving events)
      startDiff = updatedBaseEvent.start.getTime() - originalEvent.start.getTime();
      endDiff = updatedBaseEvent.end.getTime() - originalEvent.end.getTime();
      
      // Calculate duration difference (for resizing events)
      const originalDuration = originalEvent.end.getTime() - originalEvent.start.getTime();
      const newDuration = updatedBaseEvent.end.getTime() - updatedBaseEvent.start.getTime();
      durationDiff = newDuration - originalDuration;
    }
  }
  
  // Determine if this is the base event of the series being edited
  const isBaseEventEdit = updatedBaseEvent.id === actualBaseEvent.id;
  
  // CRITICAL: Always update the base event (even when editing a non-base event)
  if (actualBaseEvent) {
    // Find the base event in our array
    const baseEventIndex = updatedEvents.findIndex(e => e.id === actualBaseEvent.id);
    if (baseEventIndex !== -1) {
      // Update the base event with appropriate properties
      let baseEventUpdates = {
        ...updatedEvents[baseEventIndex],
        title: updatedBaseEvent.title,
        description: updatedBaseEvent.description,
        color: updatedBaseEvent.color,
        isAllDay: updatedBaseEvent.isAllDay,
        repeat: updatedBaseEvent.repeat,
        // Update the rrule if the repeat pattern changed
        rrule: updatedBaseEvent.repeat !== updatedEvents[baseEventIndex].repeat
          ? eventToRRule({
              ...updatedBaseEvent,
              start: updatedEvents[baseEventIndex].start
            })?.toString()
          : updatedEvents[baseEventIndex].rrule
      };
      
      // If this is a time change and we're editing the base event directly, update its times
      if (timeChange && isBaseEventEdit) {
        baseEventUpdates.start = new Date(updatedBaseEvent.start.getTime());
        baseEventUpdates.end = new Date(updatedBaseEvent.end.getTime());
      }
      // If this is a drag operation on a non-base event, we need to move the base event too
      else if (timeChange && !isBaseEventEdit && isDragging) {
        baseEventUpdates.start = new Date(updatedEvents[baseEventIndex].start.getTime() + startDiff);
        baseEventUpdates.end = new Date(updatedEvents[baseEventIndex].end.getTime() + endDiff);
      }
      // If this is a resize operation on a non-base event, update the base event's duration
      else if (timeChange && !isBaseEventEdit && isResizing) {
        // Only update the end time (keeping start time the same) for resize operations
        baseEventUpdates.end = new Date(updatedEvents[baseEventIndex].end.getTime() + durationDiff);
      }
      
      // Update the base event in our array
      updatedEvents[baseEventIndex] = baseEventUpdates;
    }
  }
  
  // Update each event in the series
  for (let i = 0; i < updatedEvents.length; i++) {
    const event = updatedEvents[i];
    
    if (event.seriesId === seriesId && event.id !== actualBaseEvent.id) {
      // Update the event
      const updatedEvent = {
        ...event,
        // Copy common properties
        title: updatedBaseEvent.title,
        description: updatedBaseEvent.description,
        color: updatedBaseEvent.color,
        isAllDay: updatedBaseEvent.isAllDay,
        repeat: updatedBaseEvent.repeat,
        // Ensure series properties are preserved
        seriesId: updatedBaseEvent.seriesId,
        isRepeat: true,
        // Preserve or update the rrule
        rrule: event.rrule || updatedBaseEvent.rrule || 
          (updatedBaseEvent.repeat !== event.repeat 
            ? eventToRRule({
                ...updatedBaseEvent,
                start: event.start
              })?.toString()
            : null)
      };
      
      // Apply time changes if needed
      if (timeChange) {
        // If it's explicitly a resize operation
        if (isResizing) {
          // Only update the end time (keeping start time the same)
          updatedEvent.end = new Date(event.end.getTime() + durationDiff);
        }
        // If it's a drag operation or time shift, update both start and end
        else if (isDragging || startDiff !== 0 || endDiff !== 0) {
          updatedEvent.start = new Date(event.start.getTime() + startDiff);
          updatedEvent.end = new Date(event.end.getTime() + endDiff);
          
          // Update the rrule to reflect the new start time if needed
          if (updatedEvent.repeat !== 'none') {
            const newRRule = eventToRRule(updatedEvent);
            if (newRRule) {
              updatedEvent.rrule = newRRule.toString();
            }
          }
        }
      }
      
      // Update the event in the array
      updatedEvents[i] = updatedEvent;
    }
  }
  
  return updatedEvents;
}
