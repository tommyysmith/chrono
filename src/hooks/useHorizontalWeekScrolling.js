import { useEffect, useRef, useState, useCallback } from 'react';
import { addDays, startOfWeek } from 'date-fns';

export const useHorizontalWeekScrolling = (selectedDate, onDateChange) => {
  const scrollContainerRef = useRef(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [enableHorizontalScrolling, setEnableHorizontalScrolling] = useState(false);
  
  // Scroll state
  const [scrollLeft, setScrollLeft] = useState(0);
  const snapTimeout = useRef(null);
  
  // Day snapping configuration
  const SNAP_THRESHOLD = 0.1; // Snap when within 10% of a day boundary
  
  // Listen for settings changes
  useEffect(() => {
    const handleSettingsChange = (e) => {
      setEnableHorizontalScrolling(e.detail);
      // Reset current week offset when toggling horizontal scrolling
      setCurrentWeekOffset(0);
    };
    
    // Initial load
    const savedSetting = localStorage.getItem('enableHorizontalScrolling');
    setEnableHorizontalScrolling(savedSetting === 'true');
    
    window.addEventListener('horizontal-scrolling-updated', handleSettingsChange);
    return () => {
      window.removeEventListener('horizontal-scrolling-updated', handleSettingsChange);
    };
  }, []);
  
  // Calculate the current week start for a given offset
  const getWeekStartForOffset = useCallback((offset) => {
    const baseWeekStart = startOfWeek(selectedDate);
    return addDays(baseWeekStart, offset * 7);
  }, [selectedDate]);
  
  // Calculate which day column is most visible
  const getVisibleDayColumn = useCallback((scrollLeft, containerWidth) => {
    const WEEKS_TO_SHOW = 10;
    const totalDays = WEEKS_TO_SHOW * 7;
    const scrollPercentage = scrollLeft / containerWidth;
    const dayIndex = Math.round(scrollPercentage * totalDays);
    return dayIndex % 7;
  }, []);
  
  // Snap to nearest day boundary
  const snapToDay = useCallback((scrollLeft, containerWidth) => {
    const WEEKS_TO_SHOW = 10;
    const totalDays = WEEKS_TO_SHOW * 7;
    const scrollPercentage = scrollLeft / containerWidth;
    const dayPosition = scrollPercentage * totalDays;
    const nearestDay = Math.round(dayPosition);
    const targetScrollLeft = (nearestDay / totalDays) * containerWidth;
    
    return targetScrollLeft;
  }, []);
  
  // Removed complex momentum animation - handled directly in wheel event
  
  // Handle wheel events for horizontal scrolling
  const handleWheel = useCallback((e) => {
    if (!enableHorizontalScrolling || !scrollContainerRef.current) return;
    
    // More aggressive horizontal scroll detection
    const hasHorizontalDelta = Math.abs(e.deltaX) > 0;
    
    if (hasHorizontalDelta) {
      // Prevent default browser behavior
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const container = scrollContainerRef.current;
      const deltaX = e.deltaX;
      
      // Find the actual scrollable container (might be nested)
      const scrollableContainer = container.querySelector('.overflow-x-auto') || container;
      
      // Direct scroll update
      const newScrollLeft = scrollableContainer.scrollLeft + deltaX;
      const containerWidth = scrollableContainer.scrollWidth;
      const clampedScrollLeft = Math.max(0, Math.min(containerWidth - scrollableContainer.clientWidth, newScrollLeft));
      
      scrollableContainer.scrollLeft = clampedScrollLeft;
      setScrollLeft(clampedScrollLeft);
      
      // Clear existing snap timeout
      if (snapTimeout.current) {
        clearTimeout(snapTimeout.current);
      }
      
      // Set timeout to snap to nearest day when scrolling stops
      snapTimeout.current = setTimeout(() => {
        const targetScrollLeft = snapToDay(clampedScrollLeft, containerWidth);
        
        // Smooth snap animation
        const snapAnimation = () => {
          const currentScrollLeft = scrollableContainer.scrollLeft;
          const distance = targetScrollLeft - currentScrollLeft;
          
          if (Math.abs(distance) > 1) {
            const newScrollLeft = currentScrollLeft + distance * 0.25;
            scrollableContainer.scrollLeft = newScrollLeft;
            setScrollLeft(newScrollLeft);
            requestAnimationFrame(snapAnimation);
          } else {
            scrollableContainer.scrollLeft = targetScrollLeft;
            setScrollLeft(targetScrollLeft);
          }
        };
        
        requestAnimationFrame(snapAnimation);
      }, 100);
    }
  }, [enableHorizontalScrolling, snapToDay]);
  
  // Handle scroll events (for manual scrollbar dragging)
  const handleScroll = useCallback((e) => {
    if (!enableHorizontalScrolling) return;
    
    const container = e.target;
    const newScrollLeft = container.scrollLeft;
    
    // Update scroll position for header sync
    setScrollLeft(newScrollLeft);
  }, [enableHorizontalScrolling]);
  
  // Setup event listeners
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !enableHorizontalScrolling) return;
    
    // Add event listeners with capture to intercept early
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    // Also add to document to catch events that might bubble up
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    
    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true });
      container.removeEventListener('scroll', handleScroll);
      document.removeEventListener('wheel', handleWheel, { capture: true });
      
      // Clear snap timeout
      if (snapTimeout.current) {
        clearTimeout(snapTimeout.current);
      }
    };
  }, [enableHorizontalScrolling, handleWheel, handleScroll]);
  
  // Handle keyboard navigation (arrow keys should move full weeks)
  const handleKeyNavigation = useCallback((direction) => {
    if (!enableHorizontalScrolling) return;
    
    const newOffset = currentWeekOffset + direction;
    setCurrentWeekOffset(newOffset);
    
    const weekStart = getWeekStartForOffset(newOffset);
    const currentDayOfWeek = selectedDate.getDay();
    const newDate = addDays(weekStart, currentDayOfWeek);
    
    onDateChange(newDate);
  }, [enableHorizontalScrolling, currentWeekOffset, getWeekStartForOffset, selectedDate, onDateChange]);
  
  // Generate days for the current view (expand to show multiple weeks)
  const generateDaysForView = useCallback(() => {
    if (!enableHorizontalScrolling) {
      // Regular week view - 7 days
      const weekStart = startOfWeek(selectedDate);
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    }
    
    // Extended view - show multiple weeks for scrolling
    const WEEKS_TO_SHOW = 10; // Show 10 weeks worth of days
    const centerWeek = Math.floor(WEEKS_TO_SHOW / 2);
    
    // Calculate the start date to center the selected date
    const selectedWeekStart = startOfWeek(selectedDate);
    const startWeek = addDays(selectedWeekStart, (currentWeekOffset - centerWeek) * 7);
    
    return Array.from({ length: WEEKS_TO_SHOW * 7 }, (_, i) => addDays(startWeek, i));
  }, [enableHorizontalScrolling, selectedDate, currentWeekOffset]);
  
  // Update scroll position when date changes externally or when horizontal scrolling is enabled
  useEffect(() => {
    if (!enableHorizontalScrolling || !scrollContainerRef.current) return;
    
    const container = scrollContainerRef.current;
    const scrollableContainer = container.querySelector('.overflow-x-auto') || container;
    
    // Wait for the container to be properly sized
    const updateScrollPosition = () => {
      if (scrollableContainer.scrollWidth <= scrollableContainer.clientWidth) {
        // Container not ready yet, try again
        setTimeout(updateScrollPosition, 100);
        return;
      }
      
      const containerWidth = scrollableContainer.scrollWidth;
      const clientWidth = scrollableContainer.clientWidth;
      
      // Calculate which day in the extended view should be visible
      const WEEKS_TO_SHOW = 10;
      const centerWeek = Math.floor(WEEKS_TO_SHOW / 2);
      const totalDays = WEEKS_TO_SHOW * 7;
      const dayOfWeek = selectedDate.getDay();
      
      // Position the selected day in the center of the visible area
      const targetDayIndex = (centerWeek * 7) + dayOfWeek;
      const dayWidth = containerWidth / totalDays;
      const targetScrollLeft = (targetDayIndex * dayWidth) - (clientWidth / 2) + (dayWidth / 2);
      
      // Clamp to valid scroll range
      const maxScrollLeft = containerWidth - clientWidth;
      const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
      
      // Set scroll position without smooth animation to avoid conflicts
      scrollableContainer.scrollLeft = clampedScrollLeft;
      setScrollLeft(clampedScrollLeft);
    };
    
    // Use timeout to ensure the container is ready
    setTimeout(updateScrollPosition, 10);
  }, [selectedDate, enableHorizontalScrolling]);
  
  return {
    scrollContainerRef,
    enableHorizontalScrolling,
    isScrolling,
    generateDaysForView,
    handleKeyNavigation,
    currentWeekOffset,
    scrollLeft
  };
};
