import { format, isSameDay } from "date-fns";
import TimeIndicator from "./TimeIndicator";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Day({
  selectedDate,
  events,
  dragState,
  pendingEventCell,
  setPendingEventCell,
  handleEventClick,
  handleEventContextMenu,
  handleCellDragStart,
  handleCellClick,
  handleDragOver,
  handleDrop,
  getTimeFromMousePosition,
  getColumnFromMousePosition,
  renderEvents,
  timeGridRef,
  commandBarRef,
}) {
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Fixed Headers */}
      <div className="flex-none z-10">
        {/* Empty header space */}
        <div className="grid grid-cols-[60px_1fr]">
          <div className="flex flex-col pointer-events-none">
            <div className="h-12" />
          </div>
          <div className="h-12 flex gap-1 flex-row items-center justify-start relative">
            <div className="absolute left-1/2 -translate-x-[60px] flex gap-1 items-center">
              <div className="text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
                {DAYS[selectedDate.getDay()]}
              </div>
              <div className="text-xs text-light-text dark:text-dark-text font-semibold">
                {isSameDay(selectedDate, new Date()) ? (
                  <span className="bg-primary text-white px-1 py-1 rounded-[5px]">
                    {format(selectedDate, "d")}
                  </span>
                ) : (
                  format(selectedDate, "d")
                )}
              </div>
            </div>
          </div>
        </div>

        {/* All-day events section */}
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
      </div>

      {/* Time grid */}
      <div
        ref={timeGridRef}
        className="flex-1 overflow-y-scroll scrollbar-hide relative"
      >
        <div className="grid grid-cols-[60px_1fr] h-[2000px] relative w-full calendar-grid">
          {/* Time indicator */}
          <TimeIndicator viewType="day" selectedDate={selectedDate} />

          {/* Time labels */}
          <div className="flex flex-col pointer-events-none">
            {HOURS.map((hour) => (
              <div key={hour} className={`${hour === 23 ? 'h-40' : 'h-20'} pr-2 relative`}>
                {hour !== 0 && (
                  <span className="absolute right-2 top-[-10px] text-[10px] mt-0.5 text-light-text/50 dark:text-dark-text/50">
                    {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'AM' : 'PM'}`}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Main grid area */}
          <div className="relative">
            {/* Background grid lines */}
            <div className="absolute inset-0">
              {HOURS.map((hour) => (
                <div key={hour} className={`${hour === 23 ? 'h-40' : 'h-20'}`}>
                  {hour !== 0 && (
                    <div className="absolute left-0 right-0 border-b border-light-border dark:border-dark-border" />
                  )}
                </div>
              ))}
              <div className="absolute inset-0">
                <div className="border-l border-light-border dark:border-dark-border h-full" />
              </div>
            </div>

            {/* Events layer */}
            <div className="relative h-full">
              {/* Drag overlays */}
              {dragState.isDragging && renderDropPreview()}
              {renderEvents()}
              {/* Pending event highlight */}
              {pendingEventCell && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${(pendingEventCell.column / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    top: `${pendingEventCell.startTime.getHours() * 80 + pendingEventCell.startTime.getMinutes() * (80/60)}px`,
                    height: "80px",
                    backgroundColor: "rgba(var(--primary-rgb), 0.1)",
                    border: "2px dashed rgba(var(--primary-rgb), 0.3)",
                  }}
                />
              )}
            </div>

            {/* Interaction layer */}
            <div
              onDoubleClick={(e) => {
                const container = e.currentTarget.closest(".calendar-grid");
                if (!container) return;

                const containerRect = container.getBoundingClientRect();
                const clickedTime = getTimeFromMousePosition(
                  e.clientY,
                  containerRect,
                  selectedDate,
                  80
                );
                const column = 0;

                // Create a new date at the start of the clicked hour
                const startTime = new Date(clickedTime);
                startTime.setMinutes(0);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);

                // Create end time exactly one hour after start
                const endTime = new Date(startTime.getTime() + 60 * 60000);

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
