import { useState, useCallback, useRef, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { format, addDays, isSameDay, startOfDay } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { useEventFiltering } from '@/hooks/useEventFiltering';
import DayColumn, { DayColumnHeader } from './DayColumn';
import TimeIndicator from './TimeIndicator';
import EventItem from '@/components/EventItem';
import TaskEventItem from '@/components/TaskEventItem';
import { ViewType } from '@/constants/views';
import { findOverlappingGroup } from '@/utils/eventUtils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TIME_COLUMN_WIDTH = 60;

export default function VirtualizedWeekView({
  selectedDate,
  events = [],
  dragState,
  pendingEventCell,
  setPendingEventCell,
  handleCellDragStart,
  handleCellClick,
  handleDragOver,
  handleDrop,
  getTimeFromMousePosition,
  timeGridRef,
  commandBarRef,
  setEvents,
  taskDropPreview,
  onDateChange,
  handleDragStart,
  handleEventClick,
  handleEventContextMenu,
  handleResizeStart,
  handleToggleTaskCompletion,
  selectedEventId,
  setSelectedEventId,
  onGetDateFromPositionReady,
}) {
  const containerRef = useRef(null);
  const [dayWidth, setDayWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const { setNodeRef, isOver } = useDroppable({
    id: 'virtualized-week-calendar-grid',
    data: {
      type: 'calendar',
      viewType: 'week'
    }
  });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const width = containerRef.current.clientWidth;
        setContainerWidth(width);
        setDayWidth((width - TIME_COLUMN_WIDTH) / 7);
      }
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Track the currently visible date for header display
  const [visibleDate, setVisibleDate] = useState(selectedDate);

  // Memoize the visible date change handler to prevent hook re-initialization
  const handleVisibleDateChangeInternal = useCallback((date) => {
    setVisibleDate(date);
    // Notify parent of visible date change for header updates
    if (onDateChange) {
      onDateChange(date);
    }
  }, [onDateChange]);

  const {
    scrollContainerRef,
    visibleDays,
    anchorDate,
    handleScroll,
    handleWheel,
    scrollToDate,
    getCurrentVisibleDate,
    BUFFER_DAYS,
  } = useInfiniteScroll({
    initialDate: selectedDate,
    dayWidth,
    onVisibleDateChange: handleVisibleDateChangeInternal,
  });

  // Just pass through to handleScroll - header is now inside scroll container with sticky positioning
  const syncHeaderScroll = useCallback((e) => {
    handleScroll(e);
  }, [handleScroll]);

  // Callback ref to set timeGridRef when the scroll container is mounted
  const setScrollContainerRef = useCallback((node) => {
    if (node) {
      // Set the scrollContainerRef from useInfiniteScroll
      scrollContainerRef.current = node;
      // Also set the timeGridRef passed from parent
      if (timeGridRef) {
        timeGridRef.current = node;
      }
    }
  }, [timeGridRef, scrollContainerRef]);

  useEffect(() => {
    if (scrollContainerRef.current && dayWidth > 0) {
      const currentTime = new Date();
      const minutes = currentTime.getHours() * 60 + currentTime.getMinutes();
      const hour = Math.floor(minutes / 60);
      const minuteOffset = (minutes % 60) / 60;
      const hourHeight = 80;
      
      const position = hour * hourHeight + minuteOffset * hourHeight - 10;
      const scrollPosition = Math.max(0, position - 100);
      
      scrollContainerRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [dayWidth, scrollContainerRef]);

  const lastSelectedDateRef = useRef(selectedDate);
  
  useEffect(() => {
    if (!isSameDay(selectedDate, lastSelectedDateRef.current) && dayWidth > 0) {
      lastSelectedDateRef.current = selectedDate;
      // Use instant scroll (no animation) for date selection from sidebar/agenda
      scrollToDate(selectedDate, false);
    }
  }, [selectedDate, dayWidth, scrollToDate]);

  const getColumnFromPosition = useCallback((clientX) => {
    if (!scrollContainerRef.current || !dayWidth) return 0;
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const relativeX = clientX - rect.left + scrollLeft - TIME_COLUMN_WIDTH;
    const dayIndex = Math.floor(relativeX / dayWidth);
    
    return Math.max(0, Math.min(visibleDays.length - 1, dayIndex));
  }, [dayWidth, visibleDays.length, scrollContainerRef]);

  const getDateFromPosition = useCallback((clientX) => {
    const columnIndex = getColumnFromPosition(clientX);
    return visibleDays[columnIndex] || anchorDate;
  }, [getColumnFromPosition, visibleDays, anchorDate]);

  // Expose getDateFromPosition to parent for drag-to-move functionality
  useEffect(() => {
    if (onGetDateFromPositionReady && dayWidth > 0) {
      onGetDateFromPositionReady(getDateFromPosition);
    }
  }, [onGetDateFromPositionReady, getDateFromPosition, dayWidth]);

  const handleDoubleClick = useCallback((e) => {
    
    if (!scrollContainerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;
    // Account for sticky header (h-12 = 48px) + all-day row (min-h-[32px] = 32px) = 80px
    const headerOffset = 80;
    const relativeY = e.clientY - rect.top + scrollTop - headerOffset;
    
    const clickedDate = getDateFromPosition(e.clientX);
    const columnIndex = getColumnFromPosition(e.clientX);
    
    const hourHeight = 80;
    const totalMinutes = Math.max(0, (relativeY / hourHeight) * 60);
    // Snap to the hour (floor to get the hour, then set minutes to 0)
    const hours = Math.floor(totalMinutes / 60);

    const startTime = new Date(clickedDate);
    startTime.setHours(Math.max(0, Math.min(23, hours)), 0, 0, 0);

    // Double-click always creates a 1-hour event
    const endTime = new Date(startTime.getTime() + 60 * 60000);

    setPendingEventCell({
      startTime,
      endTime,
      column: columnIndex,
    });

    // Create a local event for visual feedback
    const draftEventId = crypto.randomUUID();
    const draftEvent = {
      id: draftEventId,
      title: '',
      start: new Date(startTime.getTime()),
      end: new Date(endTime.getTime()),
      color: localStorage.getItem('defaultEventColor') || '#F59E0B',
      repeat: 'none',
    };

    setEvents(prev => [...prev, draftEvent]);
    if (setSelectedEventId) {
      setSelectedEventId(draftEventId);
    }
    commandBarRef.current?.openWithDragData(startTime, endTime, draftEventId);
  }, [scrollContainerRef, getDateFromPosition, getColumnFromPosition, setPendingEventCell, setEvents, commandBarRef, setSelectedEventId]);

  const handleCellDragStartWrapper = useCallback((e) => {
    if (e.button !== 0) return;
    
    // Don't prevent default immediately - let double-click work
    if (!scrollContainerRef.current) return;
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;
    // Account for sticky header (h-12 = 48px) + all-day row (min-h-[32px] = 32px) = 80px
    const headerOffset = 80;
    const relativeY = e.clientY - rect.top + scrollTop - headerOffset;
    const clickedDate = getDateFromPosition(e.clientX);
    const columnIndex = getColumnFromPosition(e.clientX);
    
    const hourHeight = 80;
    const totalMinutes = (relativeY / hourHeight) * 60;
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    const hours = Math.floor(snappedMinutes / 60);
    const minutes = snappedMinutes % 60;
    
    const initialTime = new Date(clickedDate);
    initialTime.setHours(Math.max(0, Math.min(23, hours)), minutes, 0, 0);
    
    let hasDragged = false;
    let eventCreated = false;
    const MIN_DRAG_DISTANCE = 10; // Increased threshold to avoid accidental drags
    const startX = e.clientX;
    const startY = e.clientY;
    let currentEndTime = new Date(initialTime);
    
    const defaultColor = localStorage.getItem('defaultEventColor') || '#F59E0B';
    const defaultDuration = parseInt(localStorage.getItem('defaultEventDuration') || '60');
    
    let newEventId = null;
    
    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      // Only start drag-to-create if we've moved enough distance
      if (!hasDragged && Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_DISTANCE) {
        hasDragged = true;
        
        // Create the event only when drag actually starts
        if (!eventCreated) {
          eventCreated = true;
          newEventId = crypto.randomUUID();
          const newEvent = {
            id: newEventId,
            title: '',
            start: new Date(initialTime.getTime()),
            end: new Date(initialTime.getTime() + 15 * 60 * 1000), // Start with 15 min
            color: defaultColor,
            repeat: 'none',
          };
          setEvents(prev => [...prev, newEvent]);
        }
      }
      
      if (hasDragged && eventCreated && scrollContainerRef.current) {
        const moveRect = scrollContainerRef.current.getBoundingClientRect();
        const moveScrollTop = scrollContainerRef.current.scrollTop;
        // Account for sticky header (h-12 = 48px) + all-day row (min-h-[32px] = 32px) = 80px
        const moveHeaderOffset = 80;
        const moveRelativeY = moveEvent.clientY - moveRect.top + moveScrollTop - moveHeaderOffset;
        
        const moveTotalMinutes = Math.max(0, (moveRelativeY / hourHeight) * 60);
        const moveSnappedMinutes = Math.round(moveTotalMinutes / 15) * 15;
        const moveHours = Math.floor(moveSnappedMinutes / 60);
        const moveMins = moveSnappedMinutes % 60;
        
        currentEndTime = new Date(clickedDate);
        currentEndTime.setHours(Math.max(0, Math.min(24, moveHours)), moveMins, 0, 0);
        
        if (currentEndTime <= initialTime) {
          currentEndTime = new Date(initialTime.getTime() + 15 * 60 * 1000);
        }
        
        // Update the local event's end time as user drags
        setEvents(prev => prev.map(ev => 
          ev.id === newEventId 
            ? { ...ev, end: new Date(currentEndTime.getTime()) }
            : ev
        ));
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Only open command bar if we actually dragged
      if (eventCreated && newEventId) {
        const finalEndTime = currentEndTime > initialTime ? currentEndTime : new Date(initialTime.getTime() + defaultDuration * 60 * 1000);
        
        setEvents(prev => prev.map(ev => 
          ev.id === newEventId 
            ? { ...ev, end: new Date(finalEndTime.getTime()) }
            : ev
        ));
        
        setPendingEventCell({
          startTime: initialTime,
          endTime: finalEndTime,
          column: columnIndex,
        });
        
        if (setSelectedEventId) {
          setSelectedEventId(newEventId);
        }
        commandBarRef.current?.openWithDragData(initialTime, finalEndTime, newEventId);
      }
      // If no drag happened, do nothing - let double-click handle event creation
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [scrollContainerRef, getDateFromPosition, getColumnFromPosition, setEvents, setPendingEventCell, commandBarRef, setSelectedEventId]);

  const handleCellClickWrapper = useCallback((e) => {
    if (handleCellClick) {
      const clickedDate = getDateFromPosition(e.clientX);
      handleCellClick(e, clickedDate);
    }
  }, [handleCellClick, getDateFromPosition]);

  const handleDropWrapper = useCallback((e) => {
    if (handleDrop) {
      const droppedDate = getDateFromPosition(e.clientX);
      handleDrop(e, droppedDate);
    }
  }, [handleDrop, getDateFromPosition]);

  const totalWidth = visibleDays.length * dayWidth;

  const { expandRecurringEvents } = useEventFiltering();

  // Create stable date range info to prevent unnecessary recalculations
  // This prevents flickering when anchor changes but visible range is similar
  const visibleRange = useMemo(() => {
    if (visibleDays.length === 0) return { first: null, last: null, key: '' };
    const first = startOfDay(visibleDays[0]);
    const last = startOfDay(visibleDays[visibleDays.length - 1]);
    const key = `${first.getTime()}_${last.getTime()}`;
    return { first, last, key };
  }, [visibleDays]);

  const filteredEventsForVisibleDays = useMemo(() => {
    if (!events || events.length === 0 || !visibleRange.first) return [];
    
    const firstDay = visibleRange.first;
    const lastDay = addDays(visibleRange.last, 1);
    
    // First expand any recurring events for the visible date range
    const expandedEvents = expandRecurringEvents(events, firstDay, lastDay);
    
    const filtered = expandedEvents.filter(event => {
      if (!event.start) return false;
      const eventStart = event.start instanceof Date ? event.start : new Date(event.start);
      const isAllDay = event.allDay || event.isAllDay;
      if (isAllDay) return false;
      
      return eventStart >= firstDay && eventStart < lastDay;
    });
    
    return filtered;
  }, [events, visibleRange, expandRecurringEvents]);

  // First visible day for stable position calculations
  const firstVisibleDay = visibleRange.first;

  const getEventStyleForDay = useCallback((event, dayIndex, eventDate) => {
    const style = {
      position: 'absolute',
      zIndex: 10,
      overflow: 'hidden',
      cursor: 'pointer',
      pointerEvents: 'auto',
      transform: 'translateZ(0)',
      backfaceVisibility: 'hidden',
    };

    if (event.start) {
      const minutes = event.start.getHours() * 60 + event.start.getMinutes();
      style.top = `${minutes * (80 / 60)}px`;
    }

    if (event.end && event.start) {
      const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const calculatedHeight = (endMinutes - startMinutes) * (80 / 60);
      const minHeight = 15;
      style.height = `${Math.max(calculatedHeight - 2, minHeight - 2)}px`;
    }

    const baseLeft = dayIndex * dayWidth;
    
    // Find overlapping events for the same day using the event date
    const dayEvents = filteredEventsForVisibleDays.filter(e => 
      e.start && isSameDay(new Date(e.start), eventDate)
    );
    const overlappingEvents = findOverlappingGroup(event, dayEvents);

    if (overlappingEvents.length > 0) {
      const sortedEvents = [event, ...overlappingEvents].sort((a, b) => {
        const startDiff = a.start.getTime() - b.start.getTime();
        if (startDiff !== 0) return startDiff;
        const aDuration = a.end.getTime() - a.start.getTime();
        const bDuration = b.end.getTime() - b.start.getTime();
        if (aDuration !== bDuration) return bDuration - aDuration;
        return (a.id || '').localeCompare(b.id || '');
      });

      const eventIndex = sortedEvents.findIndex(e => e.id === event.id);
      const totalEvents = overlappingEvents.length + 1;
      const eventWidth = (dayWidth * 0.95) / totalEvents;
      const offset = eventWidth * eventIndex + dayWidth * 0.025;

      style.width = `${eventWidth - 8}px`;
      style.left = `${baseLeft + offset}px`;
    } else {
      style.width = `${dayWidth - 20}px`;
      style.left = `${baseLeft + 2}px`;
    }

    if (!event.isTask && !event.isTaskBlock) {
      style.backgroundColor = event.color ? `${event.color}20` : '#80808020';
      style.borderRadius = '4px';
      style.padding = '2px 4px';
      style.fontSize = '12px';
    }

    // Selected events or events being created use selected state styling
    const isEventSelected = selectedEventId === event.id;
    if (isEventSelected) {
      style.backgroundColor = event.color || '#808080';
      style.opacity = 1;
      style.color = '#fff';
    } else {
      const now = new Date();
      if (event.end < now && !event.isTaskBlock) {
        style.opacity = 0.5;
      }
    }

    return style;
  }, [dayWidth, filteredEventsForVisibleDays, visibleDays, selectedEventId]);

  const handleEventClickWithSelection = useCallback((event) => {
    if (setSelectedEventId) {
      setSelectedEventId(event.id);
    }
    if (handleEventClick) {
      handleEventClick(event);
    }
  }, [setSelectedEventId, handleEventClick]);

  const handleEventContextMenuWrapper = useCallback((e, event) => {
    if (handleEventContextMenu) {
      handleEventContextMenu(e, event.id);
    }
  }, [handleEventContextMenu]);

  const renderInternalEvents = useCallback(() => {
    if (!firstVisibleDay) return null;
    
    return filteredEventsForVisibleDays.map(event => {
      const eventDate = startOfDay(new Date(event.start));
      // Calculate day index based on date difference from first visible day
      // This is stable across reanchoring since it's based on actual dates
      const dayIndex = Math.floor((eventDate.getTime() - firstVisibleDay.getTime()) / (24 * 60 * 60 * 1000));
      
      if (dayIndex < 0 || dayIndex >= visibleDays.length) return null;
      
      const eventStyle = getEventStyleForDay(event, dayIndex, eventDate);
      
      if (event.isTask || event.isTaskBlock) {
        return (
          <TaskEventItem
            key={event.id}
            event={event}
            eventStyle={eventStyle}
            viewType={ViewType.WEEK}
            dragState={dragState}
            onDragStart={handleDragStart}
            onDoubleClick={handleEventClickWithSelection}
            onContextMenu={handleEventContextMenuWrapper}
            onResizeStart={handleResizeStart}
            onToggleTaskCompletion={handleToggleTaskCompletion}
          />
        );
      }
      
      return (
        <EventItem
          key={event.id}
          event={event}
          eventStyle={eventStyle}
          viewType={ViewType.WEEK}
          dragState={dragState}
          onDragStart={handleDragStart}
          onClick={handleEventClickWithSelection}
          onDoubleClick={handleEventClickWithSelection}
          onContextMenu={handleEventContextMenuWrapper}
          onResizeStart={handleResizeStart}
          isSelected={selectedEventId === event.id}
        />
      );
    });
  }, [filteredEventsForVisibleDays, firstVisibleDay, visibleDays.length, getEventStyleForDay, dragState, handleDragStart, handleEventClickWithSelection, handleEventContextMenuWrapper, handleResizeStart, handleToggleTaskCompletion, selectedEventId]);

  if (dayWidth === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex select-none flex-col h-full">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 flex select-none flex-col h-full overflow-hidden"
    >
      <div
        ref={setScrollContainerRef}
        className="flex-1 overflow-auto scrollbar-hide infinite-scroll-container"
        onScroll={syncHeaderScroll}
        onWheel={handleWheel}
      >
        <div 
          className="relative infinite-scroll-content"
          style={{ 
            width: totalWidth + TIME_COLUMN_WIDTH,
            minHeight: '100%',
          }}
        >
          {/* Sticky header row - sticks to top during vertical scroll */}
          <div 
            className="sticky top-0 z-30 bg-light-bg dark:bg-dark-bg-light"
            style={{ 
              width: totalWidth + TIME_COLUMN_WIDTH,
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          >
            <div className="flex h-12">
              {/* Time column spacer - sticky left */}
              <div 
                className="sticky left-0 flex-shrink-0 bg-light-bg dark:bg-dark-bg-light"
                style={{ 
                  width: TIME_COLUMN_WIDTH,
                  zIndex: 40,
                  transform: 'translateZ(0)',
                }}
              />
              {/* Day headers */}
              <div className="flex" style={{ width: totalWidth }}>
                {visibleDays.map((date) => (
                  <DayColumnHeader
                    key={`header-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    date={date}
                    dayWidth={dayWidth}
                  />
                ))}
              </div>
            </div>

            {/* All-day row */}
            <div 
              className="flex min-h-[32px] border-t border-b border-light-border/50 dark:border-dark-border"
              style={{ width: totalWidth + TIME_COLUMN_WIDTH }}
            >
              <div 
                className="sticky left-0 flex-shrink-0 flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium bg-light-bg dark:bg-dark-bg-light"
                style={{ 
                  width: TIME_COLUMN_WIDTH,
                  zIndex: 40,
                  transform: 'translateZ(0)',
                }}
              >
                All-day
              </div>
              <div className="relative flex-1" style={{ minHeight: '24px' }}>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div 
            className="flex"
            style={{ 
              width: totalWidth + TIME_COLUMN_WIDTH,
              height: '1920px', // 24 hours * 80px
            }}
          >
            {/* Time column - sticky left */}
            <div 
              className="sticky left-0 flex-shrink-0 flex flex-col pointer-events-none bg-light-bg dark:bg-dark-bg-light" 
              style={{ 
                width: TIME_COLUMN_WIDTH,
                zIndex: 20,
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
              }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className="h-20 pr-2 relative flex-shrink-0">
                  {hour !== 0 && (
                    <span className="absolute right-2 top-[-10px] text-[10px] mt-0.5 text-light-text/50 dark:text-dark-text/50">
                      {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'AM' : 'PM'}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns area */}
            <div 
              className="relative"
              style={{ 
                width: totalWidth,
                height: '1920px',
              }}
            >
              <TimeIndicator 
                viewType="week" 
                selectedDate={selectedDate}
                visibleDays={visibleDays}
                dayWidth={dayWidth}
              />

              {/* Grid lines */}
              <div 
                className="absolute inset-0 flex" 
                style={{ transform: 'translateZ(0)' }}
              >
                {visibleDays.map((date) => (
                  <DayColumn
                    key={`day-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`}
                    date={date}
                    dayWidth={dayWidth}
                    events={events}
                    isDropTarget={false}
                  />
                ))}
              </div>

              {/* Events layer */}
              <div 
                className="absolute inset-0" 
                style={{ 
                  pointerEvents: 'none',
                  contain: 'layout style paint',
                  zIndex: 10,
                }}
              >
                <div style={{ pointerEvents: 'auto', transform: 'translateZ(0)' }}>
                  {renderInternalEvents()}
                </div>
              </div>

              {/* Interaction layer */}
              <div
                ref={setNodeRef}
                className="absolute inset-0"
                style={{ zIndex: 5 }}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleCellDragStartWrapper}
                onClick={handleCellClickWrapper}
                onDragOver={handleDragOver}
                onDrop={handleDropWrapper}
              />

              {/* pendingEventCell overlay removed - draft events now show with selected state styling */}

              {taskDropPreview && (() => {
                // Calculate the column position based on the drop preview date relative to visible days
                const previewDate = startOfDay(taskDropPreview.start);
                const dayIndex = firstVisibleDay 
                  ? Math.floor((previewDate.getTime() - firstVisibleDay.getTime()) / (24 * 60 * 60 * 1000))
                  : 0;
                
                // Only show if the preview is within visible range
                if (dayIndex < 0 || dayIndex >= visibleDays.length) return null;
                
                return (
                  <div
                    className="absolute pointer-events-none rounded-[9px] border-2 border-[#4BA3E3] bg-[#4BA3E3]/20"
                    style={{
                      left: `${dayIndex * dayWidth + 2}px`,
                      width: `${dayWidth - 12}px`,
                      top: `${taskDropPreview.start.getHours() * 80 + taskDropPreview.start.getMinutes() * (80/60)}px`,
                      height: `${Math.max(((taskDropPreview.end.getTime() - taskDropPreview.start.getTime()) / (1000 * 60)) * (80/60) - 2, 20)}px`,
                      zIndex: 100,
                    }}
                  >
                    <div className="px-2 py-1 text-[#4BA3E3] overflow-hidden h-full">
                      <div className="font-medium text-xs truncate">
                        {taskDropPreview.task?.title || taskDropPreview.task?.name || 'New Event'}
                      </div>
                      <div className="text-xs opacity-70">
                        {format(taskDropPreview.start, "h:mm a")} – {format(taskDropPreview.end, "h:mm a")}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
