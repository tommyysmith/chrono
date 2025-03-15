/**
 * Calculates a time value based on mouse Y position relative to a container
 *
 * @param {number} mouseY - The mouse Y coordinate
 * @param {DOMRect} containerRect - The bounding rectangle of the container
 * @param {Date} currentDate - The reference date to use for the time
 * @returns {Date} A date object representing the calculated time
 */
export const getTimeFromMousePosition = (
  mouseY,
  containerRect,
  currentDate
) => {
  const hourHeight = 64;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const relativeY = mouseY + scrollTop - containerRect.top;
  const totalHours = relativeY / hourHeight;

  // Calculate minutes, allowing selection past 23:00
  const totalMinutes = Math.min(totalHours * 60, 24 * 60);
  const roundedMinutes = Math.round(totalMinutes / 15) * 15;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  // Create date at the exact time
  const time = new Date(currentDate);
  if (hours === 24) {
    // Handle midnight case
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return nextDay;
  } else {
    time.setHours(hours);
    time.setMinutes(minutes);
    time.setSeconds(0);
    time.setMilliseconds(0);
    return time;
  }
};

/**
 * Calculates the column index based on mouse X position relative to a container
 *
 * @param {number} mouseX - The mouse X coordinate
 * @param {DOMRect} containerRect - The bounding rectangle of the container
 * @returns {number} The calculated column index (0-6)
 */
export const getColumnFromMousePosition = (mouseX, containerRect) => {
  const timeColumnWidth = 60;
  const availableWidth = containerRect.width - timeColumnWidth;
  const dayWidth = availableWidth / 7;
  const relativeX = mouseX - containerRect.left - timeColumnWidth;
  const column = Math.floor(relativeX / dayWidth);
  return Math.max(0, Math.min(6, column));
};
