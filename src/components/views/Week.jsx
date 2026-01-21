import { format, addDays, isSameDay } from "date-fns";
import { useEffect } from "react";
import { useDroppable } from '@dnd-kit/core';
import TimeIndicator from "./TimeIndicator";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Week({
  selectedDate,
  dragState,
  pendingEventCell,
  setPendingEventCell,
  handleCellDragStart,
  handleCellClick,
  handleDragOver,
  handleDrop,
  getTimeFromMousePosition,
  getColumnFromMousePosition,
  renderEvents,
  renderAllDayEvents,
  timeGridRef,
  commandBarRef,
  setEvents,
  taskDropPreview,
}) {
  // Setup droppable for @dnd-kit
  const { setNodeRef, isOver } = useDroppable({
    id: 'week-calendar-grid',
    data: {
      type: 'calendar',
      viewType: 'week'
    }
  });
  


  // Auto-scroll to current time position on mount and date change
  useEffect(() => {
    if (timeGridRef.current) {
      const currentTime = new Date();
      const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      const hour = Math.floor(minutes / 60);
      const minuteOffset = (minutes % 60) / 60;
      const hourHeight = 80;
      
      // Calculate position (same logic as TimeIndicator)
      const position = hour * hourHeight + minuteOffset * hourHeight - 10;
      
      // Scroll to position with some offset to show context above
      const scrollPosition = Math.max(0, position - 100);
      
      timeGridRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [selectedDate, timeGridRef]);
  const weekStart = new Date(selectedDate);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  return (
    <div className="flex-1 flex select-none flex-col h-full">
      {/* Fixed Headers */}
      <div className="flex-none z-10">
        {/* Days header */}
        <div className="grid grid-cols-[60px_1fr]">
          {/* Time column header */}
          <div className="flex flex-col pointer-events-none">
            <div className="h-12" />
          </div>

          {/* Main grid area */}
          <div className="grid grid-cols-7">
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
                      <span className="text-white bg-primary h-5 w-5 flex items-center justify-center rounded-[5px]">
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
        className="flex-1 overflow-y-scroll scrollbar-hide relative "
      >
        <div className="grid grid-cols-[60px_1fr] h-[2000px] relative w-full calendar-grid">
          {/* Time indicator */}
          <TimeIndicator viewType="week" selectedDate={selectedDate} />

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
                    <div className="absolute left-0 right-0 border-b border-light-border/50 dark:border-dark-border" />
                  )}
                </div>
              ))}
              <div className="absolute inset-0 grid grid-cols-7 h-full">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-l border-light-border/50 dark:border-dark-border h-full relative"
                  />
                ))}
              </div>
            </div>



            {/* Events layer */}
            <div className="col-span-7 h-full relative">
              {renderEvents()}
              {/* Pending event highlight */}
              {pendingEventCell && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${(pendingEventCell.column / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    top: `${pendingEventCell.startTime.getHours() * 80 + pendingEventCell.startTime.getMinutes() * (80/60)}px`, // Use 80px/hour
                    height: "80px", // Default height for pending cell (can be adjusted)
                    backgroundColor: "rgba(var(--primary-rgb), 0.1)",
                    border: "2px dashed rgba(var(--primary-rgb), 0.3)",
                  }}
                />
              )}

              {/* Task drop preview */}
              {taskDropPreview && (
                <div
                  className="absolute pointer-events-none z-20 rounded-[9px] border-2 border-[#4BA3E3] bg-[#4BA3E3]/20"
                  style={{
                    left: `calc(${(taskDropPreview.column / 7) * 100}% + 2px)`,
                    width: `calc(${100 / 7}% - 12px)`,
                    top: `${taskDropPreview.start.getHours() * 80 + taskDropPreview.start.getMinutes() * (80/60)}px`,
                    height: `${Math.max(((taskDropPreview.end.getTime() - taskDropPreview.start.getTime()) / (1000 * 60)) * (80/60) - 2, 20)}px`,
                  }}
                >
                  <div className="px-2 py-1 text-[#4BA3E3] overflow-hidden h-full">
                    <div className="font-medium text-xs truncate">
                      {taskDropPreview.task?.title || taskDropPreview.task?.name || 'New Event'}
                    </div>
                    <div className="text-xs opacity-70">
                      {format(taskDropPreview.start, "h:mm a")} – {format(taskDropPreview.end, "h:mm a")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interaction layer - now also a drop zone */}
            <div
              ref={setNodeRef}
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
                const column = getColumnFromMousePosition(
                  e.clientX,
                  containerRect
                );

                // Create a new date at the start of the clicked hour
                const startTime = new Date(clickedTime);
                startTime.setMinutes(0);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);

                // Get default duration from localStorage (default to 60 minutes)
                const defaultDuration = parseInt(localStorage.getItem('defaultEventDuration') || '60');

                // Create end time using default duration
                const endTime = new Date(startTime.getTime() + defaultDuration * 60000);

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

                // Create a visual draft event
                const draftEventId = crypto.randomUUID();
                const draftEvent = {
                  id: draftEventId,
                  title: '',
                  start: new Date(startTime.getTime()),
                  end: new Date(endTime.getTime()),
                  color: localStorage.getItem('defaultEventColor') || '#F59E0B',
                  repeat: 'none',
                  isDraft: true
                };

                // Add the draft event to the events state
                setEvents(prev => [...prev, draftEvent]);

                // Open command bar with the hour-aligned times
                commandBarRef.current?.openWithDragData(startTime, endTime, draftEventId);
              }}
              onMouseDown={handleCellDragStart}
              onClick={(e) => handleCellClick(e, new Date(selectedDate))}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleDrop(e, new Date(selectedDate))}
              className={`absolute inset-0 ${isOver ? 'z-30' : ''}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
