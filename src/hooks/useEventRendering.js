import { useCallback, useEffect } from "react";
import { format, isSameDay, addDays } from "date-fns";
import { RRule } from "rrule";
import { Repeat } from "@/assets/icons/Repeat";
import { ViewType } from "../constants/views";
import { motion } from "framer-motion";
import { findOverlappingGroup, getEventStyle } from "@/utils/eventUtils";

export function useEventRendering(
  events,
  selectedDate,
  viewType,
  dragState,
  handleDragStart,
  handleEventClick,
  handleEventContextMenu,
  handleResizeStart
) {
  const expandRecurringEvents = useCallback((events, dateRangeStart, dateRangeEnd) => {
  const expandedEvents = [];
  
  events.forEach(event => {
    if (!event.rruleOptions && !event.seriesId) {
      // Not a recurring event
      expandedEvents.push(event);
      return;
    }
    
    try {
      // For events with RRule options, expand the occurrences
      if (event.rruleOptions) {
        const rule = new RRule({
          ...event.rruleOptions,
          dtstart: new Date(event.start)
        });
        
        const occurrences = rule.between(dateRangeStart, dateRangeEnd, true);
        
        occurrences.forEach((occurrenceDate, index) => {
          const startDate = new Date(event.start);
          const endDate = new Date(event.end);
          
          // Calculate duration to maintain it across occurrences
          const duration = endDate - startDate;
          
          const occurrenceStart = occurrenceDate;
          const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
          
          expandedEvents.push({
            ...event,
            id: `${event.id}_${index}`, // Unique ID for each occurrence
            start: occurrenceStart,
            end: occurrenceEnd,
            isRecurring: true,
            seriesId: event.seriesId || event.id
          });
        });
      } else if (event.seriesId) {
        // Handle simple repeat patterns (legacy)
        expandedEvents.push(event);
      }
    } catch (error) {
      console.error('Error expanding recurring event:', error);
      expandedEvents.push(event); // Fallback to original event
    }
  });
  
  return expandedEvents;
}, []);

const renderEvents = useCallback(() => {
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

      return filteredEvents.map((event) => {
        const overlappingEvents = findOverlappingGroup(event, filteredEvents);
        const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
        const repeatClass = isRepeatEvent ? "repeat-event" : "";

        return (
          <motion.div
            key={event.id}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer select-none ${
              event.isEditing || dragState.eventId === event.id
                ? "bg-primary/30"
                : "bg-primary/10"
            } event-item ${repeatClass}`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0 && !e.target.closest(".resize-handle")) {
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: event.color || "#808080" }}
            />
            {/* Resize handles */}
            <div
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, event.id, "top");
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, event.id, "bottom");
              }}
            />
            <div className="px-3 py-1">
              <div className="font-medium text-xs">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {isRepeatEvent && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </motion.div>
        );
      });
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

      return dayEvents.map((event) => {
        const overlappingEvents = findOverlappingGroup(event, dayEvents);
        const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
        const repeatClass = isRepeatEvent ? "repeat-event" : "";

        return (
          <motion.div
            key={event.id}
            whileTap={{ scale: 0.95 }}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-move ${
              dragState.eventId === event.id ? "bg-primary/30" : "bg-primary/10"
            } ${repeatClass}`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0 && !e.target.closest(".resize-handle")) {
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1"
              style={{ backgroundColor: event.color || "#808080" }}
            />
            {/* Resize handles */}
            <div
              className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, event.id, "top");
              }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize resize-handle hover:bg-primary/20"
              onMouseDown={(e) => {
                e.stopPropagation();
                handleResizeStart(e, event.id, "bottom");
              }}
            />
            <div className="px-2 py-1">
              <div className="font-medium text-sm">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {isRepeatEvent && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </motion.div>
        );
      });
    }
  }, [
    events,
    selectedDate,
    viewType,
    dragState,
    handleDragStart,
    handleEventClick,
    handleEventContextMenu,
    handleResizeStart,
  ]);



  const renderAllDayEvents = () => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      return (
        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          <div className="relative grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const currentDate = addDays(weekStart, dayIndex);
              const dayEvents = events.filter((event) => {
                // Check both allDay and isAllDay properties to ensure compatibility
                const isAllDayEvent = event.allDay || event.isAllDay;
                return isAllDayEvent && isSameDay(event.start, currentDate);
              });

              return (
                <div
                  key={dayIndex}
                  className="relative border-l border-light-border dark:border-dark-border min-h-[32px]"
                >
                  <div className="flex flex-col gap-1 p-1">
                    {dayEvents.map((event) => {
                      const now = new Date();
                      const isPastEvent = new Date(event.end) < now;

                      return (
                        <div
                          key={event.id}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            handleEventClick(event);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          onContextMenu={(e) =>
                            handleEventContextMenu(e, event.id)
                          }
                          className="flex items-center text-xs cursor-pointer hover:bg-black/5 select-none dark:hover:bg-white/5 rounded-[5px] overflow-hidden"
                          style={{
                            backgroundColor: event.color
                              ? `${event.color}20`
                              : "#80808020",
                            opacity: isPastEvent ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="w-1 self-stretch"
                            style={{ backgroundColor: event.color || "#808080" }}
                          />
                          <div className="px-2 py-1">
                            <div className="font-medium text-xs">
                              {event.title}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
        <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
          All-day
        </div>
        <div className="relative">
          <div className="flex flex-col gap-1 p-1">
            {events
              .filter(
                (event) =>
                  event.isAllDay && isSameDay(event.start, selectedDate)
              )
              .map((event) => {
                const now = new Date();
                const isPastEvent = new Date(event.end) < now;

                return (
                  <div
                    key={event.id}
                    className="z-10 bg-primary/5 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/10"
                    style={{
                      backgroundColor: event.color
                        ? `${event.color}20`
                        : "#80808020",
                      opacity: isPastEvent ? 0.5 : 1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                    onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{ backgroundColor: event.color || "#808080" }}
                    />
                    <div className="px-3 py-1">
                      <div className="font-medium text-xs">{event.title}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  };

  return {
    renderEvents,
    renderAllDayEvents,
  };
}
