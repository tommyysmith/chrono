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
 * @param {Object} updatedEvent - The updated base event
 * @param {Object} options - Options for the update
 * @returns {Array} Updated events array
 */
export const updateSeriesEvents = (allEvents, updatedEvent, options = {}) => {
  console.log('🔴🔴🔴 [START] updateSeriesEvents 🔴🔴🔴', {
    updatedEventId: updatedEvent?.id,
    updatedEventStart: updatedEvent?.start,
    updatedEventEnd: updatedEvent?.end,
    updatedEventSeriesId: updatedEvent?.seriesId,
    options
  });

  // First check if the updatedEvent has inline operation flags
  let directIsDragging = updatedEvent._isDragging === true;
  let directIsResizing = updatedEvent._isResizing === true;
  let directEditScope = updatedEvent._editScope;
  let directTimeChange = updatedEvent._timeChange;

  console.log('Direct operation flags:', {
    directIsDragging,
    directIsResizing,
    directEditScope,
    hasTimeChange: !!directTimeChange
  });

  // Extract options, using direct values from updatedEvent if available
  const {
    editScope = directEditScope || 'single',  // 'single', 'future', or 'all'
    timeChange = directTimeChange || null,    // { startDiff, endDiff } if time has changed
    baseEvent = null,                        // original base event of the series
    isDragging = directIsDragging || false,   // Flag for drag operations
    isResizing = directIsResizing || false    // Flag for resize operations
  } = options;

  console.log('Final operation flags:', { editScope, isDragging, isResizing, hasTimeChange: !!timeChange });

  // --- DEBUG LOGGING: Check seriesId before filtering ---
  console.log('[DEBUG] updatedEvent.seriesId before filtering:', updatedEvent?.seriesId);

  if (!updatedEvent.seriesId) {
    console.warn('updateSeriesEvents called with non-series event');
    return allEvents;
  }

  // Create a new events array excluding the current series
  const eventsWithoutSeries = allEvents.filter(e => e.seriesId !== updatedEvent.seriesId);

  // --- DEBUG LOGGING: Check result after filtering ---
  console.log(`[DEBUG] Events remaining after filtering out series ${updatedEvent.seriesId}:`, eventsWithoutSeries.length);

  // Function to apply time changes to an event
  const applyTimeChanges = (event) => {
    if (!timeChange) return event;

    const { startDiff, endDiff } = timeChange;
    if (isDragging) {
      // For drag operations, shift both start and end
      return {
        ...event,
        start: new Date(event.start.getTime() + startDiff),
        end: new Date(event.end.getTime() + endDiff)
      };
    } else if (isResizing) {
      // For resize operations, handle both start and end time changes
      return {
        ...event,
        start: startDiff !== 0 ? new Date(event.start.getTime() + startDiff) : event.start,
        end: endDiff !== 0 ? new Date(event.end.getTime() + endDiff) : event.end
      };
    }
    return event;
  };

  // Function to apply non-time property changes
  const applyPropertyChanges = (event) => ({
    ...event,
    title: updatedEvent.title ?? event.title,
    description: updatedEvent.description ?? event.description,
    color: updatedEvent.color ?? event.color,
    isAllDay: updatedEvent.isAllDay ?? event.isAllDay
  });

  switch (editScope) {
    case 'single': {
      console.log('[CASE SINGLE] Handling SINGLE event update - Detaching from series');

      // Find the event that was being manipulated
      const manipulatedEvent = allEvents.find(e => e.id === updatedEvent.id);
      console.log('[CASE SINGLE - DEBUG] Found original manipulatedEvent:',
        manipulatedEvent ? { id: manipulatedEvent.id, start: manipulatedEvent.start, end: manipulatedEvent.end } : 'NOT FOUND'
      );

      // Check for exact position metadata
      const hasExactPosition = updatedEvent._exactPosition &&
                             updatedEvent._exactPosition.start instanceof Date &&
                             updatedEvent._exactPosition.end instanceof Date;

      // Check for explicit detached event flag
      const isDetachedEvent = updatedEvent._detachedEvent === true;
      const preserveExactPosition = updatedEvent._preserveExactPosition === true;

      console.log('[CASE SINGLE] Event flags:', {
        isDragging,
        isResizing,
        hasExactPosition,
        isDetachedEvent,
        preserveExactPosition
      });

      // Apply time changes if this is a drag or resize operation
      let finalEvent = { ...updatedEvent };

      // --- MODIFICATION START ---
      // Prioritize exact position if requested, especially from modal edits
      if (preserveExactPosition && hasExactPosition) {
        console.log('[CASE SINGLE] Using preserved exact position from modal/flags');
        finalEvent = {
          ...updatedEvent,
          start: new Date(updatedEvent._exactPosition.start),
          end: new Date(updatedEvent._exactPosition.end)
        };
      } else if (isDragging || isResizing) { // Fallback for direct drag/resize without modal flags
        console.log('[CASE SINGLE] This is a drag/resize operation. Using exact times from updatedEvent');
        finalEvent = {
          ...updatedEvent,
          start: new Date(updatedEvent.start),
          end: new Date(updatedEvent.end)
        };
      } else if (hasExactPosition) {
        console.log('[CASE SINGLE] Using exact position from metadata');
        // Use the exact position if available
        finalEvent = {
          ...updatedEvent,
          start: new Date(updatedEvent._exactPosition.start),
          end: new Date(updatedEvent._exactPosition.end)
        };
      // --- MODIFICATION END ---
      } else if (timeChange) {
        console.log('[CASE SINGLE] Applying time changes:', timeChange);
        // Apply time changes if provided
        finalEvent = applyTimeChanges(updatedEvent);
      }

      // Ensure we have fresh Date objects
      finalEvent.start = new Date(finalEvent.start);
      finalEvent.end = new Date(finalEvent.end);

      // Log the final position before detaching
      console.log('[CASE SINGLE] Position before detaching:', {
        start: finalEvent.start.toISOString(),
        end: finalEvent.end.toISOString()
      });

      // Detach the event from the series
      const singleEvent = {
        ...finalEvent,
        id: updatedEvent.id,
        seriesId: null,
        repeat: 'none',
        isRepeat: false,
        rrule: null
      };

      console.log('[CASE SINGLE] Final detached event:', {
        id: singleEvent.id,
        start: singleEvent.start.toISOString(),
        end: singleEvent.end.toISOString(),
        seriesId: singleEvent.seriesId,
         repeat: singleEvent.repeat
       });

      // --- MORE DEBUGGING ---
      const otherSeriesEvents = allEvents.filter(e => e.seriesId === updatedEvent.seriesId && e.id !== updatedEvent.id);
      console.log('[CASE SINGLE] Other events in series being kept:', otherSeriesEvents.map(e => ({id: e.id, start: e.start})));
      // Corrected log statement - simply log the object
       console.log('[CASE SINGLE] Detached event being added:', singleEvent);
       // --- END MORE DEBUGGING ---

       // --- FIX FOR DUPLICATE KEY (v4) ---
       // 1. Filter out the original event instance using its ID from the *original* allEvents array.
       const finalArray = allEvents.filter(e => e.id !== updatedEvent.id);
       // 2. Add the newly created detached single event.
       finalArray.push(singleEvent);
       console.log(`[CASE SINGLE] Final array constructed. Length: ${finalArray.length}. Includes detached event ${singleEvent.id}.`);
       return finalArray;
       // --- END FIX ---
       // No break needed after return
     }

    case 'future': {
      // Find the edited event's index in chronological order
      const sortedEvents = [...allEvents.filter(e => e.seriesId === updatedEvent.seriesId)].sort((a, b) => a.start - b.start);
      const editedIndex = sortedEvents.findIndex(e => e.id === updatedEvent.id);
      if (editedIndex === -1) return allEvents;

      // Keep past events unchanged
      const pastEvents = sortedEvents.slice(0, editedIndex);
      eventsWithoutSeries.push(...pastEvents);

      // Create new series for future events
      const futureBaseEvent = {
        ...updatedEvent,
        id: generateEventId(),
        seriesId: generateEventId(),
        isRepeat: true
      };

      // Store the manipulated event's exact time and ID
      const manipulatedEventTime = {
        id: updatedEvent.id,
        start: new Date(updatedEvent.start.getTime()),
        end: new Date(updatedEvent.end.getTime())
      };

      // Generate new future events
      const futureEvents = generateRecurringEvents(futureBaseEvent);

      // Track if we found and preserved the manipulated event
      let manipulatedEventPreserved = false;

      // Add all future events, but preserve the exact time for the manipulated event
      futureEvents.forEach(event => {
        let eventToAdd = event;

        // Check if this event occurs on the same date as the manipulated event
        const isOnManipulatedDate = isSameEventDate(event, updatedEvent);

        // For the first event that matches the manipulated event's date, preserve the exact time and ID
        if (!manipulatedEventPreserved && isOnManipulatedDate && (isDragging || isResizing)) {
          eventToAdd = {
            ...event,
            id: manipulatedEventTime.id,
            start: manipulatedEventTime.start,
            end: manipulatedEventTime.end
          };
          manipulatedEventPreserved = true;
        } else {
          // Apply time changes to other events in the series
          eventToAdd = applyTimeChanges(event);
        }

        // Apply property changes to all events
        const withAllChanges = applyPropertyChanges(eventToAdd);
        eventsWithoutSeries.push(withAllChanges);
      });

      // If we couldn't find the manipulated event in the series, add it explicitly
      if (!manipulatedEventPreserved && (isDragging || isResizing)) {
        const explicitEvent = {
          ...updatedEvent,
          id: manipulatedEventTime.id,
          start: manipulatedEventTime.start,
          end: manipulatedEventTime.end,
          seriesId: futureBaseEvent.seriesId,
          isRepeat: true
        };

        eventsWithoutSeries.push(applyPropertyChanges(explicitEvent));
      }

      break;
    }

    case 'all': {
      console.log('[CASE ALL] Handling ALL events update - Complete rewrite');

       // Find the event that was being manipulated
       const manipulatedEvent = allEvents.find(e => e.id === updatedEvent.id);
       // --- DEBUG LOGGING: Log the original manipulated event found ---
       console.log('[CASE ALL - DEBUG] Found original manipulatedEvent:',
         manipulatedEvent ? { id: manipulatedEvent.id, start: manipulatedEvent.start, end: manipulatedEvent.end } : 'NOT FOUND'
       );
       if (!manipulatedEvent) {
         console.error('Could not find the manipulated event in the series');
         return allEvents;
       }

       // Use the delta calculated from the actual user interaction passed in options
       const startDelta = options.timeChange?.startDiff || 0;
       const endDelta = options.timeChange?.endDiff || 0;

       if (!options.timeChange) {
         console.warn("[CASE ALL] options.timeChange not provided. Deltas will be 0.");
       }
       console.log('[CASE ALL] Using Deltas from options.timeChange:', { startDelta, endDelta });

       // Filter out the old series events and prepare to add new ones
       const eventsWithoutSeries = allEvents.filter(e => e.seriesId !== updatedEvent.seriesId);

       // Process all events from the ORIGINAL series
       const seriesEvents = allEvents.filter(e => e.seriesId === updatedEvent.seriesId);
       const updatedSeriesEvents = [];
       const manipulatedId = options.manipulatedId || updatedEvent.id; // ID of the event actually dragged/resized
       const originalBaseEvent = seriesEvents.find(e => e.id === manipulatedId);

       seriesEvents.forEach(event => {
         let eventToPush;
         if (event.id === manipulatedId) {
           // For the manipulated event, use the exact final times from updatedEvent
           eventToPush = {
             ...event,
             title: updatedEvent.title !== undefined ? updatedEvent.title : event.title,
             description: updatedEvent.description !== undefined ? updatedEvent.description : event.description,
             color: updatedEvent.color !== undefined ? updatedEvent.color : event.color,
             isAllDay: updatedEvent.isAllDay !== undefined ? updatedEvent.isAllDay : event.isAllDay,
             start: updatedEvent.start, // Use exact final time
             end: updatedEvent.end,     // Use exact final time
             seriesId: event.seriesId,
             isRepeat: true,
             repeat: event.repeat,
             rrule: originalBaseEvent.rrule
           };
           console.log('[CASE ALL] Processing manipulated event:', {id: event.id, newStart: eventToPush.start, newEnd: eventToPush.end});
         } else {
           // For other events, apply the manipulated event's TIME to the original event's DATE
           const originalEventDate = new Date(event.start); // Date component from the original event

           // Get the target time components from the updated (manipulated) event
           const targetStartHours = updatedEvent.start.getHours();
           const targetStartMinutes = updatedEvent.start.getMinutes();
           const targetStartSeconds = updatedEvent.start.getSeconds();
           const targetEndHours = updatedEvent.end.getHours();
           const targetEndMinutes = updatedEvent.end.getMinutes();
           const targetEndSeconds = updatedEvent.end.getSeconds();

           // Construct the new start date/time
           const newEventStart = new Date(originalEventDate);
           newEventStart.setHours(targetStartHours, targetStartMinutes, targetStartSeconds, 0);

           // Construct the new end date/time
           const newEventEnd = new Date(originalEventDate);
           newEventEnd.setHours(targetEndHours, targetEndMinutes, targetEndSeconds, 0);

           // Handle cases where the event might cross midnight
           if (newEventEnd <= newEventStart) {
             newEventEnd.setDate(newEventEnd.getDate() + 1);
           }

           console.log(`[CASE ALL - Other Event ${event.id}] Time Construction:`, {
             originalStart: event.start,
             originalEnd: event.end,
             targetStartTime: `${targetStartHours}:${targetStartMinutes}`,
             targetEndTime: `${targetEndHours}:${targetEndMinutes}`,
             constructedNewStart: newEventStart,
             constructedNewEnd: newEventEnd,
           });

           eventToPush = {
             ...event,
             title: updatedEvent.title !== undefined ? updatedEvent.title : event.title,
             description: updatedEvent.description !== undefined ? updatedEvent.description : event.description,
             color: updatedEvent.color !== undefined ? updatedEvent.color : event.color,
             isAllDay: updatedEvent.isAllDay !== undefined ? updatedEvent.isAllDay : event.isAllDay,
             start: newEventStart, // Apply newly constructed date/time
             end: newEventEnd,       // Apply newly constructed date/time
             seriesId: event.seriesId,
             isRepeat: true,
             repeat: originalBaseEvent.repeat,
             rrule: originalBaseEvent.rrule
           };
         }
         updatedSeriesEvents.push(eventToPush);
       });

       // --- DEBUG LOGGING: Log the complete updated series before adding to main array ---
       console.log('[CASE ALL - DEBUG] Final updatedSeriesEvents array (before push):',
         updatedSeriesEvents.map(e => ({ id: e.id, start: e.start, end: e.end, title: e.title }))
       );

       // Add all updated series events to the final result
       return [...eventsWithoutSeries, ...updatedSeriesEvents];
       console.log(`[CASE ALL] Added ${updatedSeriesEvents.length} updated series events to result`);
       break;
     }

    default:
      return allEvents;
  }

  // --- DEBUG LOGGING: Final returned array ---
  console.log('🔴🔴🔴 [END] updateSeriesEvents - Returning updatedEvents 🔴🔴🔴',
    eventsWithoutSeries.map(e => ({ id: e.id, start: e.start, end: e.end, title: e.title, seriesId: e.seriesId }))
  );

   // The final .map clone is removed as we construct a new array in each case
 };

/**
 * Helper function to check if two events occur on the same date (ignoring time)
 */
function isSameEventDate(event1, event2) {
  return (
    event1.start.getFullYear() === event2.start.getFullYear() &&
    event1.start.getMonth() === event2.start.getMonth() &&
    event1.start.getDate() === event2.start.getDate()
  );
}
