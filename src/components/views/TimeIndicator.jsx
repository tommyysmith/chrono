import { useState, useEffect } from "react";

export default function TimeIndicator({ viewType }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Update immediately
    setCurrentTime(new Date());

    // Then update every minute
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []); // Empty dependency array to run only on mount

  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const hour = Math.floor(minutes / 60);
    const minuteOffset = (minutes % 60) / 60;
    const hourHeight = 64; // h-16 = 4rem = 64px

    // Position is based on the hour block plus the minute offset within that hour
    return hour * hourHeight + minuteOffset * hourHeight - 10; // -10px to align with hour markers
  };

  const position = getCurrentTimePosition();

  // Calculate the current day's position in the week view
  const todayIndex = currentTime.getDay();
  const columnWidth = `${100 / 7}%`;
  const leftOffset = `${(todayIndex * 100) / 7}%`;
  const isCurrentWeek = viewType === "week";

  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-50"
      style={{
        top: `${position}px`,
      }}
    >
      <div className="w-[60px] pr-2 flex justify-end">
        <span className="bg-primary text-white text-[10px] rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
          {currentTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </span>
      </div>
      <div className="flex-1 relative">
        {/* Base line across all days */}
        <div className="absolute inset-0 h-[1px] bg-primary/30" />

        {/* Bolder line for current day */}
        {isCurrentWeek && (
          <div
            className="absolute h-[2px] bg-primary"
            style={{
              left: leftOffset,
              width: columnWidth,
            }}
          >
            {/* Vertical lines at ends */}
            <div className="absolute left-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
            <div className="absolute right-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
