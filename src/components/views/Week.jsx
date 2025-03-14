import { format, addDays, isSameDay } from "date-fns";

import TimeIndicator from "./TimeIndicator";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Week({
  selectedDate,
  dragState,
  pendingEventCell,
  handleCellDragStart,
  handleCellClick,
  handleDragOver,
  handleDrop,
  getTimeFromMousePosition,
  getColumnFromMousePosition,
  renderEvents,
  renderAllDayEvents,
  timeGridRef,
}) {
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Headers */}
      <div className="flex-none">
        {/* Days header */}
        <div className="grid grid-cols-[60px_1fr]">
          {/* Time column header */}
          <div className="flex flex-col pointer-events-none">
            <div className="h-12" />
          </div>

          {/* Main grid area */}
          <div className="grid grid-cols-7">
            {/* Background grid lines */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 grid grid-cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className=" h-full relative" />
                ))}
              </div>
            </div>

            {/* Days */}
            {Array.from({ length: 7 }).map((_, i) => {
              const date = addDays(weekStart, i);
              return (
                <div
                  key={i}
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
            })}
          </div>
        </div>

        {/* All-day events section */}
        {renderAllDayEvents()}
      </div>

      {/* Time grid */}
      <div
        ref={timeGridRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative"
      >
        <div className="grid grid-cols-[60px_1fr] h-[1600px] relative w-full calendar-grid">
          {/* Time indicator */}
          <TimeIndicator />

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
              <div className="absolute inset-0 grid grid-cols-7 h-full">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-l border-light-border dark:border-dark-border h-full relative"
                  />
                ))}
              </div>
            </div>

            {/* Events layer */}
            <div className="col-span-7 h-full relative">
              {/* Drag overlays */}
              {dragState.isDragging &&
                (dragState.eventId ? renderDropPreview() : renderDragOverlay())}
              {renderEvents()}
              {/* Pending event highlight */}
              {pendingEventCell && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${(pendingEventCell.column / 7) * 100}%`,
                    width: `${100 / 7}%`,
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
                  containerRect
                );
                const column = getColumnFromMousePosition(
                  e.clientX,
                  containerRect
                );

                // Create a new date at the start of the clicked hour
                const startTime = new Date(clickedTime);
                startTime.setMinutes(0);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);

                // Create end time exactly one hour after start
                const endTime = new Date(startTime.getTime() + 60 * 60000);

                // Adjust for week view
                const weekStart = new Date(selectedDate);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                startTime.setDate(weekStart.getDate() + column);
                endTime.setDate(weekStart.getDate() + column);

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
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleDrop(e, new Date(selectedDate))}
              className="absolute inset-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
