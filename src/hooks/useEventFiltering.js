import { useCallback } from "react";
import { isSameDay, addDays, startOfDay, endOfDay, endOfDay as endOfDayFn } from "date-fns";
import { RRule } from "rrule";
import { ViewType } from "../constants/views";
import { eventToRRule } from "../utils/recurrenceUtils";

export const useEventFiltering = () => {
  const expandRecurringEvents = useCallback((events, dateRangeStart, dateRangeEnd) => {
    const expandedEvents = [];

    events.forEach(event => {
      // Direct pass-through for non-recurring events
      const isRecurring = event.rruleOptions || event.isRepeat || (event.repeat && event.repeat !== 'none');
      if (!isRecurring) {
        expandedEvents.push(event);
        return;
      }

      try {
        // Handle recurring events - expand instances on-the-fly using RRULE
        // This is the industry standard approach (single event with RRULE, expand for display)

        // Events with rruleOptions OR repeat pattern that need to be expanded
        // These are the base events that define the recurrence pattern
        let rule;
        
        if (event.rruleOptions) {
          // Use custom rruleOptions if available
          rule = new RRule({
            ...event.rruleOptions,
            dtstart: new Date(event.start)
          });
        } else if (event.repeat && event.repeat !== 'none') {
          // Convert simple repeat pattern (daily, weekly, etc.) to RRule
          rule = eventToRRule(event);
        }
        
        if (!rule) {
          // Couldn't create rule, pass through as-is
          expandedEvents.push(event);
          return;
        }

          // Generate occurrences within the date range
          const occurrences = rule.between(dateRangeStart, dateRangeEnd, true);

          // If no occurrences found but this is within our range, include it anyway
          if (occurrences.length === 0) {
            const eventStart = new Date(event.start);
            if (eventStart >= dateRangeStart && eventStart <= dateRangeEnd) {
              expandedEvents.push(event);
            }
            return;
          }

          // Get instance overrides for this recurring event (Notion Calendar style)
          const instanceOverrides = event.instanceOverrides || {};
          
          // Debug: log if there are any instance overrides
          if (Object.keys(instanceOverrides).length > 0) {
            console.log('[useEventFiltering] Event has instanceOverrides:', event.id, instanceOverrides);
          }

          // For each occurrence, create an event instance
          occurrences.forEach((occurrenceDate, index) => {
            const startDate = new Date(event.start);
            const endDate = new Date(event.end);

            // Calculate duration to maintain it across occurrences
            const duration = endDate - startDate;

            const occurrenceStart = occurrenceDate;
            const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

            // CRITICAL: For the *first real occurrence* (index 0), use the original ID
            // This ensures the base event can be manipulated
            const isFirstOccurrence = index === 0;
            
            // Check for instance override (Notion Calendar style)
            // Use ISO date string as key for the override lookup
            const dateKey = occurrenceStart.toISOString().split('T')[0]; // YYYY-MM-DD
            const override = instanceOverrides[dateKey];
            
            // Debug: log override lookup
            if (Object.keys(instanceOverrides).length > 0) {
              console.log('[useEventFiltering] Checking override for dateKey:', dateKey, 'found:', !!override, 'available keys:', Object.keys(instanceOverrides));
            }

            // Calculate final start/end times, applying time offset if present in override
            let finalStart = occurrenceStart;
            let finalEnd = occurrenceEnd;
            
            if (override?.startOffset !== undefined || override?.endOffset !== undefined) {
              // Apply time offsets from drag/resize operations
              finalStart = new Date(occurrenceStart.getTime() + (override.startOffset || 0));
              finalEnd = new Date(occurrenceEnd.getTime() + (override.endOffset || 0));
            }

            expandedEvents.push({
              ...event,
              // Apply instance override if exists (title, description, color, location, etc.)
              // But exclude startOffset/endOffset as they're applied to the times above
              ...(override ? {
                title: override.title,
                description: override.description,
                color: override.color,
                location: override.location,
              } : {}),
              id: isFirstOccurrence ? event.id : `${event.id}_${index}`,
              start: finalStart,
              end: finalEnd,
              isRecurring: true,
              seriesId: event.id, // The base event itself becomes the series ID
              _hasOverride: !!override, // Flag to indicate this instance has been individually edited
              _overrideDateKey: dateKey, // Store the date key for later reference
            });
          });
      } catch (error) {
        console.error('Error expanding recurring event:', error);
        expandedEvents.push(event); // Fallback to original event
      }
    });

    return expandedEvents;
  }, []);

  const filterEventsForView = useCallback((events, selectedDate, viewType, currentDefaultColor) => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      // First expand any recurring events
      const expandedEvents = expandRecurringEvents(events, weekStart, weekEnd);

      // Then filter for events in this week
      const filteredEvents = expandedEvents.filter((event) => {
        const eventStart = new Date(event.start);
        // Check both allDay and isAllDay properties to ensure compatibility
        const isAllDayEvent = event.allDay || event.isAllDay;
        return (
          eventStart >= weekStart && eventStart < weekEnd && !isAllDayEvent
        );
      });

      return { filteredEvents, dateRange: { start: weekStart, end: weekEnd } };
    } else {
      // Day view
      const dayStart = new Date(selectedDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);

      // First expand any recurring events
      const expandedEvents = expandRecurringEvents(events, dayStart, dayEnd);

      // Then filter for events on this day
      const dayEvents = expandedEvents.filter((event) => {
        // Check both allDay and isAllDay properties to ensure compatibility
        const isAllDayEvent = event.allDay || event.isAllDay;
        return !isAllDayEvent && isSameDay(event.start, selectedDate);
      });

      return { filteredEvents: dayEvents, dateRange: { start: dayStart, end: dayEnd } };
    }
  }, [expandRecurringEvents]);

  const getTaskEventsForView = useCallback((selectedDate, viewType, currentDefaultColor) => {
    // Get tasks from localStorage and filter for calendar tasks
    // Check if we're in a browser environment before accessing localStorage
    if (typeof window === 'undefined') {
      return []; // Return empty array during SSR
    }
    
    const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
    const allTasks = tasks.all || [];
    
    // Helper function to check if a task has a specific time (not just date)
    const hasSpecificTime = (task) => {
      if (!task.scheduledDate) return false;
      
      const scheduledDate = new Date(task.scheduledDate);
      
      // If task has a duration, it definitely has a specific time
      if (task.duration && task.duration > 0) return true;
      
      // If the time is not midnight (00:00), it has a specific time
      if (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0) return true;
      
      return false;
    };
    
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const calendarTasks = allTasks.filter(task => 
        task.addToCalendar && 
        task.scheduledDate && 
        !task.completed &&
        hasSpecificTime(task) && // Only include tasks with specific times
        new Date(task.scheduledDate) >= weekStart && 
        new Date(task.scheduledDate) < weekEnd
      );

      return calendarTasks.map(task => {
        const startDate = new Date(task.scheduledDate);
        const endDate = task.duration && task.duration > 0 
          ? new Date(startDate.getTime() + (task.duration * 60 * 1000))
          : new Date(startDate.getTime() + (60 * 60 * 1000)); // Default 1 hour

        return {
          id: `task-block-${task.id}`,
          title: task.title,
          start: startDate,
          end: endDate,
          color: task.tag?.color || currentDefaultColor,
          isTaskBlock: true,
          originalTask: task,
          isDraft: false
        };
      });
    } else {
      // Day view
      const selectedDateObj = new Date(selectedDate);
      const calendarTasks = allTasks.filter(task => 
        task.addToCalendar && 
        task.scheduledDate && 
        !task.completed &&
        hasSpecificTime(task) && // Only include tasks with specific times
        isSameDay(new Date(task.scheduledDate), selectedDateObj)
      );

      return calendarTasks.map(task => {
        const startDate = new Date(task.scheduledDate);
        const endDate = task.duration && task.duration > 0 
          ? new Date(startDate.getTime() + (task.duration * 60 * 1000))
          : new Date(startDate.getTime() + (60 * 60 * 1000)); // Default 1 hour

        return {
          id: `task-block-${task.id}`,
          title: task.title,
          start: startDate,
          end: endDate,
          color: task.tag?.color || currentDefaultColor,
          isTaskBlock: true,
          originalTask: task,
          isDraft: false
        };
      });
    }
  }, []);

  // Helper function to determine if an event is past
  const isEventPast = useCallback((event, now = new Date()) => {
    const isAllDayEvent = event.allDay || event.isAllDay;
    if (isAllDayEvent) {
      // For all-day events, only consider them past after the end of the day
      const eventEndDate = new Date(event.end);
      const endOfEventDay = endOfDayFn(eventEndDate);
      return now > endOfEventDay;
    } else {
      // For regular events, use the original logic
      return new Date(event.end) < now;
    }
  }, []);

  return {
    expandRecurringEvents,
    filterEventsForView,
    getTaskEventsForView,
    isEventPast,
  };
};
