import { addDays, addWeeks, addMonths, addYears, isAfter, startOfDay, endOfDay, parseISO, format } from 'date-fns';
import { RRule, rrulestr, Weekday } from 'rrule';
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
  
  return createRRuleFromRepeatPattern(event.repeat, options, event.start);
}

/**
 * Convert a task to an RRule
 * @param {Object} task - The task with a repeat value
 * @returns {RRule} The corresponding RRule object
 */
export function taskToRRule(task) {
  if (!task.repeat || task.repeat === 'none') {
    return null;
  }
  
  // Use scheduledDate as the start date, or fallback to createdAt or current date
  let startDate;
  if (task.scheduledDate) {
    startDate = new Date(task.scheduledDate);
  } else if (task.createdAt) {
    startDate = new Date(task.createdAt);
  } else {
    startDate = new Date();
  }
  
  const options = {
    dtstart: startDate,
    until: addYears(new Date(), 1), // Default 1 year limit
  };
  
  return createRRuleFromRepeatPattern(task.repeat, options, startDate);
}

/**
 * Helper function to create an RRule from a repeat pattern
 * @param {string} repeatPattern - The repeat pattern (daily, weekly, etc.)
 * @param {Object} options - The base RRule options
 * @param {Date} startDate - The start date to use for day-of-week calculations
 * @returns {RRule} The corresponding RRule object
 */
function createRRuleFromRepeatPattern(repeatPattern, options, startDate) {
  // Convert JavaScript's getDay() (0=Sunday, 6=Saturday) to RRule's weekday constants
  // RRule uses: 0=Monday, 1=Tuesday, ..., 6=Sunday
  function jsWeekdayToRRuleWeekday(jsWeekday) {
    // Convert Sunday (0) to RRule.SU (6)
    if (jsWeekday === 0) return RRule.SU;
    // Convert Monday-Saturday (1-6) to RRule.MO-RRule.SA (0-5)
    return jsWeekday - 1;
  }

  // Get the correct weekday constant for RRule
  const weekday = jsWeekdayToRRuleWeekday(startDate.getDay());

  switch (repeatPattern) {
    case 'daily':
      options.freq = RRule.DAILY;
      break;
    case 'weekday':
    case 'weekdays':
      options.freq = RRule.WEEKLY;
      options.byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
      break;
    case 'weekly':
      options.freq = RRule.WEEKLY;
      // Keep the same day of week as the original date
      options.byweekday = [weekday];
      break;
    case 'biweekly':
      options.freq = RRule.WEEKLY;
      options.interval = 2;
      // Keep the same day of week as the original date
      options.byweekday = [weekday];
      break;
    case 'monthly':
      options.freq = RRule.MONTHLY;
      // Either use the day of month (e.g., 15th of each month)
      // or the position in month (e.g., 3rd Tuesday)
      // We'll use the day of month for simplicity
      options.bymonthday = [startDate.getDate()];
      break;
    case 'yearly':
      options.freq = RRule.YEARLY;
      // Set bymonth to ensure it repeats in the same month
      options.bymonth = [startDate.getMonth() + 1]; // RRule months are 1-indexed
      break;
    default:
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
  // Check if this is a valid recurring event
  if ((!baseEvent.repeat || baseEvent.repeat === 'none') && !baseEvent.rruleOptions) {
    console.log('Not a recurring event - returning baseEvent only');
    return [baseEvent]; // Not a recurring event
  }

  console.log('Generating recurring events for:', {
    id: baseEvent.id,
    repeat: baseEvent.repeat,
    hasRRuleOptions: !!baseEvent.rruleOptions,
    start: baseEvent.start,
  });

  // Don't add the base event directly to avoid duplication
  // Instead, we'll generate it properly through the RRule occurrences
  const result = [];

  // Default limit to 1 year if no end date is provided
  const limitDate = endDate || addYears(new Date(), 1);

  // Create RRule from event's pattern
  let rrule;

  // If the event has custom rruleOptions, use those
  if (baseEvent.rruleOptions) {
    console.log('Using rruleOptions for event:', baseEvent.id);
    // Ensure we have a clean copy of the options and parse dates if needed
    const ruleOptions = JSON.parse(JSON.stringify(baseEvent.rruleOptions));

    // Ensure dtstart and until are Date objects if they exist
    if (ruleOptions.dtstart) ruleOptions.dtstart = new Date(ruleOptions.dtstart);
    if (ruleOptions.until) ruleOptions.until = new Date(ruleOptions.until);

    // ---> ALWAYS use the baseEvent.start as dtstart for consistency <---
    // This ensures the event's actual scheduled time is respected
    if (baseEvent.start instanceof Date && !isNaN(baseEvent.start)) {
        ruleOptions.dtstart = new Date(baseEvent.start);
        console.log(`[generateRecurringEvents] Using baseEvent.start as dtstart: ${ruleOptions.dtstart.toISOString()}`);
    } else if (ruleOptions.dtstart) {
        // Fallback to dtstart from rruleOptions if baseEvent.start is invalid
        console.log(`[generateRecurringEvents] Using dtstart from rruleOptions: ${ruleOptions.dtstart.toISOString()}`);
    } else {
        console.warn(`[generateRecurringEvents] No valid dtstart found, using current date as fallback.`);
        ruleOptions.dtstart = new Date(); // Fallback to now, but log warning
    }

    // Create the RRule with the corrected dtstart
    try {
      rrule = new RRule(ruleOptions);
      console.log('[generateRecurringEvents] RRule created with final dtstart:', rrule.options.dtstart);
    } catch (error) {
        console.error("[generateRecurringEvents] Error creating RRule from options:", error, ruleOptions);
        rrule = null; // Prevent errors downstream
    }
  }
  // If the event already has an rrule string, use that
  else if (baseEvent.rrule) {
    console.log('Using rrule string for event:', baseEvent.id);
    rrule = rrulestr(baseEvent.rrule);
  } else {
    // Otherwise, create a new rrule from the predefined repeat pattern
    console.log('Creating rrule from repeat pattern for event:', baseEvent.id);
    rrule = eventToRRule(baseEvent);
  }

  // If we couldn't create a valid rrule, just return the base event
  if (!rrule) {
    console.log('Could not create valid rrule - returning baseEvent only');
    return [baseEvent];
  }

  // Set the until date for the rrule but don't override existing options
  const ruleOptions = { ...rrule.options };
  
  // Only set until if not already specified in options
  if (!ruleOptions.until && !ruleOptions.count) {
    ruleOptions.until = limitDate;
  }
  
  // Only set count as a fallback if neither until nor count is specified
  if (!ruleOptions.until && !ruleOptions.count) {
    ruleOptions.count = maxInstances;
  }
  
  // Create final rule with merged options
  rrule = new RRule(ruleOptions);

  // Calculate the duration of the base event
  const duration = baseEvent.end.getTime() - baseEvent.start.getTime();

  // Generate dates using RRule
  const dates = rrule.all();
  console.log(`Generated ${dates.length} occurrences for event:`, baseEvent.id);

  // Remove startIndex logic: Always process all generated dates.
  // The calling function (e.g., handleCreateEvent/handleUpdateEvent) should manage
  // how the original baseEvent relates to the generated series.
  // const startIndex = isSameDateTime(dates[0], baseEvent.start) ? 1 : 0;

  // Create events for each date, starting from the first one (index 0)
  for (let i = 0; i < dates.length; i++) {
    const start = dates[i];
    const end = new Date(start.getTime() + duration);

      // Create a new event for this occurrence
    result.push({
      ...baseEvent,
      id: generateEventId(),
      seriesId: baseEvent.id, // Always use the base event's ID as the seriesId for consistency
      start: new Date(start),
      end: new Date(end),
      isRepeat: true,
      // Store the rrule string for future reference but don't include rruleOptions in children
      // Only the base event should have rruleOptions
      rrule: rrule.toString()
    });
  }

  return result;
}

/**
 * Generates all instances of a recurring task series using rrule.js
 * @param {Object} baseTask - The base task to generate recurrences from
 * @param {Date} [endDate] - Optional end date to limit recurrences
 * @param {number} [maxInstances=52] - Maximum number of instances to generate
 * @returns {Array} Array of task objects
 */
export function generateRecurringTasks(baseTask, endDate, maxInstances = 52) {
  if (!baseTask.repeat || baseTask.repeat === 'none') {
    return [baseTask]; // Not a recurring task
  }

  // Make sure we have a valid endDate
  const limitDate = endDate instanceof Date ? endDate : addYears(new Date(), 1);
  console.log('Generating recurring tasks with limit date:', limitDate);

  // Create RRule from task's repeat pattern
  let rrule;

  // If the task has custom rruleOptions, use those
  if (baseTask.rruleOptions) {
    console.log('Using rruleOptions for task:', baseTask.id);
    // Create a new rule with the task scheduledDate as dtstart
    // Ensure we have a clean copy of the options
    const ruleOptions = JSON.parse(JSON.stringify(baseTask.rruleOptions));
    
    // For custom recurrence patterns, respect the dtstart in rruleOptions if it exists
    // Only override if there's a specific scheduledDate on the task
    let startDate;
    if (ruleOptions.dtstart) {
      // Use the dtstart from the custom rule options
      startDate = new Date(ruleOptions.dtstart);
      console.log('Using dtstart from rruleOptions:', startDate.toISOString());
    } else if (baseTask.scheduledDate) {
      startDate = new Date(baseTask.scheduledDate);
    } else if (baseTask.createdAt) {
      startDate = new Date(baseTask.createdAt);
    } else {
      // Only fall back to current date if no other option is available
      startDate = new Date();
      console.warn('No dtstart in rruleOptions, scheduledDate, or createdAt found. Using current date as fallback.');
    }
    
    rrule = new RRule({
      ...ruleOptions,
      dtstart: startDate
    });
  }
  // If the task already has an rrule string, use that
  else if (baseTask.rrule) {
    rrule = rrulestr(baseTask.rrule);
  } else {
    // Otherwise, create a new rrule from the repeat value
    rrule = taskToRRule(baseTask);
  }

  // If we couldn't create a valid rrule, just return the base task
  if (!rrule) {
    console.log('Could not create RRule for task:', baseTask.title);
    return [baseTask];
  }

  // Set the until date for the rrule
  rrule = new RRule({
    ...rrule.options,
    until: limitDate,
    count: maxInstances
  });

  // Generate dates using RRule
  const dates = rrule.all();
  console.log(`Generated ${dates.length} dates for recurring task:`, baseTask.title);

  // Get the base scheduled date
  const baseDate = baseTask.scheduledDate ? new Date(baseTask.scheduledDate) : 
                   baseTask.createdAt ? new Date(baseTask.createdAt) : new Date();
  
  // Initialize result array with recurring instances (not the base task)
  const result = [];

  // Create tasks for each date
  for (let i = 0; i < dates.length; i++) {
    const scheduledDate = dates[i];
    
    // Ensure baseTask has a seriesId. This should be guaranteed by handleCreateTask.
    if (!baseTask.seriesId) {
      console.error(`[RecurrenceUtils][generateRecurringTasks] CRITICAL: Base task (ID: ${baseTask.id}) is missing seriesId. Cannot generate valid instance IDs.`);
      // Potentially skip this instance or assign a temporary problematic ID
      continue; 
    }

    const instanceScheduledTime = new Date(scheduledDate).getTime();
    const newInstanceId = `${baseTask.seriesId}_repeat_${instanceScheduledTime}`;

    // Create a new instance for this date
    result.push({
      ...baseTask,
      id: newInstanceId, // Use the new consistent ID format
      seriesId: baseTask.seriesId, // Ensure seriesId is correctly propagated
      originalTaskId: baseTask.id, // Reference to the original base task definition ID
      originalBaseId: baseTask.id, // Alias for consistency
      scheduledDate: scheduledDate.toISOString(),
      isRepeat: true,
      completed: false, 
      createdAt: new Date().toISOString(), // Instance creation time
      updatedAt: new Date().toISOString(),
      // Ensure fields that define recurrence itself are not copied to instances
      repeat: undefined,
      rrule: undefined, // Remove rrule string if present on baseTask, it's for the series, not instance
      rruleOptions: undefined,
      completedAt: undefined, // New instances are not completed
      // Ensure other potentially problematic fields from base are reset or not copied
      // notes: baseTask.notes || '', // Notes can be copied
      // tag: baseTask.tag ? { ...baseTask.tag } : null, // Tag can be copied
      subTasks: [], // New instances should not inherit completed subtasks from a base template
      attachments: [], // Same for attachments
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
        rrule: null,
        rruleOptions: null // Explicitly clear rruleOptions too
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

      // Create a new series for future events
      const futureBaseEvent = {
        ...updatedEvent,
        id: generateEventId(),
        seriesId: generateEventId(),
        isRepeat: true,
        // Preserve rruleOptions if present
        rruleOptions: updatedEvent.rruleOptions || options.rruleOptions
      };

      // Store the manipulated event's exact time and ID
      const manipulatedEventTime = {
        id: updatedEvent.id,
        start: new Date(updatedEvent.start.getTime()),
        end: new Date(updatedEvent.end.getTime())
      };

      // Make sure futureBaseEvent has either rruleOptions or repeat for generation
      if (!futureBaseEvent.rruleOptions && (!futureBaseEvent.repeat || futureBaseEvent.repeat === 'none')) {
        console.warn('[CASE FUTURE] futureBaseEvent has neither valid rruleOptions nor repeat pattern');
        // If neither is present, resort to 'daily' as a fallback to prevent data loss
        futureBaseEvent.repeat = futureBaseEvent.repeat || 'daily';
      }
      
      console.log('[CASE FUTURE] Generating new recurring events with future base event:', {
        baseEventId: futureBaseEvent.id,
        hasRRuleOptions: !!futureBaseEvent.rruleOptions,
        repeat: futureBaseEvent.repeat
      });
      
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
       
      // Log rruleOptions if present in the event or options
      console.log('[CASE ALL] rruleOptions present:', { 
        inUpdatedEvent: !!updatedEvent.rruleOptions,
        inOptions: !!options.rruleOptions
      });

      // Filter out the old series events and prepare to add new ones
      const eventsWithoutSeries = allEvents.filter(e => e.seriesId !== updatedEvent.seriesId);

      // Process all events from the ORIGINAL series
      const seriesEvents = allEvents.filter(e => e.seriesId === updatedEvent.seriesId);
      const updatedSeriesEvents = [];
      const manipulatedId = options.manipulatedId || updatedEvent.id; // ID of the event actually dragged/resized
       
      // Find the best candidate for the base event - prioritize events with rruleOptions
      let originalBaseEvent = seriesEvents.find(e => e.rruleOptions && e.id === manipulatedId) || 
                              seriesEvents.find(e => e.id === manipulatedId);
       
      // If we can't find the manipulated event, look for any event with rruleOptions as a fallback
      if (!originalBaseEvent || !originalBaseEvent.rruleOptions) {
        const eventWithRRule = seriesEvents.find(e => e.rruleOptions);
        if (eventWithRRule) {
          console.log('[CASE ALL] Found event with rruleOptions to use as base:', eventWithRRule.id);
          // Still use manipulatedId's event as base, but borrow rruleOptions
          if (originalBaseEvent) {
            originalBaseEvent.rruleOptions = eventWithRRule.rruleOptions;
          } else {
            originalBaseEvent = eventWithRRule;
          }
        }
      }

      // Create a new base event with changes from the updated event
      const baseEvent = {
        ...originalBaseEvent,
        title: updatedEvent.title || originalBaseEvent.title,
        description: updatedEvent.description || originalBaseEvent.description,
        color: updatedEvent.color || originalBaseEvent.color,
        isAllDay: updatedEvent.isAllDay !== undefined ? updatedEvent.isAllDay : originalBaseEvent.isAllDay,
        // Ensure rruleOptions is preserved
        rruleOptions: updatedEvent.rruleOptions || originalBaseEvent.rruleOptions || options.rruleOptions
      };

      // Get the target time components from the manipulated event
      const targetStartHours = updatedEvent.start.getHours();
      const targetStartMinutes = updatedEvent.start.getMinutes();
      const targetStartSeconds = updatedEvent.start.getSeconds();
      const targetEndHours = updatedEvent.end.getHours();
      const targetEndMinutes = updatedEvent.end.getMinutes();
      const targetEndSeconds = updatedEvent.end.getSeconds();

      console.log('[CASE ALL] Applying same time to all events:', {
        manipulatedId,
        targetStartTime: `${targetStartHours}:${targetStartMinutes}:${targetStartSeconds}`,
        targetEndTime: `${targetEndHours}:${targetEndMinutes}:${targetEndSeconds}`,
        updatedEventStart: updatedEvent.start.toISOString(),
        updatedEventEnd: updatedEvent.end.toISOString()
      });



      seriesEvents.forEach(event => {
        let eventToPush;
        const isManipulatedEvent = event.id === manipulatedId;
        

        


        if (isManipulatedEvent) {
          // For the manipulated event, use the exact dragged position
          eventToPush = {
            ...event,
            title: updatedEvent.title !== undefined ? updatedEvent.title : event.title,
            description: updatedEvent.description !== undefined ? updatedEvent.description : event.description,
            color: updatedEvent.color !== undefined ? updatedEvent.color : event.color,
            isAllDay: updatedEvent.isAllDay !== undefined ? updatedEvent.isAllDay : event.isAllDay,
            start: new Date(updatedEvent.start.getTime()),
            end: new Date(updatedEvent.end.getTime()),
            seriesId: event.seriesId,
            isRepeat: true,
            repeat: event.repeat,
            rrule: originalBaseEvent.rrule,
            rruleOptions: updatedEvent.rruleOptions || originalBaseEvent.rruleOptions || options.rruleOptions
          };
        } else {
          // For other events, apply the SAME TIME as the manipulated event
          // Keep the original date but use the new time
          const originalEventDate = new Date(event.start);

          // Construct the new start date/time using the target time
          const newEventStart = new Date(originalEventDate);
          newEventStart.setHours(targetStartHours, targetStartMinutes, targetStartSeconds, 0);

          // Construct the new end date/time using the target time
          const newEventEnd = new Date(originalEventDate);
          newEventEnd.setHours(targetEndHours, targetEndMinutes, targetEndSeconds, 0);

          // Handle cases where the event might cross midnight
          if (newEventEnd <= newEventStart) {
            newEventEnd.setDate(newEventEnd.getDate() + 1);
          }

          console.log(`[CASE ALL - Other Event ${event.id}] Applying same time as manipulated event:`, {
            originalStart: event.start.toISOString(),
            originalEnd: event.end.toISOString(),
            newStart: newEventStart.toISOString(),
            newEnd: newEventEnd.toISOString(),
            targetTime: `${targetStartHours}:${targetStartMinutes}-${targetEndHours}:${targetEndMinutes}`
          });

          eventToPush = {
            ...event,
            title: updatedEvent.title !== undefined ? updatedEvent.title : event.title,
            description: updatedEvent.description !== undefined ? updatedEvent.description : event.description,
            color: updatedEvent.color !== undefined ? updatedEvent.color : event.color,
            isAllDay: updatedEvent.isAllDay !== undefined ? updatedEvent.isAllDay : event.isAllDay,
            start: newEventStart, // Apply same time to this event's date
            end: newEventEnd,     // Apply same time to this event's date
            seriesId: event.seriesId,
            isRepeat: true,
            repeat: originalBaseEvent.repeat,
            rrule: originalBaseEvent.rrule,
            rruleOptions: updatedEvent.rruleOptions || originalBaseEvent.rruleOptions || options.rruleOptions
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

/**
 * Generates the single next displayable task instance for a recurring series.
 * @param {Object} baseTaskDefinition - The base task object containing recurrence rules.
 * @param {Date | string} lastInstanceScheduledDate - The scheduled date of the instance just completed.
 * @returns {Object|null} A new task object for the next instance, or null if no next instance.
 */
export function generateNextDisplayableTaskInstance(baseTaskDefinition, lastInstanceScheduledDate) {
  if (!baseTaskDefinition || (!baseTaskDefinition.repeat || baseTaskDefinition.repeat === 'none') && !baseTaskDefinition.rruleOptions) {
    console.warn('[RecurrenceUtils][generateNextDisplayableTaskInstance] Base task definition is not recurring or invalid.', baseTaskDefinition);
    return null;
  }

  const seriesStartDate = new Date(baseTaskDefinition.startDateOfSeries || baseTaskDefinition.createdAt || Date.now());
  console.log(`[RecurrenceUtils][generateNextDisplayableTaskInstance] Series Start Date: ${seriesStartDate.toISOString()}`);

  let rule;
  try {
    if (baseTaskDefinition.rruleOptions && typeof baseTaskDefinition.rruleOptions === 'object') {
      const options = JSON.parse(JSON.stringify(baseTaskDefinition.rruleOptions)); 
      // Prioritize dtstart from rruleOptions, only fall back to seriesStartDate if not present
      if (options.dtstart) {
        options.dtstart = new Date(options.dtstart);
      } else {
        options.dtstart = seriesStartDate;
      }
      if (options.until && typeof options.until === 'string') {
        options.until = new Date(options.until);
      }

      rule = new RRule(options);
    } else if (typeof baseTaskDefinition.repeat === 'string' && baseTaskDefinition.repeat.startsWith('RRULE:')) {
      const rruleString = baseTaskDefinition.repeat;
      console.log(`[RecurrenceUtils][generateNextDisplayableTaskInstance] Parsing RRule string: ${rruleString}`);
      // Ensure dtstart is part of the options for rrulestr or RRule constructor if not in string
      let tempOpts = {};
      try {
        // rrulestr might throw if dtstart is missing and not in string for some cases
        const parsedRRule = rrulestr(rruleString, { compatible: 'v2', forceset: true, unmask: true });
        tempOpts = { ...parsedRRule.options };
      } catch(e) {
        console.warn(`[RecurrenceUtils][generateNextDisplayableTaskInstance] rrulestr failed for string ${rruleString}, attempting to prepend DTSTART. Error: ${e.message}`);
        // If rrulestr fails, it might be because DTSTART is missing. Try to prepend it.
        const dtstartString = format(seriesStartDate, "yyyyMMdd'T'HHmmss'Z'");
        const rruleStringWithDtstart = `DTSTART:${dtstartString}\n${rruleString}`;
        console.log(`[RecurrenceUtils][generateNextDisplayableTaskInstance] Attempting with modified RRule string: ${rruleStringWithDtstart}`);
        const parsedRRule = rrulestr(rruleStringWithDtstart, { compatible: 'v2', forceset: true, unmask: true });
        tempOpts = { ...parsedRRule.options };
      }
      tempOpts.dtstart = new Date(tempOpts.dtstart || seriesStartDate); // Prioritize dtstart from rule, then seriesStartDate
      if (tempOpts.until && typeof tempOpts.until === 'string') {
        tempOpts.until = new Date(tempOpts.until);
      }

      rule = new RRule(tempOpts);
    } else if (typeof baseTaskDefinition.repeat === 'string' && baseTaskDefinition.repeat !== 'none') {
      const options = {
        dtstart: seriesStartDate,
      };
      if (baseTaskDefinition.rruleOptions) { 
        if (baseTaskDefinition.rruleOptions.until) {
          options.until = new Date(baseTaskDefinition.rruleOptions.until);
        }
        if (baseTaskDefinition.rruleOptions.count) {
          options.count = baseTaskDefinition.rruleOptions.count;
        }
      }

      rule = createRRuleFromRepeatPattern(baseTaskDefinition.repeat, options, seriesStartDate);
    } else {
      console.warn('[RecurrenceUtils][generateNextDisplayableTaskInstance] Invalid recurrence format on base task.', baseTaskDefinition);
      return null;
    }

    if (!rule) {
      console.error('[RecurrenceUtils][generateNextDisplayableTaskInstance] Failed to create RRule object for task:', baseTaskDefinition.id);
      return null;
    }
  } catch (error) {
    console.error('[RecurrenceUtils][generateNextDisplayableTaskInstance] Error creating RRule for task:', baseTaskDefinition.id, error);
    return null;
  }

  let pointInTimeForRruleAfter;
  if (lastInstanceScheduledDate) {
    pointInTimeForRruleAfter = new Date(lastInstanceScheduledDate);
    console.log(`[RecurrenceUtils][generateNextDisplayableTaskInstance] Last instance scheduled date provided: ${pointInTimeForRruleAfter.toISOString()}`);
  } else {
    // This case is for generating the very first instance.
    // To get the first occurrence, we need to use a date before dtstart
    pointInTimeForRruleAfter = new Date(rule.options.dtstart.getTime() - 1000); // 1 second before dtstart
    console.log(`[RecurrenceUtils][generateNextDisplayableTaskInstance] No lastInstanceScheduledDate provided. Using date before dtstart for 'after' calculation to get first occurrence: ${pointInTimeForRruleAfter.toISOString()}`);
  }

  try {
    const nextOccurrenceDate = rule.after(pointInTimeForRruleAfter, false); 
    
    if (!nextOccurrenceDate) {
      return null; 
    }
    
    // Sanity check: the next occurrence should be strictly after the pointInTimeForRruleAfter
    if (nextOccurrenceDate <= pointInTimeForRruleAfter) {
        console.warn(`[RecurrenceUtils][generateNextDisplayableTaskInstance] CRITICAL WARNING: nextOccurrenceDate (${nextOccurrenceDate.toISOString()}) is not strictly after pointInTimeForRruleAfter (${pointInTimeForRruleAfter.toISOString()}). This indicates a potential issue with RRule dtstart, the rule itself, or rrule.js behavior. The instance might be generated for the same or an earlier date.`);
    }
    
    return generateNextTaskInstance(baseTaskDefinition, nextOccurrenceDate);
  } catch (error) {
    console.error('[RecurrenceUtils][generateNextDisplayableTaskInstance] Error in rule.after() or during call to generateNextTaskInstance:', error);
    return null;
  }
}

/**
 * Get the next recurrence date for a task given its current date and repeat pattern
 * @param {string} currentDate - The current scheduled date (ISO string)
 * @param {string} repeatPattern - The repeat pattern (e.g., 'daily', 'weekly', 'monthly', 'custom')
 * @param {Object} rruleOptions - Optional rrule options for custom patterns
 * @returns {string|null} The next occurrence date as ISO string, or null if no next date
 */
export function getNextRecurrenceDate(currentDate, repeatPattern, rruleOptions = null) {
  if (!currentDate || !repeatPattern || repeatPattern === 'none') {
    return null;
  }

  try {
    const current = new Date(currentDate);
    if (isNaN(current.getTime())) {
      console.error('[getNextRecurrenceDate] Invalid currentDate:', currentDate);
      return null;
    }

    let rule;
    
    // Handle custom recurrence patterns
    if (repeatPattern === 'custom' && rruleOptions) {
      console.log('[getNextRecurrenceDate] Creating RRule from custom rruleOptions');
      
      // Create a copy of rruleOptions and ensure dtstart is set
      const ruleOptions = JSON.parse(JSON.stringify(rruleOptions));
      
      // Ensure dtstart and until are Date objects if they exist
      if (ruleOptions.dtstart) ruleOptions.dtstart = new Date(ruleOptions.dtstart);
      if (ruleOptions.until) ruleOptions.until = new Date(ruleOptions.until);
      
      // If no dtstart in rruleOptions, use the current date
      if (!ruleOptions.dtstart) {
        ruleOptions.dtstart = current;
      }
      
      // Remove count limitation for getting next occurrence
      delete ruleOptions.count;
      
      try {
        rule = new RRule(ruleOptions);
      } catch (error) {
        console.error('[getNextRecurrenceDate] Error creating RRule from custom options:', error, ruleOptions);
        return null;
      }
    } else {
      // Handle standard repeat patterns
      const options = {
        dtstart: current,
        count: 2 // We only need the current and next occurrence
      };

      rule = createRRuleFromRepeatPattern(repeatPattern, options, current);
    }
    
    if (!rule) {
      console.error('[getNextRecurrenceDate] Failed to create RRule for pattern:', repeatPattern);
      return null;
    }

    // For custom patterns, use 'after' method to get next occurrence
    if (repeatPattern === 'custom') {
      const nextOccurrence = rule.after(current, false);
      return nextOccurrence ? nextOccurrence.toISOString() : null;
    }
    
    // For standard patterns, get all occurrences and return the second one
    const occurrences = rule.all();
    
    // Return the second occurrence (next after current)
    if (occurrences.length >= 2) {
      return occurrences[1].toISOString();
    } else if (occurrences.length === 1) {
      // If only one occurrence, try to get the next one using 'after'
      const nextOccurrence = rule.after(current, false);
      return nextOccurrence ? nextOccurrence.toISOString() : null;
    }

    return null;
  } catch (error) {
    console.error('[getNextRecurrenceDate] Error calculating next date:', error);
    return null;
  }
}

/**
 * Helper function to generate a task instance for a specific date
 * @param {Object} baseTaskDefinition - The base task definition
 * @param {Date} occurrenceDate - The date for the new instance
 * @returns {Object} The new task instance
 */
function generateNextTaskInstance(baseTaskDefinition, occurrenceDate) {
  if (!occurrenceDate || !(occurrenceDate instanceof Date) || isNaN(occurrenceDate.getTime())) {
    console.error('[RecurrenceUtils][generateNextTaskInstance] Invalid occurrenceDate received:', occurrenceDate);
    return null; // Cannot generate instance without a valid date
  }
  console.log(`[RecurrenceUtils][generateNextTaskInstance] Called with baseTask ID: ${baseTaskDefinition.id}, occurrenceDate: ${occurrenceDate.toISOString()}`);
  
  const instanceScheduledTime = new Date(occurrenceDate).getTime();
  const newInstanceId = `${baseTaskDefinition.seriesId}_repeat_${instanceScheduledTime}`;

  const newInstance = {
    ...baseTaskDefinition, // Spread base properties first
    id: newInstanceId,    // Set the new, consistent ID
    seriesId: baseTaskDefinition.seriesId, // Explicitly use the base task's seriesId
    originalTaskId: baseTaskDefinition.id, // Keep original base task ID reference
    originalBaseId: baseTaskDefinition.id, // Alias for clarity, consistent with other parts of system
    scheduledDate: occurrenceDate.toISOString(),
    isRepeat: true, 
    completed: false, 
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startDateOfSeries: baseTaskDefinition.startDateOfSeries || baseTaskDefinition.createdAt, 
    // Ensure fields that define recurrence itself are not copied to instances
    repeat: undefined,
    rrule: undefined, // if baseTaskDefinition had 'rrule' string, remove it
    rruleOptions: undefined,
    completedAt: undefined, // New instances are not completed
    // Ensure other potentially problematic fields from base are reset or not copied
    notes: baseTaskDefinition.notes || '', // Copy notes, or default to empty
    tag: baseTaskDefinition.tag ? { ...baseTaskDefinition.tag } : null, // Copy tag object if exists
    subTasks: [], // New instances should not inherit completed subtasks from a base template
    attachments: [], // Same for attachments
    // Explicitly preserve addToCalendar property from base task definition
    addToCalendar: baseTaskDefinition.addToCalendar || false,
  };

  // Explicitly delete to be absolutely sure, as 'undefined' might not remove key if baseTaskDefinition had it as null
  delete newInstance.repeat;
  delete newInstance.rruleOptions;
  delete newInstance.completedAt;
  // Consider if other fields like 'subTasks' or 'notes' should be reset or deeply cloned.
  // For now, direct properties are handled.

  console.log(`[RecurrenceUtils][generateNextTaskInstance] Generated new instance: ID ${newInstance.id}, Title: '${newInstance.title}', Scheduled: ${newInstance.scheduledDate}`);
  return newInstance;
}
