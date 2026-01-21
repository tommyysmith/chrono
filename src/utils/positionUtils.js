/**
 * Calculates a time value based on mouse Y position relative to a container
 *
 * @param {number} mouseY - The mouse Y coordinate
 * @param {DOMRect} containerRect - The bounding rectangle of the container
 * @param {Date} currentDate - The reference date to use for the time
 * @param {number} [hourHeight=80] - The height of an hour in pixels
 * @returns {Date} A date object representing the calculated time
 */
export const getTimeFromMousePosition = (
  mouseY,
  containerRect,
  currentDate,
  hourHeight = 80,
  scrollTop = 0
) => {
  // Note: scrollTop should be passed by the caller if using a scrollable container
  // For window scroll, pass window.scrollY; for container scroll, pass container.scrollTop
  const relativeY = Math.max(0, mouseY - containerRect.top + scrollTop); // Ensure relativeY is not negative

  // --- Handle variable last slot height ---
  const standardGridHeight = 23 * hourHeight; // Height up to 23:00
  const lastSlotHeight = 2 * hourHeight;     // Height of the 23:00 slot (assuming double)

  let totalHours;
  if (relativeY <= standardGridHeight) {
    // Click is within the standard 00:00 - 22:59 range
    totalHours = relativeY / hourHeight;
  } else {
    // Click is within the 23:00 - 23:59 range (double height slot)
    const yInLastSlot = relativeY - standardGridHeight;
    // Calculate fraction within the double-height slot, clamp to prevent > 1
    const fractionInLastSlot = Math.min(1, Math.max(0, yInLastSlot / lastSlotHeight));
    totalHours = 23 + fractionInLastSlot;
  }
  // --- End variable slot height handling ---

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
