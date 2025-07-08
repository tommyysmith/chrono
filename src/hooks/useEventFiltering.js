import { useCallback } from "react";
import { isSameDay, addDays, startOfDay, endOfDay, endOfDay as endOfDayFn } from "date-fns";
import { RRule } from "rrule";
import { ViewType } from "../constants/views";

export const useEventFiltering = () => {
  const expandRecurringEvents = useCallback((events, dateRangeStart, dateRangeEnd) => {
    const expandedEvents = [];

    events.forEach(event => {
      // Direct pass-through for non-recurring events
      if (!event.rruleOptions && !event.seriesId) {
        expandedEvents.push(event);
        return;
      }

      try {
        // Handle both types of recurring events: pre-defined (seriesId) and custom (rruleOptions)

        // CASE 1: Events with seriesId that were already generated
        // These should be passed through directly
        if (event.seriesId) {
          // Check if this event falls within our date range
          const eventStart = new Date(event.start);
          if (eventStart >= dateRangeStart && eventStart <= dateRangeEnd) {
            expandedEvents.push(event);
          }
          return;
        }

        // CASE 2: Root events with rruleOptions that need to be expanded
        // These are the template events that define the recurrence pattern
        if (event.rruleOptions) {
          const rule = new RRule({
            ...event.rruleOptions,
            dtstart: new Date(event.start)
          });

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

            expandedEvents.push({
              ...event,
              id: isFirstOccurrence ? event.id : `${event.id}_${index}`,
              start: occurrenceStart,
              end: occurrenceEnd,
              isRecurring: true,
              seriesId: event.id // The base event itself becomes the series ID
            });
          });
        }
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
