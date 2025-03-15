import { ViewType } from "../constants/views.js";
import { subDays, addDays, addMonths } from "date-fns";

export const handlePrevious = (viewType, currentDate, onDateSelect) => {
  if (viewType === ViewType.WEEK) {
    return onDateSelect?.(subDays(currentDate, 7));
  } else if (viewType === ViewType.DAY) {
    return onDateSelect?.(subDays(currentDate, 1));
  } else if (viewType === ViewType.MONTH) {
    return onDateSelect?.(addMonths(currentDate, -1));
  }
};

export const handleNext = (viewType, currentDate, onDateSelect) => {
  if (viewType === ViewType.WEEK) {
    return onDateSelect?.(addDays(currentDate, 7));
  } else if (viewType === ViewType.DAY) {
    return onDateSelect?.(addDays(currentDate, 1));
  } else if (viewType === ViewType.MONTH) {
    return onDateSelect?.(addMonths(currentDate, 1));
  }
};

export const handleToday = (onDateSelect) => {
  const today = new Date();
  // Create date using local time
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  return onDateSelect?.(todayDate);
};

//Nav handlers used by command bar - used in a callback with dependencies of onDateSelect, currentDate, viewType,
//believe these could be moved to a context and then dont need to be passed down through prop drillingviewType, currentDate
