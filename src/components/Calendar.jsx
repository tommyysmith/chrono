"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { addDays, getISOWeek } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { 
  DndContext, 
  DragOverlay, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import Sidebar from "./Sidebar";
import DeleteEventModal from "./DeleteEventModal";
import RepeatEditModal from "./RepeatEditModal";
import RepeatTaskEditModal from "./RepeatTaskEditModal";
import DeleteTaskModal from "./DeleteTaskModal";
import CommandBar from "./CommandBar";
import GoToDateCommand from "./GoToDateCommand";
import Settings from "./Settings";
import Day from "./views/Day";
import Week from "./views/Week";
import Month from "./views/Month";
import { TaskDragPreview } from "./TaskItem";
import { TaskEventDragPreview } from "./TaskEventItem";
import { EventDragPreview } from "./EventItem";
import { generateEventId } from "../utils/eventUtils";
import {
  handlePrevious,
  handleNext,
  handleToday,
} from "@/hooks/navHandlers.js";
import { useEventManagement } from "@/hooks/useEventManagement.js";
import { useCalendarInteractions } from "@/hooks/useCalendarInteractions.js";
import { useContextMenu } from "@/hooks/useContextMenu.js";
import { useDragAndDrop } from "@/hooks/useDragAndDrop.js";
import { useEventRendering } from "@/hooks/useEventRendering.js";
import { useModalManagement } from "@/hooks/useModalManagement.js";
import { useTaskManagement } from "@/hooks/useTaskManagement.js";
import { useEventFiltering } from "@/hooks/useEventFiltering.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import {
  getTimeFromMousePosition,
  getColumnFromMousePosition,
} from "@/utils/positionUtils.js";

import { TAG_COLORS } from "../constants/colors";
import { Trash } from "@/assets/icons/Trash";
import { Copy } from "@/assets/icons/Copy";
import { SidebarIcon } from "@/assets/icons/Sidebar";
import { Check } from "@/assets/icons/Check";
import { Pencil } from "lucide-react";
import { Chevron } from "@/assets/icons/Chevron";
import { Shift } from "@/assets/icons/Shift";

// Helper function to get default event color
const getDefaultEventColor = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('defaultEventColor') || '#F59E0B';
  }
  return '#F59E0B';
};

const ViewType = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
};

export default function Calendar({ selectedDate = new Date(), onDateSelect }) {
  const [viewType, setViewType] = useState(ViewType.WEEK);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showTodaysTasks, setShowTodaysTasks] = useState(true);
  const [currentDefaultColor, setCurrentDefaultColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultEventColor') || '#F59E0B';
    }
    return '#F59E0B';
  });
  const colors = TAG_COLORS;
  const commandBarRef = useRef(null);
  const timeGridRef = useRef(null);

  // Task drag state for @dnd-kit
  const [activeTask, setActiveTask] = useState(null);
  const [activeTaskEvent, setActiveTaskEvent] = useState(null);
  const [activeEvent, setActiveEvent] = useState(null);
  const [taskDropPreview, setTaskDropPreview] = useState(null);
  const [isDraggingTask, setIsDraggingTask] = useState(false);
  const [lastDropWasSuccessful, setLastDropWasSuccessful] = useState(false);
  
  // Refs for mouse move handler
  const isDraggingTaskRef = useRef(false);
  const activeTaskRef = useRef(null);
  const selectedDateRef = useRef(selectedDate);
  const viewTypeRef = useRef(viewType);
  
  // Update refs when state changes
  useEffect(() => {
    isDraggingTaskRef.current = isDraggingTask;
  }, [isDraggingTask]);
  
  useEffect(() => {
    activeTaskRef.current = activeTask;
  }, [activeTask]);
  
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);
  
  useEffect(() => {
    viewTypeRef.current = viewType;
  }, [viewType]);

  // Cleanup mouse listener on unmount
  useEffect(() => {
    return () => {
      if (handleMouseMoveRef.currentHandler) {
        document.removeEventListener('mousemove', handleMouseMoveRef.currentHandler);
        handleMouseMoveRef.currentHandler = null;
      }
    };
  }, []);

  // Setup @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Listen for default event color updates
  useEffect(() => {
    const handleDefaultColorUpdate = () => {
      if (typeof window !== 'undefined') {
        setCurrentDefaultColor(localStorage.getItem('defaultEventColor') || '#F59E0B');
      }
    };

    window.addEventListener('default-event-color-updated', handleDefaultColorUpdate);
    return () => window.removeEventListener('default-event-color-updated', handleDefaultColorUpdate);
  }, []);

  // Add keyboard shortcut for sidebar toggle (Shift + S)
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts if user is typing in an input field
      if (event.target.tagName === 'INPUT' || 
          event.target.tagName === 'TEXTAREA' || 
          event.target.isContentEditable ||
          event.target.closest('[contenteditable]')) {
        return;
      }

      // Handle Shift + S for sidebar toggle
      if (event.shiftKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        setIsSidebarVisible(prev => !prev);
        return;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Global click handler to clear task selection when clicking outside
  useEffect(() => {
    const handleGlobalClick = (event) => {
      // Check if the click is on a task item or multi-select toolbar
      const isTaskItem = event.target.closest('[data-task-item]');
      const isMultiSelectToolbar = event.target.closest('[data-multiselect-toolbar]');
      const isCommandBar = event.target.closest('[data-command-bar]');
      
      // If click is outside task items, toolbar, and command bar, clear selection
      if (!isTaskItem && !isMultiSelectToolbar && !isCommandBar) {
        if (commandBarRef.current?.clearSelection) {
          commandBarRef.current.clearSelection();
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  const {
    events,
    setEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDeleteSeriesEvents,
  } = useEventManagement(commandBarRef);

  // Get the event filtering hook
  const { getTaskEventsForView } = useEventFiltering();
  
  // Task update trigger for re-rendering when tasks change
  const [taskUpdateTrigger, setTaskUpdateTrigger] = useState(0);
  
  // Listen for task updates to refresh calendar
  useEffect(() => {
    const handleTaskUpdate = () => {
      setTaskUpdateTrigger(prev => prev + 1);
    };

    window.addEventListener('storage', handleTaskUpdate);
    window.addEventListener('tasksUpdated', handleTaskUpdate);
    window.addEventListener('tasks-updated', handleTaskUpdate);

    return () => {
      window.removeEventListener('storage', handleTaskUpdate);
      window.removeEventListener('tasksUpdated', handleTaskUpdate);
      window.removeEventListener('tasks-updated', handleTaskUpdate);
    };
  }, []);

  const {
    deleteModalState,
    setDeleteModalState,
    repeatEditModalState,
    setRepeatEditModalState,
    isGoToDateOpen,
    setIsGoToDateOpen,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    viewDropdownRef,
    handleDeleteConfirm,
    handleDeleteModalClose,
    handleRepeatEditConfirm,
    handleRepeatEditDiscard,
  } = useModalManagement(setEvents, commandBarRef, handleUpdateEvent, handleDeleteSeriesEvents);

  // Task modal state management
  const [isRepeatTaskEditModalOpen, setIsRepeatTaskEditModalOpen] = useState(false);
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);

  const {
    setClickState,
    pendingEventCell,
    setPendingEventCell,
    handleCellClick,
    handleEventClick,
    handleCommandBarClose,
  } = useCalendarInteractions(commandBarRef, setRepeatEditModalState);

  const {
    contextMenu,
    setContextMenu,
    contextMenuRef,
    handleEventContextMenu,
    handleColorSelect,
    handleEventDelete,
    handleEventDuplicate,
    handleEventEdit,
  } = useContextMenu(
    events,
    setEvents,
    handleDeleteEvent,
    setDeleteModalState,
    commandBarRef,
    setRepeatEditModalState
  );

  const {
    dragState,
    setDragState,
    handleDragStart,
    handleCellDragStart,
    handleResizeStart,
  } = useDragAndDrop({
    events,
    setEvents,
    selectedDate,
    viewType,
    currentDate,
    commandBarRef,
    setRepeatEditModalState,
    setClickState,
    colors,
    handleUpdateEvent,
  });

  // Combine regular events with task events from localStorage, with smart merging
  const displayEvents = useMemo(() => {
    const taskEvents = getTaskEventsForView(selectedDate, viewType, currentDefaultColor);
    
    // Create a map of task IDs to localStorage task events for easy lookup
    const taskEventsByTaskId = new Map();
    taskEvents.forEach(te => {
      const taskId = te.originalTask?.id;
      if (taskId) {
        taskEventsByTaskId.set(taskId, te);
      }
    });
    
    // Process events from the events state
    const processedEvents = events.filter(event => {
      // Keep regular events and drafts as-is
      if (!event.isTaskBlock || event.isDraft) return true;
      
      // For TaskEventItems, check if there's an updated version from localStorage
      const taskId = event.originalTask?.id;
      const localStorageTaskEvent = taskEventsByTaskId.get(taskId);
      
      // If no localStorage version exists, the task was deleted - remove the TaskEventItem
      if (!localStorageTaskEvent) {
        return false;
      }
      
      return true;
    }).map(event => {
      // Keep regular events and drafts as-is
      if (!event.isTaskBlock || event.isDraft) return event;
      
      // For TaskEventItems, check if there's an updated version from localStorage
      const taskId = event.originalTask?.id;
      const localStorageTaskEvent = taskEventsByTaskId.get(taskId);
      
      if (localStorageTaskEvent) {
        // If currently being dragged/resized, preserve the drag state but update task data
        if (dragState.eventId === event.id || dragState.isResizing) {
          return {
            ...event,
            originalTask: localStorageTaskEvent.originalTask, // Update with fresh task data
            title: localStorageTaskEvent.originalTask.title, // Sync title changes
            // Preserve any drag state flags
            _isPreview: event._isPreview,
            _isDragging: event._isDragging,
          };
        }
        
        // If not being manipulated, use localStorage data but preserve positioning if recent drag
        const isRecentDrag = Date.now() - (event.lastDragTime || 0) < 1000; // 1 second grace period
        if (isRecentDrag && event.start && event.end) {
          // Keep the positioned version but update task data
          return {
            ...event,
            originalTask: localStorageTaskEvent.originalTask,
            title: localStorageTaskEvent.originalTask.title,
          };
        }
        
        // Default: replace with localStorage version but keep the original ID
        return {
          ...localStorageTaskEvent,
          id: event.id, // Keep the original ID to maintain references
        };
      }
      
      // This should not happen now since we filter above, but keep as fallback
      return event;
    });
    
    // Add any new TaskEventItems from localStorage that don't exist in events state
    const existingTaskIds = new Set(
      processedEvents
        .filter(event => event.isTaskBlock && event.originalTask?.id)
        .map(event => event.originalTask.id)
    );
    
    const newTaskEvents = taskEvents.filter(te => 
      te.originalTask?.id && !existingTaskIds.has(te.originalTask.id)
    );
    
    return [...processedEvents, ...newTaskEvents];
  }, [events, selectedDate, viewType, currentDefaultColor, getTaskEventsForView, taskUpdateTrigger, dragState.eventId, dragState.isResizing]);

  const eventStyleGetter = useCallback((event, start, end, isSelected) => {
    // For task blocks, return minimal styles to let Tailwind classes handle the styling
    if (event.isTaskBlock) {
      const style = {
        display: 'block'
      };
      
      // Add drag preview styling similar to sidebar drag
      if (event._isPreview || event._isDragging) {
        style.opacity = 0.4;
        style.transform = 'scale(1.02)';
        style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        style.zIndex = 1000;
      }
      
      return { style };
    }

    // Regular events use the existing styling
    const style = {
      backgroundColor: event.color || currentDefaultColor,
      borderRadius: '4px',
      opacity: 1,
      color: '#fff',
      border: 'none',
      display: 'block'
    };

    // Add preview styling
    if (event._isPreview || event._isDragging) {
      style.border = '2px dashed #fff';
      style.opacity = 0.4;
      style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      style.transform = 'scale(1.02)';
      style.zIndex = 1000;
    }

    return {
      style
    };
  }, [currentDefaultColor]);

  const { handleCreateTask, handleUpdateTask, handleToggleTaskCompletion } = useTaskManagement();

  // Handler for task editing that checks for recurring tasks
  const handleTaskEdit = useCallback((task) => {
    const isRecurringTask = task.repeat && task.repeat !== 'none' || task.seriesId || task.isRepeat;
    
    if (isRecurringTask) {
      // For recurring tasks, open the RepeatTaskEditModal
      setTaskToEdit(task);
      setDraggedTask(task);
      setIsRepeatTaskEditModalOpen(true);
    } else {
      // For non-recurring tasks, open command bar directly
      commandBarRef?.current?.openForTaskEdit(task);
    }
  }, [commandBarRef]);

  // Handler for task deletion that checks for recurring tasks
  const handleTaskDelete = useCallback((task) => {
    const isRecurringTask = task.repeat && task.repeat !== 'none' || task.seriesId || task.isRepeat;
    
    if (isRecurringTask) {
      // For recurring tasks, open the DeleteTaskModal
      setTaskToDelete(task);
      setIsDeleteTaskModalOpen(true);
      return true; // Indicate we handled it
    } else {
      // For non-recurring tasks, delete directly (existing logic will be handled by useEventRendering)
      // This will fall back to the default deletion behavior in useEventRendering
      return null; // Let useEventRendering handle it
    }
  }, []);

  const { renderEvents, renderAllDayEvents, TaskContextMenuPopover } = useEventRendering(
    displayEvents,
    selectedDate,
    viewType,
    dragState,
    handleDragStart,
    handleEventClick,
    handleEventContextMenu,
    handleResizeStart,
    eventStyleGetter,
    commandBarRef,
    handleToggleTaskCompletion,
    handleTaskEdit,
    handleTaskDelete
  );
  // Handle date selection from GoToDateCommand
  const handleGoToDate = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      if (onDateSelect) {
        onDateSelect(date);
      }
      setIsGoToDateOpen(false);
    }
  }, [onDateSelect]);

  // Sync with selectedDate prop
  useEffect(() => {
    console.log('Calendar: selectedDate prop changed to:', selectedDate);
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Helper functions for task drag and drop
  const calculateTaskDropPosition = useCallback((event, over) => {
    if (!over?.rect || !timeGridRef.current) {
      return null;
    }

    // For dragOver events, we need to get the current mouse position differently
    let currentMouseX, currentMouseY;
    
    if (event.activatorEvent && event.delta) {
      // This is likely a dragEnd event
      currentMouseX = event.activatorEvent.clientX + event.delta.x;
      currentMouseY = event.activatorEvent.clientY + event.delta.y;
    } else if (event.pointerEvent) {
      // This is likely a dragOver event
      currentMouseX = event.pointerEvent.clientX;
      currentMouseY = event.pointerEvent.clientY;
    } else {
      // Fallback - try to get coordinates from various event properties
      currentMouseX = event.clientX || event.active?.rect?.current?.translated?.left || 0;
      currentMouseY = event.clientY || event.active?.rect?.current?.translated?.top || 0;
    }
    
    // Get the calendar container's position and scroll info
    const calendarContainer = timeGridRef.current;
    const containerRect = calendarContainer.getBoundingClientRect();
    const scrollTop = calendarContainer.scrollTop;
    
    // Calculate position relative to the scrollable content (not just viewport)
    const relativeX = Math.max(0, currentMouseX - containerRect.left);
    const relativeY = Math.max(0, (currentMouseY - containerRect.top) + scrollTop);
    
    // Hour height in calendar (80px per hour)
    const HOUR_HEIGHT = 80;
    const hour = Math.floor(relativeY / HOUR_HEIGHT);
    const minuteProgress = (relativeY % HOUR_HEIGHT) / HOUR_HEIGHT;
    const minutes = Math.floor(minuteProgress * 60);
    
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(minutes / 15) * 15;
    
    // Get default duration from localStorage (default to 60 minutes)
    const defaultDuration = parseInt(localStorage.getItem('defaultEventDuration') || '60');
    
    // Create start time
    const start = new Date(selectedDate);
    start.setHours(Math.max(0, Math.min(23, hour)), snappedMinutes, 0, 0);
    
    // Create end time using default duration
    const end = new Date(start.getTime() + defaultDuration * 60 * 1000);

    // For week view, calculate which day column
    let column = 0;
    if (viewType === ViewType.WEEK) {
      // Calculate which day of the week (0-6)
      const dayWidth = containerRect.width / 7;
      column = Math.floor(relativeX / dayWidth);
      column = Math.max(0, Math.min(6, column)); // Clamp to 0-6
      
      // Adjust date for the correct day of the week
      const weekStart = new Date(selectedDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + column);
      
      // Set the start and end dates to the target day
      start.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      end.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    
    return { start, end, column };
  }, [selectedDate, viewType]);

  const createTaskBlock = useCallback((task, position) => {
    return {
      id: `task-block-${task.id}-${Date.now()}`,
      title: task.title,
      start: position.start,
      end: position.end,
      color: null, // No color - styling handled by eventStyleGetter
      isTaskBlock: true,
      originalTask: task,
      isDraft: false,
    };
  }, []);

  // Real-time mouse tracking for drag preview
  const handleMouseMoveRef = useRef();
  
  handleMouseMoveRef.current = (e) => {
    if (!isDraggingTaskRef.current || (!activeTaskRef.current && !activeTaskEvent && !activeEvent) || !timeGridRef.current) {
      return;
    }

    const calendarContainer = timeGridRef.current;
    const containerRect = calendarContainer.getBoundingClientRect();
    
    // Check if mouse is over the calendar area
    if (e.clientX < containerRect.left || e.clientX > containerRect.right ||
        e.clientY < containerRect.top || e.clientY > containerRect.bottom) {
      setTaskDropPreview(null);
      return;
    }

    const scrollTop = calendarContainer.scrollTop;
    
    // Calculate position relative to the scrollable content
    const relativeX = Math.max(0, e.clientX - containerRect.left);
    const relativeY = Math.max(0, (e.clientY - containerRect.top) + scrollTop);
    
    // Hour height in calendar (80px per hour)
    const HOUR_HEIGHT = 80;
    const hour = Math.floor(relativeY / HOUR_HEIGHT);
    const minuteProgress = (relativeY % HOUR_HEIGHT) / HOUR_HEIGHT;
    const minutes = Math.floor(minuteProgress * 60);
    
    // Snap to 15-minute intervals
    const snappedMinutes = Math.round(minutes / 15) * 15;
    
    // Get duration - preserve original duration for existing items, use default for new tasks
    let durationMinutes;
    const activeItem = activeTaskRef.current || activeTaskEvent || activeEvent;
    
    if (activeTaskEvent) {
      // For TaskEventItems, preserve the original task duration
      const originalDuration = activeTaskEvent.end.getTime() - activeTaskEvent.start.getTime();
      durationMinutes = Math.round(originalDuration / (1000 * 60));
    } else if (activeEvent) {
      // For regular events, preserve the original event duration
      const originalDuration = activeEvent.end.getTime() - activeEvent.start.getTime();
      durationMinutes = Math.round(originalDuration / (1000 * 60));
    } else if (activeTaskRef.current?.duration) {
      // For tasks with specified duration, use that
      durationMinutes = activeTaskRef.current.duration;
    } else {
      // Default duration for new tasks from sidebar
      durationMinutes = parseInt(localStorage.getItem('defaultEventDuration') || '60');
    }
    
    // Create start time
    const start = new Date(selectedDateRef.current);
    start.setHours(Math.max(0, Math.min(23, hour)), snappedMinutes, 0, 0);
    
    // Create end time using preserved or default duration
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // For week view, calculate which day column
    let column = 0;
    if (viewTypeRef.current === ViewType.WEEK) {
      // Get the main grid area width (excluding the 60px time column)
      const timeColumnWidth = 60;
      const gridWidth = containerRect.width - timeColumnWidth;
      const adjustedX = relativeX - timeColumnWidth;
      
      if (adjustedX >= 0) {
        const dayWidth = gridWidth / 7;
        column = Math.floor(adjustedX / dayWidth);
        column = Math.max(0, Math.min(6, column)); // Clamp to 0-6
        
        // Adjust date for the correct day of the week
        const weekStart = new Date(selectedDateRef.current);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const targetDate = new Date(weekStart);
        targetDate.setDate(weekStart.getDate() + column);
        
        // Set the start and end dates to the target day
        start.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        end.setFullYear(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      }
    }
    
    setTaskDropPreview({
      start,
      end,
      column,
      task: activeTaskRef.current || activeTaskEvent || activeEvent
    });
  };



  // @dnd-kit drag handlers for tasks, task events, and regular events
  const handleTaskDragStart = useCallback((event) => {
    const { active } = event;
    if (active.data.current?.type === 'task') {
      setActiveTask(active.data.current.task);
      setIsDraggingTask(true);
      
      // Add mouse move listener for real-time tracking using ref
      const mouseMoveHandler = (e) => handleMouseMoveRef.current(e);
      document.addEventListener('mousemove', mouseMoveHandler);
      
      // Store the handler so we can remove it later
      handleMouseMoveRef.currentHandler = mouseMoveHandler;
    } else if (active.data.current?.type === 'task-event') {
      setActiveTaskEvent(active.data.current.event);
      setIsDraggingTask(true);
      
      // Add mouse move listener for TaskEventItem tracking
      const mouseMoveHandler = (e) => handleMouseMoveRef.current(e);
      document.addEventListener('mousemove', mouseMoveHandler);
      
      // Store the handler so we can remove it later
      handleMouseMoveRef.currentHandler = mouseMoveHandler;
    } else if (active.data.current?.type === 'event') {
      setActiveEvent(active.data.current.event);
      setIsDraggingTask(true);
      
      // Add mouse move listener for regular Event tracking
      const mouseMoveHandler = (e) => handleMouseMoveRef.current(e);
      document.addEventListener('mousemove', mouseMoveHandler);
      
      // Store the handler so we can remove it later
      handleMouseMoveRef.currentHandler = mouseMoveHandler;
    }
  }, []);

  const handleTaskDragEnd = useCallback((event) => {
    const { active, over } = event;
    
    // Clean up mouse listener and drag state
    if (handleMouseMoveRef.currentHandler) {
      document.removeEventListener('mousemove', handleMouseMoveRef.currentHandler);
      handleMouseMoveRef.currentHandler = null;
    }
    setIsDraggingTask(false);
    
    // Clear the drop preview
    const preview = taskDropPreview;
    setTaskDropPreview(null);
    
    // Handle different drag types
    if (active.data.current?.type === 'task') {
      // Regular task from sidebar
      const isSuccessfulDrop = over && preview;
      setLastDropWasSuccessful(isSuccessfulDrop);
      
      // Clear activeTask after a brief delay to allow drop animation to complete
      setTimeout(() => {
        setActiveTask(null);
        setLastDropWasSuccessful(false);
      }, isSuccessfulDrop ? 0 : 300);
      
      if (!isSuccessfulDrop) {
        return;
      }

      const task = active.data.current.task;
      
      // Use the preview position (which was calculated in real-time)
      const dropPosition = {
        start: preview.start,
        end: preview.end,
        column: preview.column
      };
      
      // Calculate duration in minutes
      const durationMinutes = Math.round((dropPosition.end.getTime() - dropPosition.start.getTime()) / (1000 * 60));
      
      // Update the original task in localStorage with scheduling information
      const updatedTask = {
        ...task,
        scheduledDate: dropPosition.start.toISOString(),
        duration: durationMinutes,
        addToCalendar: true, // Enable calendar display
        updatedAt: new Date().toISOString()
      };
      
      // Handle recurring tasks by updating the specific instance
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      // Update the task in localStorage for bi-directional synchronization
      handleUpdateTask(updatedTask);
      
      // Create visual task block for immediate feedback during drag operations
      const taskBlock = createTaskBlock(updatedTask, dropPosition);
      
      // Add to events state for immediate visual feedback
      setEvents(prev => [...prev, taskBlock]);
      
      // Ensure sidebar updates are triggered
      setTimeout(() => {
        const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
        window.dispatchEvent(new CustomEvent('tasks-updated', { detail: tasks }));
        window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { tasks } }));
      }, 0);
      
    } else if (active.data.current?.type === 'task-event') {
      // TaskEventItem being moved
      const isSuccessfulDrop = over && preview;
      setLastDropWasSuccessful(isSuccessfulDrop);
      
      // Clear activeTaskEvent after a brief delay
      setTimeout(() => {
        setActiveTaskEvent(null);
        setLastDropWasSuccessful(false);
      }, isSuccessfulDrop ? 0 : 300);
      
      if (!isSuccessfulDrop) {
        return;
      }

      const taskEvent = active.data.current.event;
      const originalTask = active.data.current.originalTask;
      
      // Use the preview position for rescheduling
      const dropPosition = {
        start: preview.start,
        end: preview.end,
        column: preview.column
      };
      
      // Calculate duration in minutes (preserve original duration if possible)
      const originalDuration = taskEvent.end.getTime() - taskEvent.start.getTime();
      const durationMinutes = Math.round(originalDuration / (1000 * 60));
      
      // Create the updated TaskEventItem with new position
      const updatedTaskEventItem = {
        ...taskEvent,
        start: dropPosition.start,
        end: new Date(dropPosition.start.getTime() + originalDuration),
        lastDragTime: Date.now(),
        _isDragging: true,
      };
      
      // Check if this is a recurring task
      const isRecurringTask = originalTask.isRepeat === true || 
                             (originalTask.repeat && originalTask.repeat !== 'none') ||
                             originalTask.seriesId;
      
      if (isRecurringTask) {
        // For recurring tasks, show the RepeatTaskEditModal or handle via task system
        // Update the original task data to include scheduling information
        const updatedTask = {
          ...originalTask,
          scheduledDate: dropPosition.start.toISOString(),
          duration: durationMinutes,
          addToCalendar: true,
          updatedAt: new Date().toISOString(),
          _editScope: 'single' // Default to single for task drag operations
        };
        
        // Update the task in localStorage with single edit scope
        handleUpdateTask(updatedTask);
        
        // Update the TaskEventItem in events state immediately
        setEvents(prev => prev.map(e => {
          if (e.id === taskEvent.id) {
            return {
              ...updatedTaskEventItem,
              originalTask: updatedTask,
              title: updatedTask.title,
            };
          }
          return e;
        }));
      } else {
        // For non-recurring tasks, update directly
        const updatedTask = {
          ...originalTask,
          scheduledDate: dropPosition.start.toISOString(),
          duration: durationMinutes,
          addToCalendar: true,
          updatedAt: new Date().toISOString()
        };
        
        // Update the task in localStorage
        handleUpdateTask(updatedTask);
        
        // Update the TaskEventItem in events state immediately
        setEvents(prev => prev.map(e => {
          if (e.id === taskEvent.id) {
            return {
              ...updatedTaskEventItem,
              originalTask: updatedTask,
              title: updatedTask.title,
            };
          }
          return e;
        }));
      }
      
      // Ensure sidebar updates are triggered
      setTimeout(() => {
        const tasks = JSON.parse(localStorage.getItem('tasks') || '{}');
        window.dispatchEvent(new CustomEvent('tasks-updated', { detail: tasks }));
        window.dispatchEvent(new CustomEvent('tasksUpdated', { detail: { tasks } }));
      }, 0);
      
    } else if (active.data.current?.type === 'event') {
      // Regular event being moved
      const isSuccessfulDrop = over && preview;
      setLastDropWasSuccessful(isSuccessfulDrop);
      
      // Clear activeEvent after a brief delay
      setTimeout(() => {
        setActiveEvent(null);
        setLastDropWasSuccessful(false);
      }, isSuccessfulDrop ? 0 : 300);
      
      if (!isSuccessfulDrop) {
        return;
      }

      const eventToMove = active.data.current.event;
      
      // Use the preview position for rescheduling
      const dropPosition = {
        start: preview.start,
        end: preview.end,
        column: preview.column
      };
      
      // Calculate duration in minutes (preserve original duration)
      const originalDuration = eventToMove.end.getTime() - eventToMove.start.getTime();
      
      // Create the dragged event with new position
      const draggedEvent = {
        ...eventToMove,
        start: dropPosition.start,
        end: new Date(dropPosition.start.getTime() + originalDuration),
        _isDragging: true,
        lastDragTime: Date.now(),
      };
      
      // Check if this is a recurring event
      const isRecurringEvent = eventToMove.seriesId || 
                              (eventToMove.repeat && eventToMove.repeat !== "none") || 
                              eventToMove.rruleOptions;
      
      if (isRecurringEvent) {
        // For recurring events, show the RepeatEditModal
        setRepeatEditModalState({
          isOpen: true,
          originalEvent: eventToMove,
          draggedEvent: draggedEvent,
          eventTitle: eventToMove.title,
          event: draggedEvent,
          isEditOperation: false
        });
      } else {
        // For non-recurring events, update directly
        setEvents(prev => prev.map(e => {
          if (e.id === eventToMove.id) {
            return draggedEvent;
          }
          return e;
        }));
      }
    }
  }, [setEvents, createTaskBlock, taskDropPreview, handleUpdateTask]);

  const renderHeader = () => {
    const dateFormat = { month: "long", year: "numeric" };
    if (viewType === ViewType.DAY) {
      dateFormat.weekday = "long";
      dateFormat.day = "numeric";
    }

    return (

      <div className={`flex items-center justify-between px-4 pt-4 pb-2`}>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <h1 className={`text-xl font-semibold`}>
              {selectedDate.toLocaleString("en-US", { month: "long" })}
            </h1>
            <span className="text-xl font-regular text-light-text/50 dark:text-dark-text/50 ml-1">
              {selectedDate.getFullYear()}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          {/* View selector moved to the top header */}
        </div>
      </div>
    );
  };

  const handleDrop = (e, date) => {
    e.preventDefault();
    try {
      const taskData = JSON.parse(e.dataTransfer.getData("application/json"));
      let dropTime;

      if (viewType === ViewType.MONTH) {
        // For month view, default to 9 AM of the dropped date
        dropTime = new Date(date);
        dropTime.setHours(9, 0, 0, 0);
      } else {
        const timeGridRect = e.currentTarget.getBoundingClientRect();

        // Calculate vertical position for time
        const dropY = e.clientY - timeGridRect.top;
        const totalMinutes = Math.floor(
          (dropY / timeGridRect.height) * 24 * 60
        );
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (viewType === ViewType.WEEK) {
          // Calculate horizontal position for day in week view
          const dropX = e.clientX - timeGridRect.left;
          const dayWidth = timeGridRect.width;
          const dayIndex = Math.floor(dropX / dayWidth);

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
        color:
          taskData.tag?.color ||
          currentDefaultColor,
      };

      setEvents((prevEvents) => {
        // Remove any existing repeated events with the same base ID
        const nonRepeatedEvents = prevEvents.filter(
          (e) => !e.id.includes(newEvent.id)
        );

        // Generate repeated events if repeat option is set
        let allEvents;
        if (newEvent.repeat && newEvent.repeat !== "none") {
          const repeatedEvents = generateRepeatedEvents(
            newEvent,
            newEvent.repeat
          );
          allEvents = [...nonRepeatedEvents, ...repeatedEvents];
        } else {
          allEvents = [...nonRepeatedEvents, newEvent];
        }

        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(allEvents.filter(event => !event.isDraft)));
        return allEvents;
      });

      setDragState((prevState) => {
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
        const snappedStart = snapToInterval(
          isReverse ? currentPreview.end : currentPreview.start
        );
        const snappedEnd = snapToInterval(
          isReverse ? currentPreview.start : currentPreview.end
        );

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
            end: snappedEnd,
          },
        };
        return newState;
      });

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleUp = () => {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);

    setDragState((prevState) => {
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
      const snappedStart = snapToInterval(
        isReverse ? currentPreview.end : currentPreview.start
      );
      const snappedEnd = snapToInterval(
        isReverse ? currentPreview.start : currentPreview.end
      );

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
          end: snappedEnd,
        },
      };
      return newState;
    });

    // Reset click state after drag operation
    setClickState({
      lastClickTime: 0,
      lastClickPosition: null,
      clickCount: 0,
    });
  };

  // Context menu is now handled by the popover component

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isViewDropdownOpen &&
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(event.target)
      ) {
        setIsViewDropdownOpen(false);
      }
    };

    if (isViewDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  const mainContentVariants = {
    normal: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "easeInOut",
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    settingsOpen: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "easeInOut",
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleTaskDragStart}
      onDragEnd={handleTaskDragEnd}
    >
      <motion.div 
        className="flex flex-col h-full relative isolate"
        variants={mainContentVariants}
        animate={isSettingsOpen ? "settingsOpen" : "normal"}
      >
      {/* Full-width header */}
      <div className='w-full h-14 bg-light-bg-light dark:bg-dark-bg flex items-center justify-between px-3'>
      
        <div className="flex items-center">
        <div className="flex flex-row gap-2 justify-start">
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <motion.div 
                className="flex items-center mr-4"
                animate={{
                  width: isSidebarVisible ? 228 : 'auto',
                  minWidth: isSidebarVisible ? 228 : 'auto'
                }}
                transition={{
                  type: "easeInOut",
                  duration: 0.2,
                  ease: [0.25, 1, 0.5, 1],
                }}
                style={{ willChange: 'width' }}
              >
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  className="flex group w-[32px] h-[32px] items-center justify-center rounded-[7px] hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter transition-colors"
                >
                  <SidebarIcon className="w-5 h-5 text-light-text dark:text-dark-text" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start"><div className="flex flex-row items-center gap-2"><span>{isSidebarVisible ? 'Close sidebar' : 'Open sidebar'}</span> <span className="bg-white/5 flex flex-row items-center justify-center gap-1 text-[9px] rounded-[5px] px-1 border border-dark-border text-dark-text/50"><Shift className="w-2.5 h-2.5" /> S </span></div></TooltipContent>

             
              </motion.div>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center">
            <h1 className={`text-sm font-semibold`}>
              {selectedDate.toLocaleString("en-US", { month: "long" })}
            </h1>
            <span className="text-sm font-regular text-light-text/50 dark:text-dark-text/50 ml-1">
              {selectedDate.getFullYear()}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-1 bg-light-bg-lighter dark:bg-white/5 rounded-[5px] font-regular text-light-text/50 dark:text-dark-text/50 ml-2">
              W{getISOWeek(selectedDate)}
            </span>
          </div>
          </div>
        
        {/* View selector and Avatar */}
        <div className="flex items-center justify-center space-x-3">
          <Popover>
            <PopoverTrigger asChild>
              <motion.div
                whileTap={{scale: 0.98}}
                className="flex items-center gap-2 cursor-pointer flex-row px-2.5 h-[36px] font-medium text-light-text/50 text-sm dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
              >
                <span className="font-medium">
                  {viewType === ViewType.DAY
                    ? "Day"
                    : viewType === ViewType.WEEK
                    ? "Week"
                    : "Month"}
                </span>
                <Chevron className="w-4 h-4 rotate-90" />
              </motion.div>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-1 text-xs min-w-36 bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-lg focus:outline-none focus-visible:outline-none">
              <div className="flex flex-col gap-1">
                {Object.values(ViewType).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setViewType(type);
                    }}
                    className={`w-full rounded text-left px-1 py-1 text-xs font-medium flex items-center justify-between focus:outline-none focus-visible:outline-none ${
                      viewType === type
                        ? "text-dark-text text-xs dark:text-dark-text hover:bg-white/15 dark:hover:bg-white/5"
                        : "text-dark-text/50 text-xs dark:text-dark-text/50 hover:bg-white/15 dark:hover:bg-white/5"
                    }`}
                  >
                    <span>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                    <div className="flex items-center gap-2">
                      {viewType === type && (
                        <Check className="w-3 h-3 text-dark-text dark:text-dark-text" />
                      )}
                      <span className="text-dark-text/30 dark:text-dark-text/30 text-[8px] border h-[20px] w-[20px] rounded-[5px] flex items-center justify-center border-light-border-2 dark:border-dark-border">
                        {type.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Avatar Button */}
          
                <motion.button
                whileTap={{scale:0.98}}
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
                >
                  <span className="text-white text-sm font-semibold">TS</span>
                </motion.button>
  
        </div>
      </div>
      
      {/* Main content area with sidebar and calendar views */}
      <div className="flex flex-1 overflow-hidden">
        <TooltipProvider delayDuration={1000}>
        <AnimatePresence initial={false} mode="sync">
        {isSidebarVisible && (
          <motion.div
            initial={{ x: "-100%", width: 0 }}
            animate={{ x: 0, width: 240 }}
            exit={{ x: "-100%", width: 0 }}
            transition={{
              type: "easeInOut",
              duration: 0.2,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="overflow-hidden h-full"
          >
            <div className="w-[240px] h-full">
              <Sidebar
                commandBarRef={commandBarRef}
                events={events}
                selectedDate={selectedDate}
                onDateSelect={(date) => {
                  // Update local state
                  setCurrentDate(date);
                  // Propagate to parent
                  if (onDateSelect) {
                    console.log('Calendar: Propagating date selection to parent:', date);
                    onDateSelect(date);
                  }
                }}
                setIsVisible={setIsSidebarVisible}
                showTodaysTasks={showTodaysTasks}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </TooltipProvider>
      
      <motion.div 
        className="flex-1 flex flex-col h-full bg-light-bg-light dark:bg-dark-bg relative"
        layout
        transition={{
          type: "easeInOut",
          duration: 0.2,
          ease: [0.25, 1, 0.5, 1],
        }}
      >
        {/* Calendar content wrapper */}
        <div className="flex flex-col flex-1 mt-[1px] ml-3 bg-light-bg rounded-tl-[9px] outline outline-[1px] outline-light-border dark:bg-dark-bg-light dark:outline-dark-border shadow-lg ">
          {/* Add header with z-index to ensure it's clickable */}
          
          {/* Calendar views */}
          <div className="flex-1 overflow-hidden flex flex-col relative" style={{ zIndex: 1 }}>
            <div className="absolute inset-0 flex flex-col">
              {viewType === ViewType.WEEK && (
                <Week
                  selectedDate={selectedDate}
                  events={displayEvents}
                  dragState={dragState}
                  pendingEventCell={pendingEventCell}
                  setPendingEventCell={setPendingEventCell}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                  handleCellDragStart={handleCellDragStart}
                  handleCellClick={handleCellClick}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  getTimeFromMousePosition={getTimeFromMousePosition}
                  getColumnFromMousePosition={getColumnFromMousePosition}
                  renderEvents={renderEvents}
                  renderAllDayEvents={renderAllDayEvents}
                  timeGridRef={timeGridRef}
                  commandBarRef={commandBarRef}
                  setEvents={setEvents}
                  taskDropPreview={taskDropPreview}
                />
              )}
              {viewType === ViewType.DAY && (
                <Day
                  selectedDate={selectedDate}
                  events={displayEvents}
                  dragState={dragState}
                  pendingEventCell={pendingEventCell}
                  setPendingEventCell={setPendingEventCell}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                  handleCellDragStart={handleCellDragStart}
                  handleCellClick={handleCellClick}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  getTimeFromMousePosition={getTimeFromMousePosition}
                  getColumnFromMousePosition={getColumnFromMousePosition}
                  renderEvents={renderEvents}
                  renderAllDayEvents={renderAllDayEvents}
                  timeGridRef={timeGridRef}
                  commandBarRef={commandBarRef}
                  setEvents={setEvents}
                  taskDropPreview={taskDropPreview}
                />
              )}
              {viewType === ViewType.MONTH && (
                <Month
                  selectedDate={selectedDate}
                  events={displayEvents}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                  commandBarRef={commandBarRef}
                  setEvents={setEvents}
                />
              )}
            </div>
          </div>
        </div>
        {/* Context menu using Popover */}
        <Popover open={contextMenu.show} onOpenChange={(open) => !open && setContextMenu({ show: false, eventId: null, x: 0, y: 0 })}>
          {/* Empty trigger positioned at the right-click location */}
          <PopoverTrigger asChild>
            <div 
              className="fixed w-0 h-0 overflow-hidden" 
              style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            />
          </PopoverTrigger>
                  <PopoverContent 
          ref={contextMenuRef}
          className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden z-50 outline outline-[1px] outline-dark-border dark:outline-dark-border w-[280px] p-0 focus:outline-none focus-visible:outline-none"
          sideOffset={5}
          align="start"
          side="bottom"
          forceMount
        >
          <div>
            <div className="flex flex-wrap gap-2 pb-2 p-3">
              {colors.map((color) => {
                const eventForMenu = events.find(e => e.id === contextMenu.eventId);
                const isSelected = eventForMenu && eventForMenu.color === color;
                return (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.1 }} 
                    whileTap={{ scale: 0.9 }}
                    className="relative w-5 h-5 rounded-md cursor-pointer flex items-center justify-center focus:outline-none focus-visible:outline-none"
                    style={{ backgroundColor: color }}
                    onClick={(e) => handleColorSelect(e, color)}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {isSelected && (
                      <Check className="w-3 h-3 text-white" /> 
                    )}
                  </motion.button>
                );
              })}
            </div>
            <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
            <div className="p-1">
              <button
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-dark-border-2 transition-all focus:outline-none focus-visible:outline-none"
                onClick={(e) => handleEventDuplicate(e)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Copy className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                Duplicate
              </button>

              <button
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-dark-border-2 transition-all focus:outline-none focus-visible:outline-none"
                onClick={(e) => handleEventEdit(e)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Pencil className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                Edit
              </button>

              <button
                className="w-full group text-left px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white focus:outline-none focus-visible:outline-none"
                onClick={(e) => handleEventDelete(e)}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white  group-hover:dark:text-white group-hover:dark:text-white" />
                Delete
              </button>
            </div>
          </div>
        </PopoverContent>
        </Popover>

        <DeleteEventModal
          isOpen={deleteModalState.isOpen}
          eventTitle={deleteModalState.event?.title}
          onClose={handleDeleteModalClose}
          onDelete={handleDeleteConfirm}
        />
        <RepeatEditModal
          isOpen={repeatEditModalState.isOpen}
          eventTitle={repeatEditModalState.event?.title}
          onClose={handleRepeatEditDiscard}
          onEditConfirm={handleRepeatEditConfirm}
          originalEvent={repeatEditModalState.originalEvent}
          draggedEvent={repeatEditModalState.draggedEvent}
          isEditOperation={repeatEditModalState.isEditOperation}
          commandBarRef={commandBarRef}
        />
        
        {/* Task Modals */}
        <RepeatTaskEditModal
          isOpen={isRepeatTaskEditModalOpen}
          taskTitle={taskToEdit?.title}
          onClose={() => {
            setIsRepeatTaskEditModalOpen(false);
            setTaskToEdit(null);
            setDraggedTask(null);
          }}
          onEditConfirm={({ scope, task }) => {
            // Handle the edit confirmation based on scope
            if (scope === 'single') {
              // For single instance edits, prepare the task for detachment but don't process yet
              const taskForEdit = {
                ...task,
                _detachedTask: true,
                _editScope: 'single',
                _originalTask: taskToEdit
              };
              
              // Open CommandBar for editing - detachment will occur on save
              commandBarRef.current.openForTaskEdit(taskForEdit);
            } else {
              // Edit the series (future or all) - pass the task with scope information
              const taskForEdit = {
                ...taskToEdit,
                _editScope: scope,
                _updateSeries: scope === 'all',
                _originalTask: taskToEdit
              };
              
              commandBarRef.current.openForTaskEdit(taskForEdit);
            }
            
            // Close the modal
            setIsRepeatTaskEditModalOpen(false);
            setTaskToEdit(null);
            setDraggedTask(null);
          }}
          originalTask={taskToEdit}
          draggedTask={draggedTask}
          isEditOperation={true}
          commandBarRef={commandBarRef}
        />
        
        <DeleteTaskModal
          isOpen={isDeleteTaskModalOpen}
          taskTitle={taskToDelete?.title}
          onClose={() => {
            setIsDeleteTaskModalOpen(false);
            setTaskToDelete(null);
          }}
          onDelete={(scope) => {
            // Handle task deletion with scope
            handleUpdateTask({ ...taskToDelete, _deleteScope: scope });
            setIsDeleteTaskModalOpen(false);
            setTaskToDelete(null);
          }}
        />
        <GoToDateCommand
          isOpen={isGoToDateOpen}
          onClose={() => setIsGoToDateOpen(false)}
          onDateSelect={handleGoToDate}
        />
      </motion.div>
      <CommandBar
        ref={commandBarRef}
        onCreateEvent={useCallback(handleCreateEvent, [])}
        onUpdateEvent={useCallback(handleUpdateEvent, [])}
        onPrevious={useCallback(
          () => handlePrevious(viewType, currentDate, onDateSelect),
          [viewType, currentDate, onDateSelect]
        )}
        onNext={useCallback(
          () => handleNext(viewType, currentDate, onDateSelect),
          [viewType, currentDate, onDateSelect]
        )}
        onToday={useCallback(() => handleToday(onDateSelect), [onDateSelect])}
        onClose={useCallback(handleCommandBarClose, [])}
        onCreateTask={useCallback((newTask) => handleCreateTask(newTask), [])}
        onUpdateTask={useCallback(
          (updateTask) => handleUpdateTask(updateTask),
          []
        )}
        onToggleTaskCompletion={useCallback(
          (taskId) => handleToggleTaskCompletion(taskId),
          []
        )}
        onDateSelect={useCallback((date) => handleGoToDate(date), [handleGoToDate])}
        onOpenSettings={useCallback(() => setIsSettingsOpen(true), [])}
        isDraggingTask={isDraggingTask}
      />
      {TaskContextMenuPopover && <TaskContextMenuPopover />}
      
      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <Settings 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)}
            showTodaysTasks={showTodaysTasks}
            setShowTodaysTasks={setShowTodaysTasks}
          />
        )}
      </AnimatePresence>
      </div>
      
      {/* DragOverlay for task dragging - hidden to show only opacity version */}
      <DragOverlay
        dropAnimation={lastDropWasSuccessful ? {
          duration: 0, // Immediate disappear on successful drop
          easing: 'ease-out',
        } : {
          duration: 300, // Normal animation back to original position on failed drop
          easing: 'ease-out',
        }}
      >
        {/* Hide drag previews to show only the opacity version of the original item */}
        {/* {activeTask && <TaskDragPreview task={activeTask} />} */}
        {/* {activeTaskEvent && <TaskEventDragPreview event={activeTaskEvent} />} */}
        {/* {activeEvent && <EventDragPreview event={activeEvent} />} */}
      </DragOverlay>
    </motion.div>
    </DndContext>
  );
}
