import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { addDays, startOfDay, differenceInDays, isSameDay } from 'date-fns';

// Configuration for infinite scroll
const VISIBLE_DAYS = 7;           // Days visible in viewport
const BUFFER_DAYS = 28;           // Days to render on each side of anchor (increased for smoother scrolling)
const REANCHOR_THRESHOLD = 14;    // When within this many days of edge, reanchor (increased to reduce frequency)
const TOTAL_RENDERED_DAYS = VISIBLE_DAYS + (BUFFER_DAYS * 2); // 63 days total

export function useInfiniteScroll({
  initialDate = new Date(),
  onDateChange,
  onVisibleDateChange,
  dayWidth,
}) {
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const snapTimeoutRef = useRef(null);
  const lastScrollLeftRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const isReanchoringRef = useRef(false);
  const anchorDateRef = useRef(startOfDay(initialDate));
  const lastReportedDateRef = useRef(null);
  const initializedRef = useRef(false);
  const pendingAnchorRef = useRef(null); // Store pending anchor to batch updates
  
  // Throttling and velocity tracking for rapid scrolling
  const lastScrollTimeRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lastVisibleDateUpdateRef = useRef(0);
  const reanchorCooldownRef = useRef(false);
  
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(initialDate));
  const isTransitioningRef = useRef(false); // Use ref to avoid re-renders during transition
  
  // Store callbacks in refs to prevent dependency changes causing re-renders
  const onDateChangeRef = useRef(onDateChange);
  const onVisibleDateChangeRef = useRef(onVisibleDateChange);
  
  // Keep refs in sync
  useEffect(() => {
    onDateChangeRef.current = onDateChange;
    onVisibleDateChangeRef.current = onVisibleDateChange;
  }, [onDateChange, onVisibleDateChange]);
  
  // Keep ref in sync with state
  useEffect(() => {
    anchorDateRef.current = anchorDate;
  }, [anchorDate]);
  
  // Generate the array of visible days based on anchor
  const visibleDays = useMemo(() => {
    const days = [];
    const startDate = addDays(anchorDate, -BUFFER_DAYS);
    
    for (let i = 0; i < TOTAL_RENDERED_DAYS; i++) {
      days.push(addDays(startDate, i));
    }
    
    return days;
  }, [anchorDate]);

  // Convert scroll position to date
  const getDateFromScrollPosition = useCallback((scrollLeft) => {
    if (!dayWidth || dayWidth <= 0) return anchorDateRef.current;
    
    const daysFromStart = Math.floor(scrollLeft / dayWidth);
    const startDate = addDays(anchorDateRef.current, -BUFFER_DAYS);
    return addDays(startDate, daysFromStart);
  }, [dayWidth]);

  // Convert date to scroll position
  const getScrollPositionForDate = useCallback((date, forAnchor = anchorDateRef.current) => {
    if (!dayWidth || dayWidth <= 0) return 0;
    
    const startDate = addDays(forAnchor, -BUFFER_DAYS);
    const daysDiff = differenceInDays(startOfDay(date), startOfDay(startDate));
    return daysDiff * dayWidth;
  }, [dayWidth]);

  // Reanchor the scroll position to keep infinite scrolling working
  // This is the key to infinite scroll - when we get close to the edge,
  // we shift the anchor and adjust scroll position to maintain visual continuity
  const reanchorIfNeeded = useCallback(() => {
    if (!scrollContainerRef.current || !dayWidth || isReanchoringRef.current) return;
    
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const currentDayIndex = Math.floor(scrollLeft / dayWidth);
    
    // Check if we're approaching the left edge (past dates)
    const leftThreshold = REANCHOR_THRESHOLD;
    // Check if we're approaching the right edge (future dates)
    const rightThreshold = TOTAL_RENDERED_DAYS - VISIBLE_DAYS - REANCHOR_THRESHOLD;
    
    if (currentDayIndex <= leftThreshold || currentDayIndex >= rightThreshold) {
      isReanchoringRef.current = true;
      
      // Calculate the current visible date
      const currentVisibleDate = getDateFromScrollPosition(scrollLeft);
      
      // Set new anchor to current visible date
      const newAnchor = startOfDay(currentVisibleDate);
      
      // Calculate what the new scroll position should be after reanchoring
      const newScrollPosition = BUFFER_DAYS * dayWidth;
      
      // Store the pending anchor
      pendingAnchorRef.current = newAnchor;
      
      // Use requestAnimationFrame for smoother reanchoring - ensures we're in sync with browser paint
      requestAnimationFrame(() => {
        if (!scrollContainerRef.current || !pendingAnchorRef.current) return;
        
        // Start transition to suppress visual updates
        isTransitioningRef.current = true;
        
        // CRITICAL: Set scroll position BEFORE updating state to prevent visual jump
        scrollContainerRef.current.scrollLeft = newScrollPosition;
        lastScrollLeftRef.current = newScrollPosition;
        
        // Update anchor ref immediately for calculations
        anchorDateRef.current = pendingAnchorRef.current;
        
        // Now update anchor state - React will re-render but scroll position is already correct
        setAnchorDate(pendingAnchorRef.current);
        pendingAnchorRef.current = null;
        
        // End transition after React has finished rendering
        requestAnimationFrame(() => {
          isTransitioningRef.current = false;
          // Allow another reanchor after a cooldown period
          // This prevents rapid reanchoring during fast scrolling
          reanchorCooldownRef.current = true;
          setTimeout(() => {
            isReanchoringRef.current = false;
            reanchorCooldownRef.current = false;
          }, 300); // 300ms cooldown between reanchors
        });
      });
    }
  }, [dayWidth, getDateFromScrollPosition]);

  // Snap to nearest day boundary
  const snapToDay = useCallback((targetDate, smooth = true) => {
    if (!scrollContainerRef.current || !dayWidth) return;
    
    const scrollPosition = getScrollPositionForDate(targetDate);
    
    isProgrammaticScrollRef.current = true;
    scrollContainerRef.current.scrollTo({
      left: scrollPosition,
      behavior: smooth ? 'smooth' : 'instant',
    });
    
    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, smooth ? 300 : 50);
  }, [dayWidth, getScrollPositionForDate]);

  // Scroll to a specific date (used for "Today" button, date picker, etc.)
  const scrollToDate = useCallback((date, smooth = false) => {
    if (!dayWidth) return;
    
    const targetDate = startOfDay(date);
    
    // Check if target is within current rendered range
    const startDate = addDays(anchorDateRef.current, -BUFFER_DAYS);
    const endDate = addDays(anchorDateRef.current, BUFFER_DAYS + VISIBLE_DAYS - 1);
    
    if (targetDate < startDate || targetDate > endDate) {
      // Target is outside current range - need to reanchor to target date
      isReanchoringRef.current = true;
      isProgrammaticScrollRef.current = true;
      
      // Update anchor ref immediately
      anchorDateRef.current = targetDate;
      
      // Set scroll position to show target date at the start
      const newScrollPosition = BUFFER_DAYS * dayWidth;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = newScrollPosition;
        lastScrollLeftRef.current = newScrollPosition;
      }
      
      // Update state to trigger re-render with new anchor
      setAnchorDate(targetDate);
      
      // Reset flags after a short delay
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
        isReanchoringRef.current = false;
      }, 100);
    } else {
      // Target is within range - just scroll to it
      snapToDay(targetDate, smooth);
    }
    
    // Notify about the date change
    if (onDateChangeRef.current) {
      onDateChangeRef.current(targetDate);
    }
    if (onVisibleDateChangeRef.current) {
      onVisibleDateChangeRef.current(targetDate);
    }
  }, [dayWidth, snapToDay]);

  // Handle scroll events - core of infinite scroll
  const handleScroll = useCallback((e) => {
    if (isProgrammaticScrollRef.current || isReanchoringRef.current) return;
    
    const now = performance.now();
    const scrollLeft = e.target.scrollLeft;
    const scrollDelta = Math.abs(scrollLeft - lastScrollLeftRef.current);
    const timeDelta = now - lastScrollTimeRef.current;
    
    // Calculate scroll velocity (pixels per millisecond)
    if (timeDelta > 0) {
      scrollVelocityRef.current = scrollDelta / timeDelta;
    }
    
    lastScrollLeftRef.current = scrollLeft;
    lastScrollTimeRef.current = now;
    isScrollingRef.current = true;
    
    // Skip visible date updates during rapid scrolling (velocity > 2 px/ms)
    // This prevents excessive re-renders during fast swiping
    const isRapidScrolling = scrollVelocityRef.current > 2;
    
    // Throttle visible date updates to max once per 150ms during normal scroll
    const timeSinceLastUpdate = now - lastVisibleDateUpdateRef.current;
    const shouldUpdateVisibleDate = !isRapidScrolling && timeSinceLastUpdate > 150;
    
    // Report current visible date for header updates (throttled)
    if (shouldUpdateVisibleDate) {
      const currentVisibleDate = getDateFromScrollPosition(scrollLeft);
      if (onVisibleDateChangeRef.current && 
          (!lastReportedDateRef.current || !isSameDay(currentVisibleDate, lastReportedDateRef.current))) {
        lastReportedDateRef.current = currentVisibleDate;
        lastVisibleDateUpdateRef.current = now;
        onVisibleDateChangeRef.current(currentVisibleDate);
      }
    }
    
    // Clear existing timeouts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    if (snapTimeoutRef.current) {
      clearTimeout(snapTimeoutRef.current);
    }
    
    // Check for reanchoring during scroll - only if not in cooldown and not rapid scrolling
    if (!reanchorCooldownRef.current && !isRapidScrolling) {
      scrollTimeoutRef.current = setTimeout(() => {
        reanchorIfNeeded();
      }, 50); // Increased delay for smoother reanchoring
    }
    
    // Snap to day after scroll ends (longer debounce)
    snapTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      scrollVelocityRef.current = 0;
      
      // Update visible date one final time after scroll ends
      const finalVisibleDate = getDateFromScrollPosition(scrollContainerRef.current?.scrollLeft || 0);
      if (onVisibleDateChangeRef.current && 
          (!lastReportedDateRef.current || !isSameDay(finalVisibleDate, lastReportedDateRef.current))) {
        lastReportedDateRef.current = finalVisibleDate;
        lastVisibleDateUpdateRef.current = performance.now();
        onVisibleDateChangeRef.current(finalVisibleDate);
      }
      
      if (!scrollContainerRef.current || !dayWidth || isReanchoringRef.current) return;
      
      const currentScrollLeft = scrollContainerRef.current.scrollLeft;
      const nearestDayIndex = Math.round(currentScrollLeft / dayWidth);
      const snappedScrollLeft = nearestDayIndex * dayWidth;
      
      // Only snap if we're not already at a day boundary
      if (Math.abs(currentScrollLeft - snappedScrollLeft) > 2) {
        isProgrammaticScrollRef.current = true;
        scrollContainerRef.current.scrollTo({
          left: snappedScrollLeft,
          behavior: 'smooth',
        });
        
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
      }
    }, 200); // Increased debounce for scroll end detection
  }, [dayWidth, getDateFromScrollPosition, reanchorIfNeeded]);

  // Handle wheel events - allow natural horizontal scrolling
  const handleWheel = useCallback((e) => {
    if (!scrollContainerRef.current) return;
    
    // Detect if this is a horizontal gesture (trackpad) or shift+scroll
    const isHorizontalGesture = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.3;
    const isShiftScroll = e.shiftKey && Math.abs(e.deltaY) > 0;
    
    // Let horizontal gestures pass through naturally
    if (isHorizontalGesture || isShiftScroll) {
      return;
    }
    
    // Vertical scroll - don't interfere
  }, []);

  // Initialize scroll position on mount
  useEffect(() => {
    if (scrollContainerRef.current && dayWidth > 0 && !initializedRef.current) {
      initializedRef.current = true;
      const initialScrollPosition = BUFFER_DAYS * dayWidth;
      
      // Use requestAnimationFrame for smoother initialization
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = initialScrollPosition;
          lastScrollLeftRef.current = initialScrollPosition;
        }
      });
    }
  }, [dayWidth]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (snapTimeoutRef.current) {
        clearTimeout(snapTimeoutRef.current);
      }
    };
  }, []);

  // Get the currently visible date (leftmost day in viewport)
  const getCurrentVisibleDate = useCallback(() => {
    if (!scrollContainerRef.current || !dayWidth) return anchorDate;
    
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    return getDateFromScrollPosition(scrollLeft);
  }, [anchorDate, dayWidth, getDateFromScrollPosition]);

  return {
    scrollContainerRef,
    visibleDays,
    anchorDate,
    isScrolling: isScrollingRef.current,
    isReanchoring: isReanchoringRef.current,
    isTransitioningRef,
    
    handleScroll,
    handleWheel,
    scrollToDate,
    snapToDay,
    getCurrentVisibleDate,
    getScrollPositionForDate,
    getDateFromScrollPosition,
    
    VISIBLE_DAYS,
    BUFFER_DAYS,
    TOTAL_RENDERED_DAYS,
  };
}
