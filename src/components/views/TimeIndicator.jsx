import { useState, useEffect, useMemo } from "react";
import { isSameWeek, isSameDay } from "date-fns";

export default function TimeIndicator({ 
  viewType, 
  selectedDate,
  visibleDays = null,
  dayWidth = null,
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setCurrentTime(new Date());

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const getCurrentTimePosition = () => {
    const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const hour = Math.floor(minutes / 60);
    const minuteOffset = (minutes % 60) / 60;
    const hourHeight = 80;

    return hour * hourHeight + minuteOffset * hourHeight - 10;
  };

  const position = getCurrentTimePosition();

  const isVirtualized = visibleDays !== null && dayWidth !== null;

  const todayColumnInfo = useMemo(() => {
    if (isVirtualized) {
      const todayIndex = visibleDays.findIndex(day => isSameDay(day, currentTime));
      if (todayIndex === -1) return null;
      
      return {
        left: todayIndex * dayWidth,
        width: dayWidth,
        isVisible: true,
      };
    } else {
      const todayIndex = currentTime.getDay();
      const isCurrentWeek = viewType === "week" && selectedDate && isSameWeek(currentTime, selectedDate);
      
      if (!isCurrentWeek) return null;
      
      return {
        left: `${(todayIndex * 100) / 7}%`,
        width: `${100 / 7}%`,
        isVisible: true,
      };
    }
  }, [isVirtualized, visibleDays, dayWidth, currentTime, viewType, selectedDate]);

  if (isVirtualized) {
    const totalWidth = visibleDays.length * dayWidth;
    
    return (
      <div
        className="absolute flex items-center pointer-events-none z-10"
        style={{
          top: `${position}px`,
          left: 0,
          width: totalWidth,
        }}
      >
        <div className="relative w-full">
          <div className="absolute inset-0 h-[1px] bg-primary/30" />

          {todayColumnInfo && (
            <div
              className="absolute h-[2px] bg-primary"
              style={{
                left: `${todayColumnInfo.left}px`,
                width: `${todayColumnInfo.width}px`,
              }}
            >
              <div className="absolute left-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
              <div className="absolute right-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
            </div>
          )}
        </div>
      </div>
    );
  }

  const isCurrentWeek = viewType === "week" && selectedDate && isSameWeek(currentTime, selectedDate);

  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-10"
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
        <div className="absolute inset-0 h-[1px] bg-primary/30" />

        {isCurrentWeek && todayColumnInfo && (
          <div
            className="absolute h-[2px] bg-primary"
            style={{
              left: todayColumnInfo.left,
              width: todayColumnInfo.width,
            }}
          >
            <div className="absolute left-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
            <div className="absolute right-0 top-[-3px] w-[2px] h-[8px] bg-primary rounded-sm" />
          </div>
        )}
      </div>
    </div>
  );
}
