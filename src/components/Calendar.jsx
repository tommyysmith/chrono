'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
  format, 
  addDays, 
  subDays, 
  isSameDay, 
  addMonths, 
  addWeeks, 
  setDate, 
  getDay, 
  lastDayOfMonth, 
  addYears,
  isWeekend,
  isSameMonth
} from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import DeleteEventModal from './DeleteEventModal';
import { motion } from 'framer-motion';
import CommandBar from './CommandBar';
import GoToDateCommand from './GoToDateCommand';
import {
  eventSegments,
  eventLevels,
  inRange,
  getWeekRange,
  getDayRange,
  localizer,
  getOverlappingGroups,
  createRepeatEvent,
  generateRepeatedEvents,
  updateRepeatEvents,
  generateEventId
} from '../utils/eventUtils';
import { TAG_COLORS } from '../constants/colors';
import { Repeat } from '@/assets/icons/Repeat';
import { Trash } from '@/assets/icons/Trash';
import Sidebar from './Sidebar';
import ThemeToggle from '../components/ThemeToggle';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ViewType = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

export default function Calendar({ selectedDate = new Date(), onDateSelect }) {
  const [viewType, setViewType] = useState(ViewType.WEEK);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [events, setEvents] = useState([]);
  const [scrollPosition, setScrollPosition] = useState(null);
  const [modalState, setModalState] = useState({
    isOpen: false,
    startTime: null,
    endTime: null,
  });
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    event: null,
  });
  const [dragState, setDragState] = useState({
    isDragging: false,
    eventId: null,
    dropPreview: null,
    initialOffset: { x: 0, y: 0 },
    originalEvent: null,
    currentColumn: null,
    isEventCreationOpen: false
  });
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, eventId: null });
  const [isGoToDateOpen, setIsGoToDateOpen] = useState(false);
  const [isViewDropdownOpen, setIsViewDropdownOpen] = useState(false);
  const colors = TAG_COLORS;
  const commandBarRef = useRef(null);
  const timeGridRef = useRef(null);
  const contextMenuRef = useRef(null);
  const wasResizingRef = useRef(false);
  const editingEventId = useRef(null);
  const viewDropdownRef = useRef(null);

  // Sync with selectedDate prop
  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Load events from localStorage when component mounts
  useEffect(() => {
    const savedEvents = localStorage.getItem('calendarEvents');
    if (savedEvents) {
      const parsedEvents = JSON.parse(savedEvents).map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
      setEvents(parsedEvents);
    }
  }, []);

  // Add pendingEventCell state
  const [pendingEventCell, setPendingEventCell] = useState(null);

  // Add click tracking state
  const [clickState, setClickState] = useState({
    lastClickTime: 0,
    lastClickPosition: null,
    clickCount: 0,
  });

  // Navigation handlers
  const handlePrevious = () => {
    if (viewType === ViewType.WEEK) {
      onDateSelect?.(subDays(currentDate, 7));
    } else if (viewType === ViewType.DAY) {
      onDateSelect?.(subDays(currentDate, 1));
    } else if (viewType === ViewType.MONTH) {
      onDateSelect?.(addMonths(currentDate, -1));
    }
  };

  const handleNext = () => {
    if (viewType === ViewType.WEEK) {
      onDateSelect?.(addDays(currentDate, 7));
    } else if (viewType === ViewType.DAY) {
      onDateSelect?.(addDays(currentDate, 1));
    } else if (viewType === ViewType.MONTH) {
      onDateSelect?.(addMonths(currentDate, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    onDateSelect?.(today);
  };

  const getTimeFromMousePosition = (mouseY, containerRect) => {
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

  const getColumnFromMousePosition = (mouseX, containerRect) => {
    const timeColumnWidth = 60;
    const availableWidth = containerRect.width - timeColumnWidth;
    const dayWidth = availableWidth / 7;
    const relativeX = mouseX - containerRect.left - timeColumnWidth;
    const column = Math.floor(relativeX / dayWidth);
    return Math.max(0, Math.min(6, column));
  };

  const handleCreateEvent = useCallback((eventData) => {
    const newEvent = {
      ...eventData,
      id: generateEventId(),
      seriesId: null
    };
    
    setEvents(prev => {
      const newEvents = [...prev, newEvent];
      localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
      return newEvents;
    });

    // Immediately open CommandBar for editing
    if (commandBarRef.current) {
      commandBarRef.current.openForEdit(newEvent);
    }

    return newEvent;
  }, []);

  const handleUpdateEvent = useCallback((eventData) => {
    console.log('Handling event update:', eventData);
    
    setEvents(prev => {
      // Find the existing event to determine if it's part of a series
      const existingEvent = prev.find(e => e.id === eventData.id);
      
      // If converting from repeat to non-repeat
      if (existingEvent?.seriesId && (!eventData.repeat || eventData.repeat === 'none')) {
        // Keep only this event and remove the series
        const otherEvents = prev.filter(e => e.seriesId !== existingEvent.seriesId);
        const singleEvent = {
          ...eventData,
          id: existingEvent.id,
          seriesId: null,
          repeat: 'none',
          isRepeat: false
        };
        const newEvents = [...otherEvents, singleEvent];
        localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
        return newEvents;
      }
      
      // If updating a series event
      if (existingEvent?.seriesId) {
        // Get all events in the series
        const seriesEvents = prev.filter(e => e.seriesId === existingEvent.seriesId);
        
        // Calculate the time difference if start/end times changed
        const startDiff = eventData.start - existingEvent.start;
        const endDiff = eventData.end - existingEvent.end;
        const timeChanged = startDiff !== 0 || endDiff !== 0;
        
        return prev.map(event => {
          if (event.seriesId === existingEvent.seriesId) {
            const updatedEvent = {
              ...event,
              title: eventData.title,
              description: eventData.description,
              color: eventData.color,
              isAllDay: eventData.isAllDay,
              repeat: eventData.repeat
            };
            
            // If time changed, adjust all events in the series by the same amount
            if (timeChanged) {
              updatedEvent.start = new Date(event.start.getTime() + startDiff);
              updatedEvent.end = new Date(event.end.getTime() + endDiff);
            }
            
            return updatedEvent;
          }
          return event;
        });
      }
      
      // If converting a single event to a repeat series
      if (!existingEvent?.seriesId && eventData.repeat && eventData.repeat !== 'none') {
        // Remove the original event since it will be included in the series
        const otherEvents = prev.filter(e => e.id !== eventData.id);
        
        // Generate the series events, keeping the original event's ID for the first one
        const repeatedEvents = generateRepeatedEvents({
          ...eventData,
          id: eventData.id // This ensures the first event keeps its ID
        }, eventData.repeat);
        
        const newEvents = [...otherEvents, ...repeatedEvents];
        localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
        return newEvents;
      }
      
      // Otherwise, update a single event
      const updatedEvents = prev.map(event => {
        if (event.id === eventData.id) {
          return {
            ...event,
            ...eventData,
            id: event.id // Preserve the original ID
          };
        }
        return event;
      });
      localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
      return updatedEvents;
    });
  }, []);

  const handleDeleteEvent = (event) => {
    // Only treat as repeated event if it has a repeat property and it's not 'none'
    const isRepeatedEvent = event.repeat && event.repeat !== 'none';
  
    if (isRepeatedEvent) {
      setDeleteModalState({
        isOpen: true,
        event,
      });
    } else {
      // If not a repeated event, delete directly
      setEvents(prevEvents => {
        const updatedEvents = prevEvents.filter(e => e.id !== event.id);
        localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
        return updatedEvents;
      });
    }
  };

  const handleDeleteConfirm = (deleteAll) => {
    const event = deleteModalState.event;
    if (!event) return;

    setEvents(prevEvents => {
      let updatedEvents;
      
      if (deleteAll) {
        // Delete all events in the series by matching both the base event ID and repeat pattern
        const seriesId = event.seriesId;
        updatedEvents = prevEvents.filter(e => {
          // Keep events that either:
          // 1. Don't share the same base ID, or
          // 2. Have the same base ID but different repeat pattern (different series)
          return !e.seriesId || e.seriesId !== seriesId;
        });
      } else {
        // Delete only this specific event instance
        updatedEvents = prevEvents.filter(e => e.id !== event.id);
      }

      localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
      return updatedEvents;
    });

    setDeleteModalState({
      isOpen: false,
      event: null,
    });
  };

  const handleDeleteModalClose = () => {
    setDeleteModalState({
      isOpen: false,
      event: null,
    });
  };

  const handleDragStart = useCallback((e, event) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't start drag if we're resizing
    if (e.target.closest('.resize-handle')) return;
    
    const eventElement = e.currentTarget;
    if (!eventElement) return;

    const container = eventElement.closest('.calendar-grid');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const eventRect = eventElement.getBoundingClientRect();
    
    // Calculate offset from mouse to event top-left corner
    const offsetX = e.clientX - eventRect.left;
    const offsetY = e.clientY - eventRect.top;

    // Create exact copies of the event dates
    const originalEvent = {
      ...event,
      start: new Date(event.start.getTime()),
      end: new Date(event.end.getTime())
    };

    let hasMoved = false;
    const MIN_DRAG_DISTANCE = 5;
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!container) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (!hasMoved && distance >= MIN_DRAG_DISTANCE) {
        hasMoved = true;
      }

      if (!hasMoved) return;

      const currentTime = getTimeFromMousePosition(moveEvent.clientY, containerRect);
      
      // Adjust current time based on column in week view
      let adjustedCurrentTime;
      if (viewType === ViewType.WEEK) {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const currentColumn = getColumnFromMousePosition(moveEvent.clientX, containerRect);
        adjustedCurrentTime = new Date(weekStart);
        adjustedCurrentTime.setDate(weekStart.getDate() + currentColumn);
        adjustedCurrentTime.setHours(
          getTimeFromMousePosition(moveEvent.clientY, containerRect).getHours(),
          getTimeFromMousePosition(moveEvent.clientY, containerRect).getMinutes(),
          0,
          0
        );
      } else {
        adjustedCurrentTime = currentTime;
      }

      // Update the event position
      setEvents(prev => prev.map(e => {
        if (e.id === event.id) {
          const duration = originalEvent.end.getTime() - originalEvent.start.getTime();
          const newStart = adjustedCurrentTime;
          const newEnd = new Date(newStart.getTime() + duration);
          return {
            ...e,
            start: newStart,
            end: newEnd
          };
        }
        return e;
      }));
    };

    const handleUp = () => {
      setTimeout(() => {
        wasResizingRef.current = false;
      }, 0);

      setDragState({
        isResizing: false,
        eventId: null,
        startTime: null,
        initialHeight: null,
        initialWidth: null,
        edge: null,
      });

      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [selectedDate, viewType, getTimeFromMousePosition, getColumnFromMousePosition]);

  const getEventRepeatOption = useCallback((event) => {
    // If the event has a repeat property, use that
    if (event.repeat) {
      return event.repeat;
    }
  
    // Otherwise, try to determine the repeat pattern from the series
    const seriesId = event.seriesId;
    const seriesEvents = events.filter(e => 
      e.seriesId === seriesId
    ).sort((a, b) => a.start - b.start);
  
    if (seriesEvents.length < 2) return 'none';
  
    // Rest of the existing logic to determine repeat pattern...
  }, [events]);

  const handleEventClick = useCallback((event) => {
    if (dragState.isDragging) return;
    
    commandBarRef.current?.openForEdit({
      ...event,
      repeatOption: getEventRepeatOption(event)
    });
  }, [dragState.isDragging, getEventRepeatOption]);

  const handleCellClick = useCallback((e, date) => {
    e.preventDefault();
    e.stopPropagation();  // Add this to prevent event bubbling
    
    const currentTime = Date.now();
    const clickPosition = { x: e.clientX, y: e.clientY };
    
    // Check if this is a double click
    const isDoubleClick = 
      currentTime - clickState.lastClickTime < 300 && 
      clickState.lastClickPosition && 
      Math.abs(clickState.lastClickPosition.x - clickPosition.x) < 10 && 
      Math.abs(clickState.lastClickPosition.y - clickPosition.y) < 10;

    if (isDoubleClick) {
      // Open command bar with the clicked time
      const clickedDate = new Date(date);
      commandBarRef.current?.openWithTime(clickedDate);
      
      // Reset click state
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    } else {
      // Update click state for potential double-click
      setClickState({
        lastClickTime: currentTime,
        lastClickPosition: clickPosition,
        clickCount: clickState.clickCount + 1,
      });
    }
  }, [clickState]);

  const handleCellDragStart = useCallback((e) => {
    // Don't create events if context menu is open or if not left click
    if (contextMenu.show || e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const container = e.currentTarget.closest('.calendar-grid');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    
    // Get initial time and day
    let initialTime = getTimeFromMousePosition(e.clientY, containerRect);
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const initialColumn = getColumnFromMousePosition(e.clientX, containerRect);
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + initialColumn);
      // Transfer the time to the correct day
      initialTime = new Date(dayDate);
      initialTime.setHours(
        getTimeFromMousePosition(e.clientY, containerRect).getHours(),
        getTimeFromMousePosition(e.clientY, containerRect).getMinutes(),
        0,
        0
      );
    }
    
    // Track if we've actually started dragging
    let hasDragged = false;
    const MIN_DRAG_DISTANCE = 5;
    const startX = e.clientX;
    const startY = e.clientY;
    let currentEndTime = initialTime;  // Start with same time, will be updated during drag

    // Create the event immediately with a unique ID
    const newEventId = crypto.randomUUID();
    const newEvent = {
      id: newEventId,
      title: 'New Event',
      start: initialTime,
      end: new Date(initialTime.getTime() + 30 * 60 * 1000), // Start with 30 min duration
      color: colors[Math.floor(Math.random() * colors.length)],
      repeat: 'none',
      isEditing: true
    };

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!container) return;

      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only create event if we've moved enough
      if (!hasDragged && distance >= MIN_DRAG_DISTANCE) {
        hasDragged = true;
        setEvents(prev => {
          // Check if there's already an event at this time
          const existingEvent = prev.find(e => 
            e.start.getTime() === initialTime.getTime() && 
            e.end.getTime() === newEvent.end.getTime()
          );
          
          // If there's an existing event, don't add a new one
          if (existingEvent) {
            return prev;
          }
          
          return [...prev, newEvent];
        });
      }

      if (!hasDragged) return;

      // Get current time from mouse position
      let adjustedCurrentTime;
      if (viewType === ViewType.WEEK) {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const currentColumn = getColumnFromMousePosition(moveEvent.clientX, containerRect);
        adjustedCurrentTime = new Date(weekStart);
        adjustedCurrentTime.setDate(weekStart.getDate() + currentColumn);
        adjustedCurrentTime.setHours(
          getTimeFromMousePosition(moveEvent.clientY, containerRect).getHours(),
          getTimeFromMousePosition(moveEvent.clientY, containerRect).getMinutes(),
          0,
          0
        );
      } else {
        adjustedCurrentTime = getTimeFromMousePosition(moveEvent.clientY, containerRect);
      }

      currentEndTime = adjustedCurrentTime;

      // Update event with requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        setEvents(prev => prev.map(e => {
          if (e.id === newEventId) {
            const isReverse = adjustedCurrentTime < initialTime;
            const start = isReverse ? adjustedCurrentTime : initialTime;
            const end = isReverse ? initialTime : adjustedCurrentTime;
            
            // Ensure minimum 30 minute duration
            const minDuration = 30 * 60 * 1000; // 30 minutes in milliseconds
            const duration = end.getTime() - start.getTime();
            
            if (duration < minDuration) {
              if (isReverse) {
                // If dragging upwards, adjust the start time
                const newStart = new Date(end.getTime() - minDuration);
                return { ...e, start: newStart, end };
              } else {
                // If dragging downwards, adjust the end time
                const newEnd = new Date(start.getTime() + minDuration);
                return { ...e, start, end: newEnd };
              }
            }
            
            return { ...e, start, end };
          }
          return e;
        }));
      });
    };

    const handleUp = (upEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);

      // Only proceed if we actually dragged
      if (hasDragged) {
        // Get the final times, ensuring they're in the correct order
        const finalStartTime = initialTime < currentEndTime ? initialTime : currentEndTime;
        const finalEndTime = initialTime < currentEndTime ? currentEndTime : initialTime;
        
        // Ensure minimum duration of 30 minutes
        const minDuration = 30 * 60 * 1000;
        const duration = finalEndTime.getTime() - finalStartTime.getTime();
        const adjustedEndTime = duration < minDuration 
          ? new Date(finalStartTime.getTime() + minDuration)
          : finalEndTime;

        // Update the event's final position
        requestAnimationFrame(() => {
          setEvents(prev => prev.map(e => {
            if (e.id === newEventId) {
              return {
                ...e,
                start: finalStartTime,
                end: adjustedEndTime
              };
            }
            return e;
          }));
        });
        
        // Open command bar with the dragged times and event ID
        commandBarRef.current?.openWithDragData(finalStartTime, adjustedEndTime, newEventId);
      } else {
        // If we didn't drag, remove the event
        setEvents(prev => prev.filter(e => e.id !== newEventId));
      }

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [selectedDate, viewType, getTimeFromMousePosition, getColumnFromMousePosition, colors]);

  const handleScroll = useCallback(() => {
    if (timeGridRef.current) {
      setScrollPosition(timeGridRef.current.scrollTop);
    }
  }, []);

  const handleEventContextMenu = useCallback((e, eventId) => {
    e.preventDefault();
    e.stopPropagation();

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Context menu dimensions (hardcoded since they're fixed in CSS)
    const menuWidth = 280; // matches w-[280px] in CSS
    const menuHeight = 180; // approximate height of context menu

    // Calculate initial position
    let x = e.clientX;
    let y = e.clientY;

    // Adjust position if menu would overflow right edge
    if (x + menuWidth > viewportWidth) {
      x = viewportWidth - menuWidth - 16; // 16px padding from edge
    }

    // Adjust position if menu would overflow bottom edge
    if (y + menuHeight > viewportHeight) {
      y = viewportHeight - menuHeight - 16; // 16px padding from edge
    }

    // Ensure menu doesn't go off the left or top edge
    x = Math.max(16, x);
    y = Math.max(16, y);

    setContextMenu({
      show: true,
      x,
      y,
      eventId
    });
  }, []);

  const handleColorSelect = useCallback((e, color) => {
    e.stopPropagation();
    e.preventDefault();
  
    const eventToUpdate = events.find(event => event.id === contextMenu.eventId);
    if (!eventToUpdate) return;
  
    // Check if this is part of a repeated series
    const isRepeatedEvent = eventToUpdate.repeat && eventToUpdate.repeat !== 'none';
  
    setEvents(prevEvents => {
      let updatedEvents;
      
      if (isRepeatedEvent) {
        // Update all events in the series
        const seriesId = eventToUpdate.seriesId;
        updatedEvents = prevEvents.map(event => {
          if (event.seriesId === seriesId) {
            return { ...event, color };
          }
          return event;
        });
      } else {
        // Update single event
        updatedEvents = prevEvents.map(event => 
          event.id === contextMenu.eventId ? { ...event, color } : event
        );
      }

      try {
        localStorage.setItem('calendarEvents', JSON.stringify(updatedEvents));
      } catch (error) {
        console.error('Error saving events to localStorage:', error);
      }
      return updatedEvents;
    });
  
    setContextMenu({ show: false, x: 0, y: 0, eventId: null });
  }, [contextMenu.eventId, events]);

  const handleEventDelete = useCallback((e) => {
    e.stopPropagation();
    const event = events.find(event => event.id === contextMenu.eventId);
    handleDeleteEvent(event);
    setContextMenu({ show: false, x: 0, y: 0, eventId: null });
  }, [contextMenu.eventId, events]);

  const handleResizeStart = useCallback((e, eventId, edge) => {
    e.preventDefault();
    e.stopPropagation();
    
    const eventElement = e.currentTarget.closest('.event-item');
    if (!eventElement) return;

    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    const container = eventElement.closest('.calendar-grid');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const initialY = e.clientY;
    const initialX = e.clientX;
    const hourHeight = 64;
    const timeColumnWidth = 60;
    const availableWidth = containerRect.width - timeColumnWidth;
    const dayWidth = availableWidth / 7;

    setDragState({
      isResizing: true,
      eventId: null,
      startTime: ['left', 'top'].includes(edge) ? event.end : event.start,
      initialHeight: eventElement.offsetHeight,
      initialWidth: eventElement.offsetWidth,
      edge,
    });

    const getTimeFromY = (y) => {
      const scrollTop = container.scrollTop;
      const relativeY = y - containerRect.top + scrollTop;
      const totalMinutes = (relativeY / hourHeight) * 60;
      const roundedMinutes = Math.round(totalMinutes / 15) * 15;
      
      const hours = Math.floor(roundedMinutes / 60);
      const minutes = roundedMinutes % 60;
      
      // Create new date while preserving the original date
      const time = edge === 'top' ? new Date(event.start) : new Date(event.end);
      time.setHours(hours);
      time.setMinutes(minutes);
      time.setSeconds(0);
      time.setMilliseconds(0);
      return time;
    };

    const getDayFromX = (x) => {
      const relativeX = x - containerRect.left - timeColumnWidth;
      const dayIndex = Math.floor(relativeX / dayWidth);
      
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      
      const newDate = new Date(weekStart);
      newDate.setDate(weekStart.getDate() + dayIndex);

      // Preserve the original time
      const originalTime = edge === 'left' ? event.end : event.start;
      newDate.setHours(
        originalTime.getHours(),
        originalTime.getMinutes(),
        0,
        0
      );
      
      return newDate;
    };

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      if (!container) return;

      let newTime;
      if (edge === 'left' || edge === 'right') {
        newTime = getDayFromX(moveEvent.clientX);
      } else {
        newTime = getTimeFromY(moveEvent.clientY);
      }

      setEvents(prevEvents => 
        prevEvents.map(e => {
          if (e.id === eventId) {
            const newEvent = { ...e };
            if (edge === 'bottom') {
              if (newTime > e.start) {
                // Preserve the date of the end time, only update hours and minutes
                const updatedEnd = new Date(e.end);
                updatedEnd.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
                newEvent.end = updatedEnd;
              }
            } else if (edge === 'top') {
              if (newTime < e.end) {
                // Preserve the date of the start time, only update hours and minutes
                const updatedStart = new Date(e.start);
                updatedStart.setHours(newTime.getHours(), newTime.getMinutes(), 0, 0);
                newEvent.start = updatedStart;
              }
            } else if (edge === 'right') {
              const endOfDay = new Date(newTime);
              endOfDay.setHours(e.end.getHours(), e.end.getMinutes(), 0, 0);
              if (endOfDay >= e.start) {
                newEvent.end = endOfDay;
              }
            } else if (edge === 'left') {
              const startOfDay = new Date(newTime);
              startOfDay.setHours(e.start.getHours(), e.start.getMinutes(), 0, 0);
              if (startOfDay <= e.end) {
                newEvent.start = startOfDay;
              }
            }
            return newEvent;
          }
          return e;
        })
      );
    };

    const handleUp = () => {
      setTimeout(() => {
        wasResizingRef.current = false;
      }, 0);

      setDragState({
        isResizing: false,
        eventId: null,
        startTime: null,
        initialHeight: null,
        initialWidth: null,
        edge: null,
      });

      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [events, selectedDate]);

  const visibleEvents = useMemo(() => {
    const range = viewType === ViewType.WEEK ? 
      getWeekRange(selectedDate) : 
      getDayRange(selectedDate);

    return events.filter(event => 
      inRange(event, range[0], range[range.length - 1])
    );
  }, [events, selectedDate, viewType]);

  const eventLayout = useMemo(() => {
    if (viewType === ViewType.WEEK) {
      const range = getWeekRange(selectedDate);
      const segments = visibleEvents.map(event => eventSegments(event, range));
      return eventLevels(segments);
    }
    return { levels: [visibleEvents], extra: [] };
  }, [visibleEvents, selectedDate, viewType]);

  const handleModalSave = useCallback(({ title, startTime, endTime, repeat }) => {
    const newEvent = {
      id: crypto.randomUUID(),
      title,
      start: new Date(startTime),
      end: new Date(endTime),
      repeat: repeat || 'none'
    };
    
    setEvents(prevEvents => {
      let newEvents = [];
      if (newEvent.repeat && newEvent.repeat !== 'none') {
        // Generate repeated events for a repeat series
        const repeatedEvents = generateRepeatedEvents(newEvent, newEvent.repeat);
        newEvents = [...prevEvents, ...repeatedEvents];
      } else {
        newEvents = [...prevEvents, newEvent];
      }
      
      localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
      return newEvents;
    });
  }, []);

  const handleModalClose = () => {
    // Clear creation state when modal is closed without creating
    setDragState({
      isDragging: false,
      eventId: null,
      dropPreview: null,
      initialOffset: { x: 0, y: 0 },
      originalEvent: null,
      currentColumn: null,
      isEventCreationOpen: false
    });
    
    setModalState({
      isOpen: false,
      startTime: null,
      endTime: null
    });
  };

  const handleCommandBarClose = useCallback((eventId) => {
    // If an eventId is provided, remove that specific event
    if (eventId) {
      setEvents(prev => prev.filter(e => e.id !== eventId));
    }
  }, []);

  const eventsOverlap = (event1, event2) => {
    if (!isSameDay(event1.start, event2.start)) return false;
    const start1 = event1.start.getTime();
    const end1 = event1.end.getTime();
    const start2 = event2.start.getTime();
    const end2 = event2.end.getTime();
    return start1 < end2 && end1 > start2;
  };

  const findOverlappingGroup = (targetEvent, allEvents) => {
    // First, find all events that overlap with any other event
    const overlapGraph = new Map();
    const allEventsList = [targetEvent, ...allEvents];
    
    // Build a graph of overlapping events
    allEventsList.forEach(event1 => {
      if (!overlapGraph.has(event1.id)) {
        overlapGraph.set(event1.id, new Set());
      }
      allEventsList.forEach(event2 => {
        if (event1.id !== event2.id && eventsOverlap(event1, event2)) {
          overlapGraph.get(event1.id).add(event2.id);
        }
      });
    });
    
    // Find all connected events using DFS
    const visited = new Set();
    const group = new Set();
    
    const dfs = (eventId) => {
      if (visited.has(eventId)) return;
      visited.add(eventId);
      
      // Add all events that are connected through overlaps
      overlapGraph.get(eventId).forEach(connectedId => {
        const connectedEvent = allEventsList.find(e => e.id === connectedId);
        if (connectedEvent && connectedEvent.id !== targetEvent.id) {
          group.add(connectedEvent);
        }
        dfs(connectedId);
      });
    };
    
    dfs(targetEvent.id);
    return Array.from(group);
  };

  const getEventStyle = (event, overlappingEvents = []) => {
    const style = {
      position: 'absolute',
      backgroundColor: event.color ? `${event.color}20` : '#80808020',
      zIndex: 10,
      borderRadius: '4px',
      margin: '0',
      padding: '2px 4px',
      fontSize: '12px',
      overflow: 'hidden',
      cursor: 'pointer',
    };

    // Add lower opacity for past events
    const now = new Date('2025-01-27T14:44:40Z');
    if (event.end < now) {
      style.opacity = 0.5;
    }

    if (event.isAllDay) {
      style.top = '8px';  // Fixed position at the top
    } else {
      if (event.start) {
        const minutes = event.start.getHours() * 60 + event.start.getMinutes();
        style.top = `${minutes * (64 / 60)}px`;
      }

      if (event.end) {
        const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
        const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
        style.height = `${(endMinutes - startMinutes) * (64 / 60)}px`;
      }
    }

    if (viewType === ViewType.WEEK) {
      const startDayIndex = event.start.getDay();
      const baseLeft = startDayIndex * (100 / 7);
      
      // Find all transitively overlapping events
      const overlappingInTime = findOverlappingGroup(event, overlappingEvents);

      if (overlappingInTime.length > 0) {
        // Sort overlapping events by start time, then by duration
        const sortedEvents = [event, ...overlappingInTime].sort((a, b) => {
          const startDiff = a.start.getTime() - b.start.getTime();
          if (startDiff !== 0) return startDiff;
          
          // If start times are equal, sort by duration (longer events first)
          const aDuration = a.end.getTime() - a.start.getTime();
          const bDuration = b.end.getTime() - b.start.getTime();
          if (aDuration !== bDuration) return bDuration - aDuration;
          
          // If durations are equal, sort by ID for consistency
          return (a.id || '').localeCompare(b.id || '');
        });

        const eventIndex = sortedEvents.findIndex(e => e.id === event.id);
        const totalEvents = overlappingInTime.length + 1;
        
        // Calculate width and offset
        const columnWidth = 100 / 7; // Width of one day column
        const eventWidth = (columnWidth * 0.95) / totalEvents; // 95% of column width divided by number of events
        const offset = (eventWidth * eventIndex) + (columnWidth * 0.025); // Add 2.5% padding on each side
        
        style.width = `${eventWidth}%`;
        style.left = `${baseLeft + offset}%`;
      } else {
        // No overlapping events, use full column width with small margins
        style.width = `calc(${100 / 7}% - 4px)`;
        style.left = `calc(${baseLeft}% + 2px)`;
      }
    } else {
      // Find all transitively overlapping events
      const overlappingInTime = findOverlappingGroup(event, overlappingEvents);

      if (overlappingInTime.length > 0) {
        // Sort overlapping events by start time, then by duration
        const sortedEvents = [event, ...overlappingInTime].sort((a, b) => {
          const startDiff = a.start.getTime() - b.start.getTime();
          if (startDiff !== 0) return startDiff;
          
          // If start times are equal, sort by duration (longer events first)
          const aDuration = a.end.getTime() - a.start.getTime();
          const bDuration = b.end.getTime() - b.start.getTime();
          if (aDuration !== bDuration) return bDuration - aDuration;
          
          // If durations are equal, sort by ID for consistency
          return (a.id || '').localeCompare(b.id || '');
        });

        const eventIndex = sortedEvents.findIndex(e => e.id === event.id);
        const totalEvents = overlappingInTime.length + 1;
        
        // Calculate width and offset for day view
        const eventWidth = 95 / totalEvents; // 95% of total width divided by number of events
        const offset = (eventWidth * eventIndex) + 2.5; // Add 2.5% padding on each side
        
        style.width = `${eventWidth}%`;
        style.left = `${offset}%`;
      } else {
        // No overlapping events in day view, use 95% width with centered position
        style.width = '95%';
        style.left = '2.5%';
      }
    }

    return style;
  };

  const getDragOverlayStyle = () => {
    if (!dragState.isDragging || !dragState.dropPreview) return null;

    const { start, end } = dragState.dropPreview;
    const isReverse = end < start;

    const startTime = isReverse ? end : start;
    const endTime = isReverse ? start : end;

    const hourHeight = 64;
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const startDayDiff = Math.floor((startTime - weekStart) / (1000 * 60 * 60 * 24));

    return {
      top: `${(startMinutes / 60) * hourHeight}px`,
      height: `${((endMinutes - startMinutes) / 60) * hourHeight}px`,
      left: `calc(60px + ((100% - 60px) * ${startDayDiff} / 7))`,
      width: `${100 / 7}%`
    };
  };

  const renderDragOverlay = () => {
    console.log('renderDragOverlay: current dragState', dragState);
    // Keep overlay visible if either dragging is active or event creation is in progress
    if (!dragState.dropPreview && !dragState.isEventCreationOpen) return null;

    const { start, end } = dragState.dropPreview;
    const isReverse = end < start;

    // Snap to 15-minute intervals
    const snapToInterval = (date) => {
      const minutes = date.getMinutes();
      const snappedMinutes = Math.round(minutes / 15) * 15;
      const newDate = new Date(date);
      newDate.setMinutes(snappedMinutes);
      return newDate;
    };

    const snappedStart = snapToInterval(isReverse ? end : start);
    const snappedEnd = snapToInterval(isReverse ? start : end);

    // Create temporary event object for preview
    const previewEvent = {
      id: 'preview',
      start: snappedStart,
      end: snappedEnd,
      title: 'New Event',
    };

    // Find overlapping events for the preview time slot
    const overlappingEvents = events.filter(event => 
      event.start.getDate() === snappedStart.getDate() && 
      eventsOverlap(event, previewEvent)
    );

    return (
      <div
        className="absolute z-[5] backdrop-blur-sm rounded-[9px] overflow-hidden pointer-events-none overflow-hidden"
        style={getEventStyle(previewEvent, overlappingEvents)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/50" />
        <div className="px-3 py-1">
          <div className="font-medium text-xs opacity-50">New Event</div>
          <div className="text-xs text-light-text/30 dark:text-dark-text/30">
            {format(snappedStart, 'h:mm a')} - {format(snappedEnd, 'h:mm a')}
          </div>
        </div>
      </div>
    );
  };

  const renderDropPreview = () => {
    if (!dragState.isDragging || !dragState.dropPreview || !dragState.eventId) return null;

    const event = events.find(e => e.id === dragState.eventId);
    if (!event) return null;

    const previewEvent = {
      ...event,
      ...dragState.dropPreview
    };

    // Find overlapping events for the preview time slot, excluding the dragged event
    const overlappingEvents = events.filter(evt => 
      evt.id !== dragState.eventId && 
      evt.start.getDate() === previewEvent.start.getDate() && 
      eventsOverlap(evt, previewEvent)
    );

    return (
      <div
        className="absolute z-[5] bg-primary/5 backdrop-blur-sm rounded-[9px] pointer-events-none overflow-hidden"
        style={getEventStyle(previewEvent, overlappingEvents)}
      >
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 opacity-50" 
          style={{ backgroundColor: event.color || '#808080' }} 
        />
        <div className="px-3 py-1">
          <div className="font-medium text-xs opacity-50">{event.title}</div>
          <div className="text-xs text-light-text/30 dark:text-dark-text/30">
            {format(dragState.dropPreview.start, 'h:mm a')} - {format(dragState.dropPreview.end, 'h:mm a')}
          </div>
        </div>
      </div>
    );
  };

  const renderEvents = useCallback(() => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const filteredEvents = events
        .filter(event => {
          const eventStart = new Date(event.start);
          return eventStart >= weekStart && eventStart < weekEnd && !event.isAllDay;
        });

      return filteredEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, filteredEvents);

        return (
          <div
            key={`${event.id}-${index}`}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer ${
              event.isEditing || dragState.eventId === event.id ? 'bg-primary/30' : 'bg-primary/10'
            } event-item group`}
            style={getEventStyle(event, overlappingEvents)}
            onMouseDown={(e) => {
              if (e.button === 0) { // Left click only
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div 
              className="absolute left-0 top-0 bottom-0 w-1" 
              style={{ backgroundColor: event.color || '#808080' }} 
            />
            {/* Only show resize handles for non-editing events */}
            {!event.isEditing && (
              <>
                {/* Vertical resize handles */}
                <div 
                  className="absolute top-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, 'top')}
                />
                <div 
                  className="absolute bottom-0 left-2 right-2 h-2 cursor-ns-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, 'bottom')}
                />
                {/* Horizontal resize handles */}
                <div 
                  className="absolute left-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, 'left')}
                />
                <div 
                  className="absolute right-0 top-2 bottom-2 w-2 cursor-ew-resize resize-handle"
                  onMouseDown={(e) => handleResizeStart(e, event.id, 'right')}
                />
              </>
            )}
            <div className="px-3 py-1">
              <div className="font-medium text-xs">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
              </div>
              {event.repeat && event.repeat !== 'none' && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        );
      });
    } else {
      // Day view
      const dayEvents = events.filter(
        event => !event.isAllDay && isSameDay(event.start, selectedDate)
      );

      return dayEvents.map((event, index) => {
        // Use findOverlappingGroup to get all transitively overlapping events
        const overlappingEvents = findOverlappingGroup(event, dayEvents);

        return (
          <div
            key={`${event.id}-${index}`}
            className={`absolute z-10 backdrop-blur-md rounded-[9px] overflow-hidden cursor-move ${dragState.eventId === event.id ? 'bg-primary/30' : 'bg-primary/10'}`}
            style={getEventStyle(event, overlappingEvents)}
            onMouseDown={(e) => {
              if (e.button === 0) { // Left click only
                handleDragStart(e, event);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              handleEventClick(event);
            }}
            onContextMenu={(e) => handleEventContextMenu(e, event.id)}
          >
            <div 
              className="absolute left-0 top-0 bottom-0 w-1" 
              style={{ backgroundColor: event.color || '#808080' }} 
            />
            <div className="px-2 py-1">
              <div className="font-medium text-sm">{event.title}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
              </div>
              {event.repeat && event.repeat !== 'none' && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </div>
        );
      });
    }
  }, [events, selectedDate, viewType, dragState, handleDragStart, handleEventClick]);

  const renderAllDayEvents = () => {
    if (viewType === ViewType.WEEK) {
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      return (
        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const currentDate = addDays(weekStart, dayIndex);
              const dayEvents = events.filter(
                event => event.isAllDay && isSameDay(event.start, currentDate)
              );

              return (
                <div
                  key={dayIndex}
                  className="relative border-l border-light-border dark:border-dark-border min-h-[32px]"
                >
                  <div className="flex flex-col gap-1 p-1">
                    {dayEvents.map((event, index) => (
                      <div
                        key={`${event.id}-${index}`}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                        className="flex items-center text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] overflow-hidden"
                        style={{ backgroundColor: event.color ? `${event.color}20` : '#80808020' }}
                      >
                        <div className="w-1 self-stretch mr-1.5" style={{ backgroundColor: event.color || '#808080' }} />
                        <div className="px-3 py-1">
                          <div className="font-medium text-xs">{event.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
        <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
          All-day
        </div>
        <div className="relative">
          <div className="flex flex-col gap-1 p-1">
            {events
              .filter(event => event.isAllDay && isSameDay(event.start, selectedDate))
              .map((event, index) => (
                <div
                  key={`${event.id}-${index}`}
                  className="z-10 bg-primary/5 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/10"
                  style={{ backgroundColor: event.color ? `${event.color}20` : '#80808020' }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleEventClick(event);
                  }}
                  onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-1" 
                    style={{ backgroundColor: event.color || '#808080' }} 
                  />
                  <div className="px-3 py-1">
                    <div className="font-medium text-xs">{event.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    );
  };

  const renderHeader = () => {
    const dateFormat = { month: 'long', year: 'numeric' };
    if (viewType === ViewType.DAY) {
      dateFormat.weekday = 'long';
      dateFormat.day = 'numeric';
    }
    
    return (
      <div className="flex items-center justify-between p-4 border-b border-light-border dark:border-dark-border">
        <div className="flex w-full justify-between items-center gap-4">
          <ThemeToggle/>
          <div className="flex items-baseline">
            <h1 className="text-xl font-semibold">
              {selectedDate.toLocaleString('en-US', { month: 'long' })}
            </h1>
            <span className="text-xl font-regular text-gray-400 ml-2">
              {selectedDate.getFullYear()}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <div className="relative">
              <div 
                className="flex items-center gap-2 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              >
                <span className="text-sm font-medium text-light-text dark:text-dark-text">
                  {viewType === ViewType.DAY ? 'Day' : viewType === ViewType.WEEK ? 'Week' : 'Month'}
                </span>
                <svg className={`w-4 h-4 text-light-text/50 dark:text-dark-text/50 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none">
                  <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {isViewDropdownOpen && (
                <div 
                  ref={viewDropdownRef}
                  className="absolute top-full right-0 mt-1 bg-white dark:bg-dark-bg border border-light-border dark:border-dark-border text-xs rounded-[13px] shadow-lg py-1 min-w-[120px] z-50"
                >
                  {Object.values(ViewType).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setViewType(type);
                        setIsViewDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between ${
                        viewType === type 
                          ? 'text-light-text text-xs dark:text-dark-text bg-black/5 dark:bg-white/5' 
                          : 'text-light-text/50 text-xs dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                      <span className="text-light-text/30 dark:text-dark-text/30 text-[10px] border h-[20px] w-[20px] rounded-[5px] flex items-center justify-center border-light-border dark:border-dark-border">
                        {type.charAt(0).toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleTodayClick = () => {
    const now = new Date();
    // Create date using local time
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    onDateSelect(today);
  };

  const renderDayView = () => (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Headers */}
      <div className="flex-none">
        {/* Empty header space */}
        <div className="grid grid-cols-[60px_1fr]">
          <div className="flex flex-col pointer-events-none">
            <div className="h-12" />
          </div>
          <div className="h-12 flex gap-1 flex-row items-center justify-center relative">
            <div className="absolute left-1/2 -translate-x-[60px] flex gap-1 items-center">
              <div className="text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
                {DAYS[selectedDate.getDay()]}
              </div>
              <div className="text-xs text-light-text dark:text-dark-text font-semibold">
                {isSameDay(selectedDate, new Date())
                  ? (
                    <span className="bg-primary text-white px-1 py-1 rounded-[5px]">
                      {format(selectedDate, 'd')}
                    </span>
                  )
                  : format(selectedDate, 'd')
                }
              </div>
            </div>
          </div>
        </div>

        {/* All-day events section */}
        <div className="grid grid-cols-[60px_1fr] min-h-[32px] border-t border-b border-light-border dark:border-dark-border">
          <div className="flex items-start px-2 pt-2 text-[11px] text-light-text/30 dark:text-dark-text/30 font-medium">
            All-day
          </div>
          <div className="relative">
            <div className="flex flex-col gap-1 p-1">
              {events
                .filter(event => event.isAllDay && isSameDay(event.start, selectedDate))
                .map((event, index) => (
                  <div
                    key={`${event.id}-${index}`}
                    className="z-10 bg-primary/5 backdrop-blur-md rounded-[9px] overflow-hidden cursor-pointer hover:ring-2 hover:ring-white/10"
                    style={{ backgroundColor: event.color ? `${event.color}20` : '#80808020' }}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleEventClick(event);
                    }}
                    onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                  >
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1" 
                      style={{ backgroundColor: event.color || '#808080' }} 
                    />
                    <div className="px-3 py-1">
                      <div className="font-medium text-xs">{event.title}</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div 
        ref={timeGridRef}
        className="flex-1 overflow-y-auto scrollbar-hide"
      >
        <div className="grid grid-cols-[60px_1fr] h-[1600px] relative w-full calendar-grid">
          {/* Time indicator */}
          <TimeIndicator />

          {/* Time labels */}
          <div className="flex flex-col pointer-events-none">
            {HOURS.map(hour => (
              <div key={hour} className="h-16 pr-2 relative">
                <span className="absolute right-2 top-[-10px] text-xs text-gray-500">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Main grid area */}
          <div className="relative grid grid-cols-1" onMouseDown={handleCellDragStart}>
            {/* Background grid lines */}
            <div className="absolute inset-0">
              {HOURS.map(hour => (
                <div key={hour} className="h-16">
                  <div className="absolute left-0 right-0 border-b border-light-border dark:border-dark-border" />
                </div>
              ))}
              <div className="absolute inset-0">
                <div className="border-l border-light-border dark:border-dark-border h-full" />
              </div>
            </div>

            {/* Events layer */}
            <div className="relative h-full">
              {/* Drag overlay */}
              {dragState.isDragging && renderDropPreview()}
              {renderEvents()}
              {/* Pending event highlight */}
              {pendingEventCell && (
                <div 
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: `${(pendingEventCell.column / 7) * 100}%`,
                    width: `${100 / 7}%`,
                    top: `${pendingEventCell.startTime.getHours() * 64}px`,
                    height: '64px'
                  }}
                />
              )}
            </div>

            {/* Interaction layer */}
            <div
              onDoubleClick={(e) => {
                // Don't create events if context menu is open
                if (contextMenu.show) return;

                const container = e.currentTarget.closest('.calendar-grid');
                if (!container) return;

                const containerRect = container.getBoundingClientRect();
                const clickedTime = getTimeFromMousePosition(e.clientY, containerRect);
                const column = viewType === ViewType.WEEK ? 
                  getColumnFromMousePosition(e.clientX, containerRect) : 
                  0;

                // Create a new date at the start of the clicked hour
                const startTime = new Date(clickedTime);
                startTime.setMinutes(0);
                startTime.setSeconds(0);
                startTime.setMilliseconds(0);
                
                // Create end time exactly one hour after start
                const endTime = new Date(startTime.getTime() + 60 * 60000);
                
                // Adjust for week view
                const weekStart = new Date(selectedDate);
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                startTime.setDate(weekStart.getDate() + column);
                endTime.setDate(weekStart.getDate() + column);

                // Set the pending event cell
                setPendingEventCell({
                  startTime,
                  endTime,
                  column
                });

                // Open command bar with the hour-aligned times
                commandBarRef.current?.openWithDragData(startTime, endTime);
              }}
              onMouseDown={handleCellDragStart}
              onClick={(e) => handleCellClick(e, new Date(selectedDate))}
              onDragOver={(e) => handleDragOver(e)}
              onDrop={(e) => handleDrop(e, new Date(selectedDate))}
              className="absolute inset-0"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekStart = new Date(selectedDate);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    
    return (
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Headers */}
        <div className="flex-none">
          {/* Days header */}
          <div className="grid grid-cols-[60px_1fr]">
            {/* Time column header */}
            <div className="flex flex-col pointer-events-none">
              <div className="h-12" />
            </div>

            {/* Main grid area */}
            <div className="relative grid grid-cols-7">
              {/* Background grid lines */}
              <div className="absolute inset-0">
                <div className="absolute inset-0 grid grid-cols-7">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className=" h-full" />
                  ))}
                </div>
              </div>

              {/* Days */}
              {Array.from({ length: 7 }).map((_, i) => {
                const date = addDays(weekStart, i);
                return (
                  <div
                    key={i}
                    className={`h-12 flex gap-1 flex-row items-center justify-center ${
                      isSameDay(date, new Date())
                        ? ''
                        : 'bg-light-background-secondary dark:bg-dark-background-secondary'
                    }`}
                  >
                    <div className="text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
                      {DAYS[date.getDay()]}
                    </div>
                    <div className="text-xs text-light-text dark:text-dark-text font-semibold">
                      {isSameDay(date, new Date())
                        ? (
                          <span className="text-white bg-primary px-1 py-1 rounded-md">
                            {format(date, 'd')}
                          </span>
                        )
                        : format(date, 'd')
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-day events section */}
          {renderAllDayEvents()}
        </div>

        {/* Time grid */}
        <div 
          ref={timeGridRef}
          className="flex-1 overflow-y-auto scrollbar-hide"
        >
          <div className="grid grid-cols-[60px_1fr] h-[1600px] relative w-full calendar-grid">
            {/* Time indicator */}
            <TimeIndicator />

            {/* Time labels */}
            <div className="flex flex-col pointer-events-none">
              {HOURS.map(hour => (
                <div key={hour} className="h-16 pr-2 relative">
                  <span className="absolute right-2 top-[-10px] text-xs text-gray-500">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Main grid area */}
            <div className="relative grid grid-cols-7">
              {/* Background grid lines */}
              <div className="absolute inset-0">
                {HOURS.map(hour => (
                  <div key={hour} className="h-16">
                    <div className="absolute left-0 right-0 border-b border-light-border dark:border-dark-border" />
                  </div>
                ))}
                <div className="absolute inset-0 grid grid-cols-7">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="border-l border-light-border dark:border-dark-border h-full" />
                  ))}
                </div>
              </div>

              {/* Events layer */}
              <div className="relative col-span-7 h-full">
                {/* Drag overlays */}
                {dragState.isDragging && (
                  dragState.eventId ? renderDropPreview() : renderDragOverlay()
                )}
                {renderEvents()}
                {/* Pending event highlight */}
                {pendingEventCell && (
                  <div 
                    className="absolute pointer-events-none z-10"
                    style={{
                      left: `${(pendingEventCell.column / 7) * 100}%`,
                      width: `${100 / 7}%`,
                      top: `${pendingEventCell.startTime.getHours() * 64}px`,
                      height: '64px'
                    }}
                  />
                )}
              </div>

              {/* Interaction layer */}
              <div
                onDoubleClick={(e) => {
                  // Don't create events if context menu is open
                  if (contextMenu.show) return;

                  const container = e.currentTarget.closest('.calendar-grid');
                  if (!container) return;

                  const containerRect = container.getBoundingClientRect();
                  const clickedTime = getTimeFromMousePosition(e.clientY, containerRect);
                  const column = viewType === ViewType.WEEK ? 
                    getColumnFromMousePosition(e.clientX, containerRect) : 
                    0;

                  // Create a new date at the start of the clicked hour
                  const startTime = new Date(clickedTime);
                  startTime.setMinutes(0);
                  startTime.setSeconds(0);
                  startTime.setMilliseconds(0);
                  
                  // Create end time exactly one hour after start
                  const endTime = new Date(startTime.getTime() + 60 * 60000);
                  
                  // Adjust for week view
                  const weekStart = new Date(selectedDate);
                  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                  startTime.setDate(weekStart.getDate() + column);
                  endTime.setDate(weekStart.getDate() + column);

                  // Set the pending event cell
                  setPendingEventCell({
                    startTime,
                    endTime,
                    column
                  });

                  // Open command bar with the hour-aligned times
                  commandBarRef.current?.openWithDragData(startTime, endTime);
                }}
                onMouseDown={handleCellDragStart}
                onClick={(e) => handleCellClick(e, new Date(selectedDate))}
                onDragOver={(e) => handleDragOver(e)}
                onDrop={(e) => handleDrop(e, new Date(selectedDate))}
                className="absolute inset-0"
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const visibleDays = getMonthDays(selectedDate.getFullYear(), selectedDate.getMonth());

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-light-border dark:border-dark-border">
          {DAYS.map((day) => (
            <div key={day} className="h-8 flex items-center justify-end p-2">
              <span className="text-xs text-gray-500 font-medium">{day}</span>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-hidden">
          {visibleDays.map((dayInfo, i) => {
            const isToday = isSameDay(dayInfo.date, new Date());
            const isCurrentMonth = isSameMonth(dayInfo.date, selectedDate);
            const dayEvents = getDayEvents(dayInfo.date);

            return (
              <div
                key={i}
                className={`min-h-[100px] border-b border-r border-light-border dark:border-dark-border p-1 ${
                  !isCurrentMonth ? 'bg-light-background-secondary dark:bg-dark-background-secondary' : ''
                }`}
              >
                {/* Date number */}
                <div className="flex justify-end mb-1">
                  <span
                    className={`text-sm px-1 rounded-md ${
                      isToday
                        ? 'bg-primary text-white font-medium'
                        : !isCurrentMonth
                        ? 'text-gray-500'
                        : ''
                    }`}
                  >
                    {format(dayInfo.date, 'd')}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {dayEvents.map((event, index) => (
                    <div
                      key={`${event.id}-${index}`}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      onContextMenu={(e) => handleEventContextMenu(e, event.id)}
                      className="flex items-center text-xs cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] overflow-hidden"
                      style={{ backgroundColor: event.color ? `${event.color}20` : '#80808020' }}
                    >
                      <div className="w-1 self-stretch mr-1.5" style={{ backgroundColor: event.color || '#808080' }} />
                      <span className="text-gray-500 py-1">
                        {format(new Date(event.start), 'HH:mm')}
                      </span>
                      <span className="ml-1 truncate py-1">{event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const hourHeight = 64; // h-16 = 4rem = 64px
    const minutes = now.getHours() * 60 + now.getMinutes();
    const hour = Math.floor(minutes / 60);
    const minuteOffset = (minutes % 60) / 60;
    
    // Position is based on the hour block plus the minute offset within that hour
    return (hour * hourHeight) + (minuteOffset * hourHeight) - 10; // -10px to align with hour markers
  };

  const TimeIndicator = () => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
      // Update immediately
      setCurrentTime(new Date());
      
      // Then update every minute
      const timer = setInterval(() => {
        setCurrentTime(new Date());
      }, 60000);

      return () => clearInterval(timer);
    }, []); // Empty dependency array to run only on mount

    const position = getCurrentTimePosition();
    
    // Calculate the current day's position in the week view
    const todayIndex = new Date().getDay();
    const columnWidth = `${100 / 7}%`;
    const leftOffset = `${(todayIndex * 100) / 7}%`;
    const isCurrentWeek = viewType === ViewType.WEEK;
    
    return (
      <div 
        className="absolute left-0 right-0 flex items-center pointer-events-none z-50" 
        style={{ 
          top: `${position}px`,
        }}
      >
        <div className="w-[60px] pr-2 flex justify-end">
          <span className="bg-primary text-white text-[10px] rounded px-1.5 py-0.5 font-medium whitespace-nowrap">
            {currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </span>
        </div>
        <div className="flex-1 relative">
          {/* Base line across all days */}
          <div className="absolute inset-0 h-[1px] bg-primary/30" />
          
          {/* Bolder line for current day */}
          {isCurrentWeek && (
            <div 
              className="absolute h-[2px] bg-primary" 
              style={{
                left: leftOffset,
                width: columnWidth,
              }}
            >
              {/* Vertical lines at ends */}
              <div className="absolute left-0 top-[-3px] w-[2px] h-[8px] bg-primary" />
              <div className="absolute right-0 top-[-3px] w-[2px] h-[8px] bg-primary" />
            </div>
          )}
        </div>
      </div>
    );
  };

  const getColumnDate = (columnIndex) => {
    const date = new Date(currentDate);
    date.setDate(currentDate.getDate() - currentDate.getDay() + columnIndex);
    return date;
  };

  const getDayEvents = (date) => {
    const compareDate = new Date(date);
    return events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getFullYear() === compareDate.getFullYear() &&
             eventDate.getMonth() === compareDate.getMonth() &&
             eventDate.getDate() === compareDate.getDate();
    });
  };

  const getMonthDays = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add days from previous month to start on Monday
    const firstDayOfWeek = firstDay.getDay() || 7;
    for (let i = 1; i < firstDayOfWeek; i++) {
      const date = new Date(year, month, 1 - i);
      days.unshift({ date, isCurrentMonth: false });
    }
    
    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  };

  const getNewEventTimes = (moveEvent) => {
    const hourHeight = 64;
    const y = moveEvent.clientY - containerRect.top - offsetY + container.scrollTop;
    const totalMinutes = (y / hourHeight) * 60;
    const roundedMinutes = Math.round(totalMinutes / 15) * 15;
    
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    
    let newTimes;
    if (viewType === ViewType.DAY) {
      // For day view, create a new date while preserving the original date components
      const start = new Date(event.start.getTime());
      start.setHours(hours);
      start.setMinutes(minutes);
      start.setSeconds(0);
      start.setMilliseconds(0);
      
      const end = new Date(event.end.getTime());
      const duration = event.end.getTime() - event.start.getTime();
      end.setTime(start.getTime() + duration);
      
      newTimes = { start, end };
    }

    return newTimes;
  };

  const handleDrop = (e, date) => {
    e.preventDefault();
    try {
      const taskData = JSON.parse(e.dataTransfer.getData('application/json'));
      let dropTime;
      
      if (viewType === ViewType.MONTH) {
        // For month view, default to 9 AM of the dropped date
        dropTime = new Date(date);
        dropTime.setHours(9, 0, 0, 0);
      } else {
        const timeGridRect = e.currentTarget.getBoundingClientRect();
        
        // Calculate vertical position for time
        const dropY = e.clientY - timeGridRect.top;
        const totalMinutes = Math.floor((dropY / timeGridRect.height) * 24 * 60);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (viewType === ViewType.WEEK) {
          // Calculate horizontal position for day in week view
          const dropX = e.clientX - timeGridRect.left;
          const dayWidth = timeGridRect.width;
          const dayIndex = Math.floor((dropX / dayWidth));
          
          // Get the start of the week and add days based on drop position
          const startOfWeek = getStartOfWeek(selectedDate);
          dropTime = addDays(startOfWeek, dayIndex);
        } else {
          // Day view - use the selected date
          dropTime = new Date(date);
        }
        
        dropTime.setHours(
          Math.max(0, Math.min(23, hours)), // Clamp hours between 0-23
          Math.max(0, Math.min(59, minutes)), // Clamp minutes between 0-59
          0,
          0
        );
      }
      
      const newEvent = {
        id: `task-${taskData.id}`,
        title: taskData.title,
        start: dropTime,
        end: new Date(dropTime.getTime() + 60 * 60 * 1000), // 1 hour duration
        color: taskData.tag?.color || colors[Math.floor(Math.random() * colors.length)]
      };

      setEvents(prevEvents => {
        // Remove any existing repeated events with the same base ID
        const nonRepeatedEvents = prevEvents.filter(e => !e.id.includes(newEvent.id));

        // Generate repeated events if repeat option is set
        let allEvents;
        if (newEvent.repeat && newEvent.repeat !== 'none') {
          const repeatedEvents = generateRepeatedEvents(newEvent, newEvent.repeat);
          allEvents = [...nonRepeatedEvents, ...repeatedEvents];
        } else {
          allEvents = [...nonRepeatedEvents, newEvent];
        }

        // Save to localStorage
        localStorage.setItem('calendarEvents', JSON.stringify(allEvents));
        return allEvents;
      });

      setDragState(prevState => {
        const currentPreview = prevState.dropPreview;
        if (!currentPreview) return prevState;

        const snapToInterval = (date) => {
          const minutes = date.getMinutes();
          const snappedMinutes = Math.round(minutes / 15) * 15;
          const newDate = new Date(date);
          newDate.setMinutes(snappedMinutes);
          return newDate;
        };

        const isReverse = currentPreview.end < currentPreview.start;
        const snappedStart = snapToInterval(isReverse ? currentPreview.end : currentPreview.start);
        const snappedEnd = snapToInterval(isReverse ? currentPreview.start : currentPreview.end);

        // Only open command bar if we're not dragging an existing event
        if (!prevState.eventId) {
          commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
        }

        const newState = {
          ...prevState,
          isDragging: false,
          isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
          dropPreview: {
            start: snappedStart,
            end: snappedEnd
          }
        };
        console.log('handleUp: new drag state', newState);
        return newState;
      });

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleUp = () => {
    console.log('handleUp: previous drag state', dragState);
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleUp);

    setDragState(prevState => {
      const currentPreview = prevState.dropPreview;
      if (!currentPreview) return prevState;

      const snapToInterval = (date) => {
        const minutes = date.getMinutes();
        const snappedMinutes = Math.round(minutes / 15) * 15;
        const newDate = new Date(date);
        newDate.setMinutes(snappedMinutes);
        return newDate;
      };

      const isReverse = currentPreview.end < currentPreview.start;
      const snappedStart = snapToInterval(isReverse ? currentPreview.end : currentPreview.start);
      const snappedEnd = snapToInterval(isReverse ? currentPreview.start : currentPreview.end);

      // Only open command bar if we're not dragging an existing event
      if (!prevState.eventId) {
        commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
      }

      const newState = {
        ...prevState,
        isDragging: false,
        isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
        dropPreview: {
          start: snappedStart,
          end: snappedEnd
        }
      };
      console.log('handleUp: new drag state', newState);
      return newState;
    });

    // Reset click state after drag operation
    setClickState({
      lastClickTime: 0,
      lastClickPosition: null,
      clickCount: 0,
    });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu.show && contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setContextMenu({ show: false, x: 0, y: 0, eventId: null });
      }
    };

    if (contextMenu.show) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu.show]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isViewDropdownOpen && viewDropdownRef.current && !viewDropdownRef.current.contains(event.target)) {
        setIsViewDropdownOpen(false);
      }
    };

    if (isViewDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  const handleSaveEvent = (eventData) => {
    const { title, start, end, repeat } = eventData;
    const newEvent = {
      id: crypto.randomUUID(),
      title,
      start: new Date(start),
      end: new Date(end),
      repeat: repeat || 'none'
    };
    
    setEvents(prevEvents => {
      let newEvents = [];
      if (newEvent.repeat && newEvent.repeat !== 'none') {
        // Generate repeated events for a repeat series
        const repeatedEvents = generateRepeatedEvents(newEvent, newEvent.repeat);
        newEvents = [...prevEvents, ...repeatedEvents];
      } else {
        newEvents = [...prevEvents, newEvent];
      }
      
      localStorage.setItem('calendarEvents', JSON.stringify(newEvents));
      return newEvents;
    });

    setModalState({
      isOpen: false,
      startTime: null,
      endTime: null
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar commandBarRef={commandBarRef} events={events} selectedDate={selectedDate} onDateSelect={onDateSelect} />
      <div className="flex-1 flex flex-col h-full bg-light-bg-light dark:bg-dark-bg-light">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex w-full justify-between items-center gap-4">
          <div className="flex items-baseline">
            <h1 className="text-xl text-light-text dark:text-dark-text font-semibold">
              {selectedDate.toLocaleString('en-US', { month: 'long' })}
            </h1>
            <span className="text-xl font-regular text-light-text/50 dark:text-dark-text/50 ml-2">
              {selectedDate.getFullYear()}
            </span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <div className="relative">
              <div 
                className="flex items-center gap-2 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md"
                onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
              >
                <span className="text-xs font-medium text-light-text dark:text-dark-text">
                  {viewType === ViewType.DAY ? 'Day' : viewType === ViewType.WEEK ? 'Week' : 'Month'}
                </span>
                <svg className={`w-4 h-4 text-light-text/50 dark:text-dark-text/50 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none">
                  <path d="M19 9l-7 7-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {isViewDropdownOpen && (
                <div 
                  ref={viewDropdownRef}
                  className="absolute top-full right-0 mt-1 bg-dark-bg-lighter dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border flex flex-col rounded-[9px] gap-1 shadow-lg p-1 min-w-[120px] z-50"
                >
                {Object.values(ViewType).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setViewType(type);
                      setIsViewDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1 text-xs rounded-[5px] font-medium flex items-center justify-between ${
                      viewType === type 
                        ? 'text-dark-text text-xs font-semibold dark:text-dark-text hover:bg-white/15 dark:hover:bg-white/5' 
                        : 'text-dark-text/50 text-xs dark:text-dark-text/50 hover:bg-white/15 hover:text-dark-text dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    <span className="text-dark-text/50 dark:text-dark-text/50 text-[10px] border h-[20px] w-[20px] rounded-[5px] flex items-center justify-center border-dark-border dark:border-dark-border">
                      {type.charAt(0).toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar views */}
      {viewType === ViewType.WEEK && renderWeekView()}
      {viewType === ViewType.DAY && renderDayView()}
      {viewType === ViewType.MONTH && renderMonthView()}
      
      {/* Context menu */}
      {contextMenu.show && (
        <div
          ref={contextMenuRef}
          className="fixed bg-dark-bg-lighter dark:bg-dark-bg-lighter shadow-lg rounded-[9px] overflow-hidden z-50 border border-light-border dark:border-dark-border w-[280px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="">
            
            <div className="flex flex-wrap gap-2 pb-2 p-3">
              {colors.map(color => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.05 }}
                  className="w-5 h-5 rounded-md hover:ring-1 hover:ring-offset-1 hover:ring-light-border hover:dark:ring-dark-border transition-all"
                  style={{ backgroundColor: color }}
                  onClick={(e) => handleColorSelect(e, color)}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ))}
            </div>
            <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
            <div className="p-1">
              <button
                className="w-full group text-left px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                onClick={(e) => handleEventDelete(e)}
                onMouseDown={(e) => e.stopPropagation()}
              >
              <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white  group-hover:dark:text-white group-hover:dark:text-white" />

                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteEventModal
        isOpen={deleteModalState.isOpen}
        eventTitle={deleteModalState.event?.title}
        onClose={handleDeleteModalClose}
        onDelete={handleDeleteConfirm}
      />
      <CommandBar
        ref={commandBarRef}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        onClose={handleCommandBarClose}
        onCreateTask={(task) => {
          // Store the task in localStorage
          const savedTasks = localStorage.getItem('tasks') || '{}';
          const tasks = JSON.parse(savedTasks);
          
          // Add task to its tag group and the 'all' group
          const tagGroup = task.tag ? task.tag.id : 'all';
          const updatedTasks = {
            ...tasks,
            [tagGroup]: [...(tasks[tagGroup] || []), task],
            all: [...(tasks.all || []), task]
          };
          
          // Save back to localStorage
          localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        }}
        onUpdateTask={(task) => {
          // Get current tasks from localStorage
          const savedTasks = localStorage.getItem('tasks') || '{}';
          const tasks = JSON.parse(savedTasks);
          
          // Remove task from all groups
          const cleanedTasks = Object.keys(tasks).reduce((acc, key) => {
            acc[key] = tasks[key].filter(t => t.id !== task.id);
            return acc;
          }, {});
          
          // Add updated task to its tag group and the 'all' group
          const tagGroup = task.tag ? task.tag.id : 'all';
          const updatedTasks = {
            ...cleanedTasks,
            [tagGroup]: [...(cleanedTasks[tagGroup] || []), task],
            all: [...(cleanedTasks.all || []).filter(t => t.id !== task.id), task]
          };
          
          // Save back to localStorage
          localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        }}
      />
      <GoToDateCommand
        isOpen={isGoToDateOpen}
        onClose={() => setIsGoToDateOpen(false)}
        onDateSelect={onDateSelect}
      />
      </div>
    </div>
  );
}
