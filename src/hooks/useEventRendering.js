import { useCallback } from "react";
import { format, isSameDay, addDays } from "date-fns";
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
  const renderEvents = useCallback(() => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const filteredEvents = events.filter((event) => {
        const eventStart = new Date(event.start);
        return (
          eventStart >= weekStart && eventStart < weekEnd && !event.isAllDay
        );
      });

      return filteredEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, filteredEvents);

        return (
          <motion.div
            key={`${event.id}-${index}`}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer ${
              event.isEditing || dragState.eventId === event.id
                ? "bg-primary/30"
                : "bg-primary/10"
            } event-item`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0) {
                // Left click only
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
            {/* Only show resize handles for non-editing events */}
            {!event.isEditing && (
              <>
                {/* Vertical resize handles */}
                <div
                  className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "top")}
                />
                <div
                  className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "bottom")}
                />
                {/* Horizontal resize handles */}
                <div
                  className="absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "left")}
                />
                <div
                  className="absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, "right")}
                />
              </>
            )}
            <div className="px-3 py-1">
              <div className="font-medium text-xs">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {event.repeat && event.repeat !== "none" && (
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
      const dayEvents = events.filter(
        (event) => !event.isAllDay && isSameDay(event.start, selectedDate)
      );

      return dayEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, dayEvents);

        return (
          <motion.div
            key={`${event.id}-${index}`}
            whileTap={{ scale: 0.95 }}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-move ${
              dragState.eventId === event.id ? "bg-primary/30" : "bg-primary/10"
            }`}
            style={getEventStyle(event, overlappingEvents, viewType)}
            onMouseDown={(e) => {
              if (e.button === 0) {
                // Left click only
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
            <div className="px-2 py-1">
              <div className="font-medium text-sm">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {event.repeat && event.repeat !== "none" && (
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
              const dayEvents = events.filter(
                (event) => event.isAllDay && isSameDay(event.start, currentDate)
              );

              return (
                <div
                  key={dayIndex}
                  className="relative border-l border-light-border dark:border-dark-border min-h-[32px]"
                >
                  <div className="flex flex-col gap-1 p-1">
                    {dayEvents.map((event, index) => (
                      <div
                        key={`${event.id}-${index}`}
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
                        className="flex items-center text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] overflow-hidden"
                        style={{
                          backgroundColor: event.color
                            ? `${event.color}20`
                            : "#80808020",
                        }}
                      >
                        <div
                          className="w-1 self-stretch mr-1.5"
                          style={{ backgroundColor: event.color || "#808080" }}
                        />
                        <div className="px-3 py-1">
                          <div className="font-medium text-xs">
                            {event.title}
                          </div>
                        </div>
                      </div>
                    ))}
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
              .map((event, index) => (
                <div
                  key={`${event.id}-${index}`}
                  className="z-10 bg-primary/5 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/10"
                  style={{
                    backgroundColor: event.color
                      ? `${event.color}20`
                      : "#80808020",
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
              ))}
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
