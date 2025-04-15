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
  const hourHeight = 80; 
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const relativeY = mouseY + scrollTop - containerRect.top;
  const totalHours = relativeY / hourHeight;

  // Ensure calculations are based on the provided currentDate's day
  const date = new Date(currentDate);
  
  // Calculate total minutes based on position
  const totalMinutes = totalHours * 60;
  
  // Snap to the nearest 15 minutes
  let snappedMinutesTotal = Math.round(totalMinutes / 15) * 15;

  // Clamp total snapped minutes to the range 0 - 1439 (00:00 to 23:59)
  snappedMinutesTotal = Math.max(0, Math.min(23 * 60 + 59, snappedMinutesTotal));

  // Calculate final hours and minutes from the clamped snapped value
  const hours = Math.floor(snappedMinutesTotal / 60);
  const minutes = snappedMinutesTotal % 60;

  date.setHours(hours, minutes, 0, 0);

  return date;
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
