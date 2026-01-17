import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { addDays, startOfDay, differenceInDays, isSameDay } from 'date-fns';

const VISIBLE_DAYS = 7;
const BUFFER_DAYS = 14;
const TOTAL_RENDERED_DAYS = VISIBLE_DAYS + (BUFFER_DAYS * 2);

export function useInfiniteScroll({
  initialDate = new Date(),
  onDateChange,
  dayWidth,
}) {
  const scrollContainerRef = useRef(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);
  const lastScrollLeftRef = useRef(0);
  const isProgrammaticScrollRef = useRef(false);
  const anchorDateRef = useRef(startOfDay(initialDate));
  const isUpdatingAnchorRef = useRef(false);
  
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(initialDate));
  
  useEffect(() => {
    anchorDateRef.current = anchorDate;
  }, [anchorDate]);
  
  const visibleDays = useMemo(() => {
    const days = [];
    const startDate = addDays(anchorDate, -BUFFER_DAYS);
    
    for (let i = 0; i < TOTAL_RENDERED_DAYS; i++) {
      days.push(addDays(startDate, i));
    }
    
    return days;
  }, [anchorDate]);

  const getDateFromScrollPosition = useCallback((scrollLeft) => {
    if (!dayWidth || dayWidth <= 0) return anchorDateRef.current;
    
    const daysFromStart = Math.round(scrollLeft / dayWidth);
    const startDate = addDays(anchorDateRef.current, -BUFFER_DAYS);
    return addDays(startDate, daysFromStart);
  }, [dayWidth]);

  const getScrollPositionForDate = useCallback((date) => {
    if (!dayWidth || dayWidth <= 0) return 0;
    
    const startDate = addDays(anchorDateRef.current, -BUFFER_DAYS);
    const daysDiff = differenceInDays(startOfDay(date), startOfDay(startDate));
    return daysDiff * dayWidth;
  }, [dayWidth]);

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

  const scrollToDate = useCallback((date, smooth = true) => {
    const targetDate = startOfDay(date);
    
    const startDate = addDays(anchorDateRef.current, -BUFFER_DAYS);
    const endDate = addDays(anchorDateRef.current, BUFFER_DAYS + VISIBLE_DAYS);
    
    if (targetDate < startDate || targetDate > endDate) {
      isUpdatingAnchorRef.current = true;
      setAnchorDate(targetDate);
      
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const newScrollPosition = BUFFER_DAYS * dayWidth;
          isProgrammaticScrollRef.current = true;
          scrollContainerRef.current.scrollLeft = newScrollPosition;
          lastScrollLeftRef.current = newScrollPosition;
          isProgrammaticScrollRef.current = false;
        }
        isUpdatingAnchorRef.current = false;
      }, 50);
    } else {
      snapToDay(targetDate, smooth);
    }
    
    if (onDateChange) {
      onDateChange(targetDate);
    }
  }, [dayWidth, snapToDay, onDateChange]);

  const handleScroll = useCallback((e) => {
    if (isProgrammaticScrollRef.current || isUpdatingAnchorRef.current) return;
    
    const scrollLeft = e.target.scrollLeft;
    lastScrollLeftRef.current = scrollLeft;
    isScrollingRef.current = true;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      
      if (!scrollContainerRef.current || !dayWidth || isUpdatingAnchorRef.current) return;
      
      const currentScrollLeft = scrollContainerRef.current.scrollLeft;
      const nearestDayIndex = Math.round(currentScrollLeft / dayWidth);
      const snappedScrollLeft = nearestDayIndex * dayWidth;
      
      if (Math.abs(currentScrollLeft - snappedScrollLeft) > 1) {
        isProgrammaticScrollRef.current = true;
        scrollContainerRef.current.scrollTo({
          left: snappedScrollLeft,
          behavior: 'smooth',
        });
        
        setTimeout(() => {
          isProgrammaticScrollRef.current = false;
        }, 300);
      }
    }, 150);
  }, [dayWidth]);

  const handleWheel = useCallback((e) => {
    if (!scrollContainerRef.current) return;
    
    const isHorizontalGesture = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.3;
    const isShiftScroll = e.shiftKey && Math.abs(e.deltaY) > 0;
    
    if (isHorizontalGesture || isShiftScroll) {
      return;
    }
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current && dayWidth > 0) {
      const initialScrollPosition = BUFFER_DAYS * dayWidth;
      isProgrammaticScrollRef.current = true;
      
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = initialScrollPosition;
          lastScrollLeftRef.current = initialScrollPosition;
        }
        isProgrammaticScrollRef.current = false;
      });
    }
  }, [dayWidth]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

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
