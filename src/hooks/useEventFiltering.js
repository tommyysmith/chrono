import { useCallback } from "react";
import { isSameDay, addDays, startOfDay, endOfDay, endOfDay as endOfDayFn } from "date-fns";
import { RRule } from "rrule";
import { ViewType } from "../constants/views";

export const useEventFiltering = () => {
  const expandRecurringEvents = useCallback((events, dateRangeStart, dateRangeEnd) => {
    const expandedEvents = [];

    events.forEach(event => {
      // Direct pass-through for non-recurring events
      if (!event.rruleOptions) {
        // Also check if it's just an instance of a series without its own rule
        if (event.seriesId && !event.rruleOptions) {
          const eventStart = new Date(event.start);
          if (eventStart >= dateRangeStart && eventStart <= dateRangeEnd) {
            expandedEvents.push(event);
          }
        } else {
          expandedEvents.push(event);
        }
        return;
      }

      try {
        // CASE: Root events with rruleOptions that need to be expanded
        const ruleOptions = {
          ...event.rruleOptions,
          // RRule requires a dtstart property. Use the one from the options if it exists,
          // otherwise fall back to the event's start time.
          dtstart: event.rruleOptions.dtstart || new Date(event.start),
        };
        const rule = new RRule(ruleOptions);

        // Generate occurrences within the date range
        const occurrences = rule.between(dateRangeStart, dateRangeEnd, true);

        // For each occurrence, create an event instance
        occurrences.forEach((occurrenceDate, index) => {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);

          // Calculate duration to maintain it across occurrences
          const duration = endDate.getTime() - startDate.getTime();

          const occurrenceStart = new Date(occurrenceDate);
          const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);

          // The original event is the first instance.
          const isFirstInstance = occurrenceStart.getTime() === new Date(event.start).getTime();

          expandedEvents.push({
            ...event,
            // Use original ID for the very first instance, generate for others
            id: isFirstInstance ? event.id : `${event.id}_${index}`,
            start: occurrenceStart,
            end: occurrenceEnd,
            isRecurring: true,
            // The base event's ID becomes the seriesId for all instances
            seriesId: event.id
          });
        });

      } catch (error) {
        console.error('Error expanding recurring event:', error, event);
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
    
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const calendarTasks = allTasks.filter(task => 
        task.addToCalendar && 
        task.scheduledDate && 
        !task.completed &&
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