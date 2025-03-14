import { format, isSameDay, isSameMonth } from "date-fns";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  // Add days from previous month to start on Monday
  const firstDayOfWeek = firstDay.getDay() || 7;
  for (let i = 1; i < firstDayOfWeek; i++) {
    const date = new Date(year, month, 1 - i);
    days.unshift({ date, isCurrentMonth: false });
  }

  // Add days of current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true });
  }

  // Add days from next month to complete the grid
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }

  return days;
}

export default function Month({
  selectedDate,
  events,
  handleEventClick,
  handleEventContextMenu,
}) {
  const visibleDays = getMonthDays(
    selectedDate.getFullYear(),
    selectedDate.getMonth()
  );

  const getDayEvents = (date) => {
    const compareDate = new Date(date);
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return (
        eventDate.getFullYear() === compareDate.getFullYear() &&
        eventDate.getMonth() === compareDate.getMonth() &&
        eventDate.getDate() === compareDate.getDate()
      );
    });
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b border-light-border dark:border-dark-border">
        {DAYS.map((day) => (
          <div key={day} className="h-8 flex items-center justify-end p-2">
            <span className="text-xs text-gray-500 font-medium">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
        {visibleDays.map((dayInfo, i) => {
          const isToday = isSameDay(dayInfo.date, new Date());
          const isCurrentMonth = isSameMonth(dayInfo.date, selectedDate);
          const dayEvents = getDayEvents(dayInfo.date);

          return (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-light-border dark:border-dark-border p-1 ${
                !isCurrentMonth
                  ? "bg-light-background-secondary dark:bg-dark-background-secondary"
                  : ""
              }`}
            >
              {/* Date number */}
              <div className="flex justify-end mb-1">
                <span
                  className={`text-sm px-1 rounded-md ${
                    isToday
                      ? "bg-primary text-white font-medium"
                      : !isCurrentMonth
                      ? "text-gray-500"
                      : ""
                  }`}
                >
                  {format(dayInfo.date, "d")}
                </span>
              </div>

              {/* Events */}
              <div className="space-y-1">
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
                    onContextMenu={(e) => handleEventContextMenu(e, event.id)}
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
                    <span className="text-gray-500 py-1">
                      {format(new Date(event.start), "HH:mm")}
                    </span>
                    <span className="ml-1 truncate py-1">{event.title}</span>
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
