import { useCallback, useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { findOverlappingGroup } from '@/utils/eventUtils';

export function useVirtualizedEventRendering({
  events,
  visibleDays,
  dayWidth,
}) {
  const eventsGroupedByDay = useMemo(() => {
    const grouped = new Map();
    
    visibleDays.forEach(day => {
      grouped.set(day.toISOString(), []);
    });
    
    events.forEach(event => {
      if (!event.start) return;
      
      const eventDate = new Date(event.start);
      const matchingDay = visibleDays.find(day => isSameDay(day, eventDate));
      
      if (matchingDay) {
        const key = matchingDay.toISOString();
        const dayEvents = grouped.get(key) || [];
        dayEvents.push(event);
        grouped.set(key, dayEvents);
      }
    });
    
    return grouped;
  }, [events, visibleDays]);

  const getEventStyleForVirtualizedView = useCallback((event, dayIndex) => {
    const dayEvents = eventsGroupedByDay.get(visibleDays[dayIndex]?.toISOString()) || [];
    const overlappingEvents = findOverlappingGroup(event, dayEvents);
    
    const style = {
      position: 'absolute',
      zIndex: 10,
      overflow: 'hidden',
      cursor: 'pointer',
    };

    if (event.start) {
      const minutes = event.start.getHours() * 60 + event.start.getMinutes();
      style.top = `${minutes * (80 / 60)}px`;
    }

    if (event.end && event.start) {
      const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const calculatedHeight = (endMinutes - startMinutes) * (80 / 60);
      const minHeight = 15;
      style.height = `${Math.max(calculatedHeight - 2, minHeight - 2)}px`;
    }

    const baseLeft = dayIndex * dayWidth;

    if (overlappingEvents.length > 0) {
      const sortedEvents = [event, ...overlappingEvents].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;
        const aDuration = a.end.getTime() - a.start.getTime();
        const bDuration = b.end.getTime() - b.start.getTime();
        if (aDuration !== bDuration) return bDuration - aDuration;
        return (a.id || '').localeCompare(b.id || '');
      });

      const eventIndex = sortedEvents.findIndex(e => e.id === event.id);
      const totalEvents = overlappingEvents.length + 1;
      const eventWidth = (dayWidth * 0.95) / totalEvents;
      const offset = eventWidth * eventIndex + dayWidth * 0.025;

      style.width = `${eventWidth - 8}px`;
      style.left = `${baseLeft + offset}px`;
    } else {
      style.width = `${dayWidth - 20}px`;
      style.left = `${baseLeft + 2}px`;
    }

    if (!event.isTask && !event.isTaskBlock) {
      style.backgroundColor = event.color ? `${event.color}20` : '#80808020';
      style.borderRadius = '4px';
      style.padding = '2px 4px';
      style.fontSize = '12px';
    }

    if (event.isDraft) {
      style.border = `1px dashed ${event.color || '#808080'}`;
      style.opacity = 0.3;
      style.backgroundColor = event.color ? `${event.color}10` : '#80808010';
    } else {
      const now = new Date();
      if (event.end < now && !event.isTaskBlock) {
        style.opacity = 0.5;
      }
    }

    return style;
  }, [eventsGroupedByDay, visibleDays, dayWidth]);

  const getColumnForDate = useCallback((date) => {
    const index = visibleDays.findIndex(day => isSameDay(day, date));
    return index >= 0 ? index : -1;
  }, [visibleDays]);

  const getDateForColumn = useCallback((columnIndex) => {
    return visibleDays[columnIndex] || null;
  }, [visibleDays]);

  return {
    eventsGroupedByDay,
    getEventStyleForVirtualizedView,
    getColumnForDate,
    getDateForColumn,
  };
}
