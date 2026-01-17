import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
}) {
  const containerRef = useRef(null);
  const headerScrollRef = useRef(null);
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
        setDayWidth(width / 7);
      }
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  const {
    scrollContainerRef,
    visibleDays,
    anchorDate,
    handleScroll,
    handleWheel,
    scrollToDate,
    BUFFER_DAYS,
  } = useInfiniteScroll({
    initialDate: selectedDate,
    dayWidth,
  });

  const syncHeaderScroll = useCallback((e) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.target.scrollLeft;
    }
    handleScroll(e);
  }, [handleScroll]);

  useEffect(() => {
    if (timeGridRef) {
      timeGridRef.current = scrollContainerRef.current;
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
      scrollToDate(selectedDate, true);
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

  // Check if a draft event already exists
  const hasDraftEvent = useMemo(() => {
    return events.some(event => event.isDraft);
  }, [events]);

  const handleDoubleClick = useCallback((e) => {
    // Don't create new event if a draft already exists
    if (hasDraftEvent) return;
    
    if (!scrollContainerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;
    const relativeY = e.clientY - rect.top + scrollTop;
    
    const clickedDate = getDateFromPosition(e.clientX);
    const columnIndex = getColumnFromPosition(e.clientX);
    
    const hourHeight = 80;
    const totalMinutes = (relativeY / hourHeight) * 60;
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

    const draftEventId = crypto.randomUUID();
    const draftEvent = {
      id: draftEventId,
      title: '',
      start: new Date(startTime.getTime()),
      end: new Date(endTime.getTime()),
      color: localStorage.getItem('defaultEventColor') || '#F59E0B',
      repeat: 'none',
      isDraft: true
    };

    setEvents(prev => [...prev, draftEvent]);
    commandBarRef.current?.openWithDragData(startTime, endTime, draftEventId);
  }, [scrollContainerRef, getDateFromPosition, getColumnFromPosition, setPendingEventCell, setEvents, commandBarRef, hasDraftEvent]);

  const handleCellDragStartWrapper = useCallback((e) => {
    if (e.button !== 0) return;
    
    // Don't create new event if a draft already exists
    if (hasDraftEvent) return;
    
    // Don't prevent default immediately - let double-click work
    if (!scrollContainerRef.current) return;
    
    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollTop = scrollContainerRef.current.scrollTop;
    
    const relativeY = e.clientY - rect.top + scrollTop;
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
            isDraft: true,
          };
          setEvents(prev => [...prev, newEvent]);
        }
      }
      
      if (hasDragged && eventCreated && scrollContainerRef.current) {
        const moveRect = scrollContainerRef.current.getBoundingClientRect();
        const moveScrollTop = scrollContainerRef.current.scrollTop;
        const moveRelativeY = moveEvent.clientY - moveRect.top + moveScrollTop;
        
        const moveTotalMinutes = (moveRelativeY / hourHeight) * 60;
        const moveSnappedMinutes = Math.round(moveTotalMinutes / 15) * 15;
        const moveHours = Math.floor(moveSnappedMinutes / 60);
        const moveMins = moveSnappedMinutes % 60;
        
        currentEndTime = new Date(clickedDate);
        currentEndTime.setHours(Math.max(0, Math.min(24, moveHours)), moveMins, 0, 0);
        
        if (currentEndTime <= initialTime) {
          currentEndTime = new Date(initialTime.getTime() + 15 * 60 * 1000);
        }
        
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
      
      // Only open command bar if we actually created an event via drag
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
        
        commandBarRef.current?.openWithDragData(initialTime, finalEndTime, newEventId);
      }
      // If no drag happened, do nothing - let double-click handle event creation
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [scrollContainerRef, getDateFromPosition, getColumnFromPosition, setEvents, setPendingEventCell, commandBarRef, hasDraftEvent]);

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

  const filteredEventsForVisibleDays = useMemo(() => {
    if (!events || events.length === 0 || visibleDays.length === 0) return [];
    
    const firstDay = startOfDay(visibleDays[0]);
    const lastDay = addDays(startOfDay(visibleDays[visibleDays.length - 1]), 1);
    
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
  }, [events, visibleDays, expandRecurringEvents]);

  const getEventStyleForDay = useCallback((event, dayIndex) => {
    const style = {
      position: 'absolute',
      zIndex: 10,
      overflow: 'hidden',
      cursor: 'pointer',
      pointerEvents: 'auto',
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
    
    const dayEvents = filteredEventsForVisibleDays.filter(e => 
      e.start && isSameDay(new Date(e.start), visibleDays[dayIndex])
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

    if (event.isDraft) {
      style.border = `1px dashed ${event.color || '#808080'}`;
      style.opacity = 0.3;
      style.backgroundColor = event.color ? `${event.color}10` : '#80808010';
    } else {
      const now = new Date();
      if (event.end < now && !event.isTaskBlock) {
        style.opacity = 0.5;
      }
    }

    return style;
  }, [dayWidth, filteredEventsForVisibleDays, visibleDays]);

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
    return filteredEventsForVisibleDays.map(event => {
      const eventDate = new Date(event.start);
      const dayIndex = visibleDays.findIndex(day => isSameDay(day, eventDate));
      
      if (dayIndex === -1) return null;
      
      const eventStyle = getEventStyleForDay(event, dayIndex);
      
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
  }, [filteredEventsForVisibleDays, visibleDays, getEventStyleForDay, dragState, handleDragStart, handleEventClickWithSelection, handleEventContextMenuWrapper, handleResizeStart, handleToggleTaskCompletion, selectedEventId]);

  if (dayWidth === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex select-none flex-col h-full">
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex select-none flex-col h-full overflow-hidden">
      <div className="flex-none z-10">
        <div className="flex">
          <div className="flex-shrink-0 pointer-events-none" style={{ width: TIME_COLUMN_WIDTH }}>
            <div className="h-12" />
          </div>

          <div 
            ref={headerScrollRef}
            className="flex-1 overflow-hidden"
          >
            <div 
              className="flex"
              style={{ width: totalWidth }}
            >
              {visibleDays.map((date) => (
                <DayColumnHeader
                  key={date.toISOString()}
                  date={date}
                  dayWidth={dayWidth}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border/50 dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          <div className="relative" style={{ minHeight: '24px' }}>
          </div>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
      >
        <div
          ref={scrollContainerRef}
          className="absolute inset-0 overflow-auto scrollbar-hide"
          onScroll={syncHeaderScroll}
          onWheel={handleWheel}
        >
          <div 
            className="relative flex"
            style={{ 
              width: totalWidth + TIME_COLUMN_WIDTH,
              height: '2000px',
            }}
          >
            <div 
              className="sticky left-0 flex-shrink-0 flex flex-col pointer-events-none bg-light-bg dark:bg-dark-bg-light z-20" 
              style={{ width: TIME_COLUMN_WIDTH }}
            >
              {HOURS.map((hour) => (
                <div key={hour} className={`${hour === 23 ? 'h-40' : 'h-20'} pr-2 relative flex-shrink-0`}>
                  {hour !== 0 && (
                    <span className="absolute right-2 top-[-10px] text-[10px] mt-0.5 text-light-text/50 dark:text-dark-text/50">
                      {`${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? 'AM' : 'PM'}`}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div 
              className="relative"
              style={{ 
                width: totalWidth,
                height: '2000px',
              }}
            >
              <TimeIndicator 
                viewType="week" 
                selectedDate={selectedDate}
                visibleDays={visibleDays}
                dayWidth={dayWidth}
              />

              <div className="absolute inset-0 flex">
                {visibleDays.map((date) => (
                  <DayColumn
                    key={date.toISOString()}
                    date={date}
                    dayWidth={dayWidth}
                    events={events}
                    isDropTarget={isOver}
                  />
                ))}
              </div>

              <div
                ref={setNodeRef}
                className={`absolute inset-0 ${isOver ? 'z-5' : ''}`}
                onDoubleClick={handleDoubleClick}
                onMouseDown={handleCellDragStartWrapper}
                onClick={handleCellClickWrapper}
                onDragOver={handleDragOver}
                onDrop={handleDropWrapper}
              />

              <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                <div style={{ pointerEvents: 'auto' }}>
                  {renderInternalEvents()}
                </div>
              </div>

              {pendingEventCell && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${pendingEventCell.column * dayWidth}px`,
                    width: `${dayWidth}px`,
                    top: `${pendingEventCell.startTime.getHours() * 80 + pendingEventCell.startTime.getMinutes() * (80/60)}px`,
                    height: "80px",
                    backgroundColor: "rgba(var(--primary-rgb), 0.1)",
                    border: "2px dashed rgba(var(--primary-rgb), 0.3)",
                  }}
                />
              )}

              {taskDropPreview && (
                <div
                  className="absolute pointer-events-none z-20 bg-black/5 dark:bg-white/5"
                  style={{
                    left: `${taskDropPreview.column * dayWidth}px`,
                    width: `${dayWidth}px`,
                    top: `${taskDropPreview.start.getHours() * 80 + taskDropPreview.start.getMinutes() * (80/60)}px`,
                    height: `${((taskDropPreview.end.getTime() - taskDropPreview.start.getTime()) / (1000 * 60)) * (80/60)}px`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
