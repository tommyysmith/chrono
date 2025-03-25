import {
  format,
  addDays,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";

import { useRef } from "react";

import TimeIndicator from "./TimeIndicator";

import {
  getTimeFromMousePosition,
  getColumnFromMousePosition,
} from "@/utils/positionUtils.js";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TimeGridView({
  selectedDate,
  events,
  pendingEventCell,
  setPendingEventCell,
  handleEventClick,
  handleEventContextMenu,
  handleCellDragStart,
  handleCellClick,
  handleDrop,
  contextMenu,
  commandBarRef,
  currentDate,
  viewType,
}) {
  const timeGridRef = useRef(null);

  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Render functions
  const renderTimeGridEvents = () => {
    if (viewType === "month") return null;

    // Implement event rendering for day/week view
    return (
      <div className="absolute inset-0">
        {events
          .filter((event) => {
            // Filter events visible in the current view
            if (viewType === "day") {
              return isSameDay(event.start, selectedDate);
            } else if (viewType === "week") {
              const weekStart = new Date(selectedDate);
              weekStart.setDate(weekStart.getDate() - weekStart.getDay());
              const weekEnd = addDays(weekStart, 6);
              return event.start >= weekStart && event.start <= weekEnd;
            }
            return false;
          })
          .map((event) => (
            <div
              key={event.id}
              className="absolute rounded-md overflow-hidden"
              style={{
                // Position calculation based on time and day
                backgroundColor: event.color || "#808080",
                color: "#fff",
                // Set width, height, left, top based on event time and duration
              }}
              onClick={() => handleEventClick(event)}
              onContextMenu={(e) => handleEventContextMenu(e, event.id)}
            >
              <div className="p-1 text-xs">{event.title}</div>
            </div>
          ))}
      </div>
    );
  };

  const renderAllDayEvents = () => {
    if (viewType === "month") return null;

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
                  event.isAllDay &&
                  (viewType === "day"
                    ? isSameDay(event.start, selectedDate)
                    : true) // For week view show all all-day events
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
                  onClick={(e) => e.stopPropagation()}
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

  // Month view
  if (viewType === "month") {
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const days = eachDayOfInterval({ start, end });

    // Calculate days from previous month to fill first week
    const firstDay = start.getDay();
    const prevMonthDays = Array.from({ length: firstDay }, (_, i) => {
      const date = new Date(start);
      date.setDate(date.getDate() - (firstDay - i));
      return date;
    });

    // Calculate days from next month to fill last week
    const lastDay = end.getDay();
    const nextMonthDays = Array.from({ length: 6 - lastDay }, (_, i) => {
      const date = new Date(end);
      date.setDate(date.getDate() + i + 1);
      return date;
    });

    const allDays = [...prevMonthDays, ...days, ...nextMonthDays];

    return (
      <div className="flex-1 flex flex-col">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-light-bg-light dark:bg-dark-bg-light">
          {DAYS.map((day) => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs font-medium text-light-text/50 dark:text-dark-text/50"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 bg-light-border dark:bg-dark-border gap-px">
          {allDays.map((day, index) => {
            const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`bg-light-bg dark:bg-dark-bg p-1 flex flex-col ${
                  isCurrentMonth
                    ? "text-light-text dark:text-dark-text"
                    : "text-light-text/30 dark:text-dark-text/30"
                } ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
                onClick={() => handleCellClick(null, day)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className="text-xs font-medium mb-1">
                  {format(day, "d")}
                </div>
                <div className="space-y-1 overflow-y-auto flex-1">
                  {events
                    .filter((event) => isSameDay(event.start, day))
                    .slice(0, 4) // Limit visible events for space
                    .map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded cursor-pointer truncate"
                        style={{
                          backgroundColor: event.color || "#808080",
                          color: "#fff",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleEventContextMenu(e, event.id);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                  {events.filter((event) => isSameDay(event.start, day))
                    .length > 4 && (
                    <div className="text-xs text-light-text/50 dark:text-dark-text/50">
                      +
                      {events.filter((event) => isSameDay(event.start, day))
                        .length - 4}{" "}
                      more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // TimeGrid view (day or week)
  const isWeekView = viewType === "week";
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const renderDayHeader = (date, index) => {
    return (
      <div
        key={index}
        className={`h-12 flex gap-1 flex-row items-center justify-center ${
          isSameDay(date, new Date())
            ? ""
            : "bg-light-background-secondary dark:bg-dark-background-secondary"
        }`}
      >
        <div className="text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
          {DAYS[date.getDay()]}
        </div>
        <div className="text-xs text-light-text dark:text-dark-text font-semibold">
          {isSameDay(date, new Date()) ? (
            <span className="text-white bg-primary px-1 py-1 rounded-md">
              {format(date, "d")}
            </span>
          ) : (
            format(date, "d")
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Fixed Headers */}
      <div className="flex-none bg-light-bg-light dark:bg-dark-bg-light z-10">
        {/* Days header */}
        <div className="grid grid-cols-[60px_1fr]">
          {/* Time column header */}
          <div className="flex flex-col pointer-events-none">
            <div className="h-12" />
          </div>

          {/* Main grid area */}
          <div className={isWeekView ? "grid grid-cols-7" : ""}>
            {isWeekView ? (
              // Week view - render 7 days
              Array.from({ length: 7 }).map((_, i) => {
                const date = addDays(weekStart, i);
                return renderDayHeader(date, i);
              })
            ) : (
              // Day view - render single day
              <div className="h-12 flex gap-1 flex-row items-center justify-center relative">
                <div className="absolute left-1/2 -translate-x-[60px] flex gap-1 items-center">
                  {renderDayHeader(selectedDate, 0)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All-day events section */}
        {renderAllDayEvents()}
      </div>

      {/* Time grid */}
      <div
        ref={timeGridRef}
        className="flex-1 overflow-y-scroll scrollbar-hide relative"
      >
        <div className="grid grid-cols-[60px_1fr] h-[1600px] relative w-full calendar-grid">
          {/* Time indicator */}
          <TimeIndicator viewType={viewType} />

          {/* Time labels */}
          <div className="flex flex-col pointer-events-none">
            {HOURS.map((hour) => (
              <div key={hour} className="h-16 pr-2 relative">
                <span className="absolute right-2 top-[-10px] text-xs text-gray-500">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Main grid area */}
          <div className="relative">
            {/* Background grid lines */}
            <div className="absolute inset-0">
              {HOURS.map((hour) => (
                <div key={hour} className="h-16">
                  <div className="absolute left-0 right-0 border-b border-light-border dark:border-dark-border" />
                </div>
              ))}
              <div className="absolute inset-0">
                {isWeekView ? (
                  <div className="grid grid-cols-7 h-full">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div
                        key={i}
                        className="border-l border-light-border dark:border-dark-border h-full relative"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border-l border-light-border dark:border-dark-border h-full" />
                )}
              </div>
            </div>

            {/* Events layer */}
            <div
              className={`relative h-full ${isWeekView ? "col-span-7" : ""}`}
            >
              {/* Render events */}
              {renderTimeGridEvents()}

              {/* Pending event highlight */}
              {pendingEventCell && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${
                      (pendingEventCell.column / (isWeekView ? 7 : 1)) * 100
                    }%`,
                    width: `${100 / (isWeekView ? 7 : 1)}%`,
                    top: `${pendingEventCell.startTime.getHours() * 64}px`,
                    height: "64px",
                    backgroundColor: "rgba(var(--primary-rgb), 0.1)",
                    border: "2px dashed rgba(var(--primary-rgb), 0.3)",
                  }}
                />
              )}
            </div>

            {/* Interaction layer */}
            <div
              onDoubleClick={(e) => {
                // Don't create events if context menu is open
                if (contextMenu.show) return;

                const container = e.currentTarget.closest(".calendar-grid");
                if (!container) return;

                const containerRect = container.getBoundingClientRect();
                const clickedTime = getTimeFromMousePosition(
                  e.clientY,
                  containerRect,
                  currentDate
                );
                const column = isWeekView
                  ? getColumnFromMousePosition(e.clientX, containerRect)
                  : 0;

                // Create a new date at the start of the clicked hour
                const startTime = new Date(clickedTime);
                startTime.setMinutes(0);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);

                // Create end time exactly one hour after start
                const endTime = new Date(startTime.getTime() + 60 * 60000);

                // Adjust for week view
                if (isWeekView) {
                  startTime.setDate(weekStart.getDate() + column);
                  endTime.setDate(weekStart.getDate() + column);
                }

                // Set the pending event cell
                setPendingEventCell({
                  startTime,
                  endTime,
                  column,
                });

                // Open command bar with the hour-aligned times
                commandBarRef.current?.openWithDragData(startTime, endTime);
              }}
              onMouseDown={handleCellDragStart}
              onClick={(e) => handleCellClick(e, new Date(selectedDate))}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, new Date(selectedDate))}
              className="absolute inset-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
