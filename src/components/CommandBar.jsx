'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { format, addHours, parse, isToday, isTomorrow, isYesterday, getDate } from 'date-fns';
import { TAG_COLORS } from '../constants/colors';
import { Clock } from '../assets/icons/Clock';
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';
import { User } from '../assets/icons/User';
import { Pin } from '../assets/icons/Pin';
import { Repeat } from '../assets/icons/Repeat';
import { Add } from '../assets/icons/Add';
import { Chevron } from '../assets/icons/Chevron';
import { Microphone } from '../assets/icons/Microphone';
import { Calendar } from '@/components/ui/calendar';
import { Task } from '../assets/icons/Task';
import { Tag } from '../assets/icons/Tag';
import { ArrowAlt } from '../assets/icons/ArrowAlt';
import RepeatEditModal from './RepeatEditModal';
import GoToDateCommand from './GoToDateCommand';
import { parseNaturalLanguage } from '../utils/dateUtils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const SCHEDULE_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'nextWeek', label: 'Next Week' },
  { id: 'custom', label: 'Pick a date...' }
];

const REPEAT_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekday', label: 'Every weekday', sublabel: 'Mon – Fri' },
  { id: 'weekly', label: 'Every week', sublabel: 'on Mon' },
  { id: 'biweekly', label: 'Every 2 weeks', sublabel: 'on Mon' },
  { id: 'monthly', label: 'Every month', sublabel: 'on the 30th' },
  { id: 'monthlyWeekday', label: 'Every month', sublabel: 'on the 5th Mon' },
  { id: 'monthlyLastWeekday', label: 'Every month', sublabel: 'on the last Mon' },
  { id: 'yearly', label: 'Every year', sublabel: 'on Dec 30' }
];

const CommandBar = ({ onPrevious, onNext, onToday, onCreateEvent, onUpdateEvent, onCreateTask, onUpdateTask, onClose, onDateSelect }, ref) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleOption, setScheduleOption] = useState('today');
  const [isGoToDateMode, setIsGoToDateMode] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const roundToNearest15Min = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const remainder = minutes % 15;
    const roundedMinutes = remainder < 8 ? minutes - remainder : minutes + (15 - remainder);
    const newHours = Math.floor((hours * 60 + roundedMinutes) / 60) % 24;
    const newMinutes = roundedMinutes % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const adjustHour = (timeStr, increment) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newHours = (hours + (increment ? 1 : -1) + 24) % 24;
    return `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const adjustMinutes = (timeStr, increment) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + (increment ? 15 : -15);
    const newHours = Math.floor(totalMinutes / 60) % 24;
    const newMinutes = ((totalMinutes % 60) + 60) % 60;
    return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
  };

  const ensureMinimumGap = (startTime, endTime) => {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    if (endTotalMinutes <= startTotalMinutes + 14) {
      const newEndTotalMinutes = startTotalMinutes + 15;
      const newEndHours = Math.floor(newEndTotalMinutes / 60) % 24;
      const newEndMinutes = newEndTotalMinutes % 60;
      return `${String(newEndHours).padStart(2, '0')}:${String(newEndMinutes).padStart(2, '0')}`;
    }
    
    return endTime;
  };

  const formatDateToNatural = (dateStr) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d');
  };

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [tagSearchText, setTagSearchText] = useState('');
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  // Separate state for editing
  const [draftTag, setDraftTag] = useState(null);
  const [tags, setTags] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTags = localStorage.getItem('tags');
      return savedTags ? JSON.parse(savedTags) : [
        { id: 'work', label: 'Work', color: '#EF4444' },
        { id: 'family', label: 'Family', color: '#3B82F6' },
        { id: 'personal', label: 'Personal', color: '#A855F7' },
        { id: 'travel', label: 'Travel', color: '#22C55E' }
      ];
    }
    return [];
  });

  const dispatchTagsUpdated = useCallback((updatedTags) => {
    const event = new CustomEvent('tags-updated', { detail: updatedTags });
    window.dispatchEvent(event);
  }, []);

  const dispatchTasksUpdated = useCallback((updatedTasks) => {
    const event = new CustomEvent('tasks-updated', { detail: updatedTasks });
    window.dispatchEvent(event);
  }, []);

  // Don't automatically save tags to localStorage
  // Tags will be saved when a task is created or updated
  const [taskNotes, setTaskNotes] = useState('');
  const [originalEventState, setOriginalEventState] = useState(null);
  const [eventState, setEventState] = useState({
    title: '',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    color: '#808080',
    repeat: 'none',
    seriesId: null
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [eventTitle, setEventTitle] = useState('New Event');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [repeatOption, setRepeatOption] = useState('none');
  const [repeatSeriesId, setRepeatSeriesId] = useState(null); // Track series ID
  const [isRepeatDropdownOpen, setIsRepeatDropdownOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#808080');
  const [editMode, setEditMode] = useState(null);
  const [showRepeatEditModal, setShowRepeatEditModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef(null);

  const containerRef = useRef(null);
  const repeatDropdownRef = useRef(null);
  const colorPickerRef = useRef(null);
  const titleInputRef = useRef(null);
  const datePickerRef = useRef(null);

  // Use ref for draft schedule to avoid unnecessary re-renders
  const draftScheduleRef = useRef(null);

  // Modify scheduling handlers to use ref instead of state
  const handleScheduleChange = useCallback((newSchedule) => {
    draftScheduleRef.current = newSchedule;
  }, []);

  const applyScheduleChanges = useCallback(() => {
    if (draftScheduleRef.current) {
      // Clone the schedule data to prevent reference issues when updating
      const scheduleCopy = JSON.parse(JSON.stringify(draftScheduleRef.current));
      onUpdateEvent(scheduleCopy);
      draftScheduleRef.current = null;
    }
  }, [onUpdateEvent]);

  const safelyRunAnimation = useCallback((animationFn, delay = 100) => {
    animationFn();
  }, []);

  const [isExpandingBeforeClosing, setIsExpandingBeforeClosing] = useState(false);
  const previousSizeRef = useRef({ width: 0, height: 0 });
  const exitingRef = useRef(false);
  const prevStateRef = useRef(null);

  useEffect(() => {
    // Capture dimensions when component mounts or state changes
    // This ensures we have accurate dimensions for exit animations
    if (containerRef.current && isOpen) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      previousSizeRef.current = { width, height };
    }
    
    // Track state changes for animation coordination
    const prevState = prevStateRef.current;
    if (prevState && (prevState.isGoToDateMode !== isGoToDateMode || prevState.isAddingEvent !== isAddingEvent || prevState.isAddingTask !== isAddingTask)) {
      setIsAnimating(true);
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
      }, 25); // Short delay to allow animation to start
    }
    prevStateRef.current = {
      isGoToDateMode,
      isAddingEvent,
      isAddingTask
    };
  }, [isOpen, isAddingEvent, isAddingTask, isGoToDateMode]);

  // Fix layout animation state tracking
  useEffect(() => {
    // Reset animation flags when component unmounts
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      exitingRef.current = false;
      setIsAnimating(false);
    };
  }, []);

  const [previewEvent, setPreviewEvent] = useState(null);

  const handleClose = useCallback((options = {}) => {
    const { skipDelete = false, forceClose = false } = options;
    
    setOriginalEventState(null);
    setEventState({
      title: '',
      description: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '10:00',
      isAllDay: false,
      color: '#808080',
      repeat: 'none',
      seriesId: null
    });
    setHasChanges(false);
    setIsAddingEvent(false);
    setIsAddingTask(false);
    setTaskTitle("");
    setSelectedTag(null);
    setPendingNewTag(null);
    setDraftTag(null);
    setTagSearchText('');
    setIsTagDropdownOpen(false);
    setIsRepeatDropdownOpen(false); // Reset repeat dropdown state
    
    onClose();
  }, [onClose]);

  const openForEdit = useCallback((event) => {
    const eventData = {
      title: event.title || '',
      description: event.description || '',
      date: format(event.start, 'yyyy-MM-dd'),
      startTime: format(event.start, 'HH:mm'),
      endTime: format(event.end, 'HH:mm'),
      isAllDay: event.allDay || false,
      color: event.color || '#808080',
      repeat: event.repeat || 'none',
      seriesId: event.seriesId || null,
      id: event.id
    };

    setOriginalEventState(event);
    setEventState(eventData);
    setSelectedColor(event.color || '#808080'); // Add this line to sync the selectedColor state
    setIsAddingEvent(true);
    setHasChanges(false);
    // Set preview event
    setPreviewEvent({
      ...event,
      _isPreview: true // Mark as preview so we can style it differently in the calendar
    });
  }, []);

  const handleEventChange = useCallback((field, value) => {
    setEventState(prev => {
      const newState = { ...prev, [field]: value };
      // Compare with original state to determine if there are changes
      const hasChanges = Object.keys(newState).some(key => 
        newState[key] !== (originalEventState?.[key] || '')
      );
      setHasChanges(hasChanges);
      return newState;
    });
  }, [originalEventState]);

  const handleSaveChanges = useCallback(() => {
    if (!hasChanges) return;

    const eventData = {
      id: originalEventState?.id,
      title: eventState.title.trim(),
      description: eventState.description,
      start: parse(`${eventState.date} ${eventState.startTime}`, 'yyyy-MM-dd HH:mm', new Date()),
      end: parse(`${eventState.date} ${eventState.endTime}`, 'yyyy-MM-dd HH:mm', new Date()),
      allDay: eventState.isAllDay,
      repeat: eventState.repeat,
      seriesId: eventState.seriesId,
      color: eventState.color,
      _editScope: originalEventState?._editScope,
      _seriesUpdate: originalEventState?._seriesUpdate,
      _repeatChanged: !originalEventState?.repeat && eventState.repeat && eventState.repeat !== 'none'
    };

    if (originalEventState?.id) {
      onUpdateEvent(eventData);
    } else {
      onCreateEvent(eventData);
    }

    handleClose({ skipDelete: true });
  }, [originalEventState, eventState, hasChanges, onUpdateEvent, onCreateEvent, handleClose]);

  const openForTaskEdit = useCallback((task) => {
    setIsOpen(true);
    setIsAddingTask(true);
    setIsAddingEvent(false);
    setTaskTitle(task.title || '');
    setTaskNotes(task.notes || '');
    setSelectedTag(task.tag || null);
    setDraftTag(task.tag || null);
    setTagSearchText(''); // Don't set the tag search text when editing
    setScheduledDate(task.scheduledDate ? new Date(task.scheduledDate) : null);
    setEditingTaskId(task.id);
    setTaskToEdit(task);
  }, []);

  useImperativeHandle(ref, () => ({
    openWithDragData: (startTime, endTime, eventId) => {
      const newEventData = {
        title: 'New Event',
        description: '',
        start: startTime,
        end: endTime,
        allDay: false,
        color: '#3B82F6',
        repeat: 'none'
      };

      const createdEvent = eventId ? null : onCreateEvent(newEventData);
      
      const eventState = {
        title: 'New Event',
        description: '',
        date: format(startTime, 'yyyy-MM-dd'),
        startTime: format(startTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        color: '#3B82F6',
        repeat: 'none',
        seriesId: null,
        id: eventId || createdEvent?.id
      };

      setOriginalEventState(eventId ? { ...newEventData, id: eventId } : createdEvent);
      setEventState(eventState);
      setIsAddingEvent(true);
      setHasChanges(false);
    },
    openWithTime: (date) => {
      const roundedTimeStr = roundToNearest15Min(format(date, 'HH:mm'));
      const roundedTime = parse(roundedTimeStr, 'HH:mm', date);
      const endTime = new Date(roundedTime.getTime() + 60 * 60 * 1000);
      const newEventData = {
        title: 'New Event',
        description: '',
        start: roundedTime,
        end: endTime,
        allDay: false,
        color: '#3B82F6',
        repeat: 'none'
      };

      const createdEvent = onCreateEvent(newEventData);
      
      const eventState = {
        title: 'New Event',
        description: '',
        date: format(roundedTime, 'yyyy-MM-dd'),
        startTime: roundedTimeStr,
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        color: '#3B82F6',
        repeat: 'none',
        seriesId: null,
        id: createdEvent.id
      };

      setOriginalEventState(createdEvent);
      setEventState(eventState);
      setIsAddingEvent(true);
      setHasChanges(false);
    },
    openForEdit,
    openForTaskEdit
  }), [onCreateEvent, openForEdit, openForTaskEdit]);

  const handleGoToDate = useCallback((date) => {
    if (date) {
      // Set animating state before changing modes to prevent layout bugs
      setIsAnimating(true);
      
      // Call the onDateSelect handler directly to set the exact date
      onDateSelect(date);
      
      // Ensure state changes happen after animation completes
      animationTimeoutRef.current = setTimeout(() => {
        setIsGoToDateMode(false);
        setQuery('');
        setSuggestions([]);
        setIsAnimating(false);
      }, 25); // Short delay to allow animation to start
    }
  }, [onDateSelect]);

  const handleQueryChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    const date = parseNaturalLanguage(newQuery);
    if (date) {
      setSuggestions([{
        date,
        label: format(date, 'MMMM d, yyyy')
      }]);
    } else {
      setSuggestions([]);
    }
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (repeatDropdownRef.current && !repeatDropdownRef.current.contains(event.target)) {
        setIsRepeatDropdownOpen(false);
      }
    }

    if (isRepeatDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          setIsRepeatDropdownOpen(false);
        }
      });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleClickOutside);
    };
  }, [isRepeatDropdownOpen]);

  useEffect(() => {
    // Capture dimensions when component mounts or state changes
    // This ensures we have accurate dimensions for exit animations
    if (containerRef.current && isOpen) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      previousSizeRef.current = { width, height };
    }
  }, [isOpen, isAddingEvent, isAddingTask]);

  // Fix layout animation state tracking
  useEffect(() => {
    // Reset animation flags when component unmounts
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      exitingRef.current = false;
      setIsAnimating(false);
    };
  }, []);

  const [pendingNewTag, setPendingNewTag] = useState(null);

  const handleRepeatOptionSelect = useCallback((option) => {
    handleEventChange('repeat', option);
    setIsRepeatDropdownOpen(false);
  }, [handleEventChange]);

  const handleAddEventClick = useCallback(() => {
    const now = new Date();
    const roundedTimeStr = roundToNearest15Min(format(now, 'HH:mm'));
    const roundedTime = parse(roundedTimeStr, 'HH:mm', now);
    const endTime = new Date(roundedTime.getTime() + 60 * 60 * 1000);
    
    const eventState = {
      title: 'New Event',
      description: '',
      date: format(now, 'yyyy-MM-dd'),
      startTime: roundedTimeStr,
      endTime: format(endTime, 'HH:mm'),
      isAllDay: false,
      color: '#3B82F6',
      repeat: 'none',
      seriesId: null
    };

    setOriginalEventState(null);
    setEventState(eventState);
    setIsAddingEvent(true);
    setIsAddingTask(false);
    setHasChanges(false);
  }, []);

  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  const handleSaveTask = useCallback(() => {
    if (!taskTitle.trim()) return;

    // If there's a pending new tag, save it first
    let finalTag = selectedTag;
    if (pendingNewTag) {
      const updatedTags = [...tags, pendingNewTag];
      setTags(updatedTags);
      dispatchTagsUpdated(updatedTags);
      finalTag = pendingNewTag;
    }

    try {
      // Get current tasks from localStorage and ensure basic structure
      const currentTasks = JSON.parse(localStorage.getItem('tasks') || '{}');
      const updatedTasks = {
        all: Array.isArray(currentTasks.all) ? [...currentTasks.all] : [],
        today: Array.isArray(currentTasks.today) ? [...currentTasks.today] : [],
        ...currentTasks
      };
      
      if (editingTaskId) {
        // Update existing task
        const updatedTask = {
          ...taskToEdit,
          id: editingTaskId,
          title: taskTitle.trim(),
          notes: taskNotes.trim(),
          tag: finalTag,
          scheduledDate: scheduledDate?.toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Update in all tasks
        updatedTasks.all = updatedTasks.all.map(t => 
          t.id === editingTaskId ? updatedTask : t
        );

        // Handle today's tasks
        if (scheduledDate && isToday(scheduledDate)) {
          const taskInToday = updatedTasks.today.some(t => t.id === editingTaskId);
          if (taskInToday) {
            updatedTasks.today = updatedTasks.today.map(t => 
              t.id === editingTaskId ? updatedTask : t
            );
          } else {
            updatedTasks.today.push(updatedTask);
          }
        } else {
          updatedTasks.today = updatedTasks.today.filter(t => 
            t.id !== editingTaskId
          );
        }

        // Handle tag collections
        const tagCollections = Object.keys(updatedTasks).filter(key => 
          key !== 'all' && key !== 'today'
        );

        // Remove task from all tag collections first
        tagCollections.forEach(key => {
          if (!Array.isArray(updatedTasks[key])) {
            updatedTasks[key] = [];
          }
          updatedTasks[key] = updatedTasks[key].filter(t => t.id !== editingTaskId);
        });

        // Add task to new tag collection if it exists
        if (finalTag) {
          const tagId = finalTag.id;
          if (!Array.isArray(updatedTasks[tagId])) {
            updatedTasks[tagId] = [];
          }
          // Only add if not already in the collection
          if (!updatedTasks[tagId].some(t => t.id === editingTaskId)) {
            updatedTasks[tagId].push(updatedTask);
          }
        }

        onUpdateTask(updatedTask);
      } else {
        // Create new task
        const newTask = {
          id: Date.now().toString(),
          title: taskTitle.trim(),
          notes: taskNotes.trim(),
          tag: finalTag,
          scheduledDate: scheduledDate?.toISOString(),
          completed: false,
          createdAt: new Date().toISOString()
        };

        // Add to all tasks
        updatedTasks.all.push(newTask);

        // Add to today if scheduled for today
        if (scheduledDate && isToday(scheduledDate)) {
          updatedTasks.today.push(newTask);
        }

        // Add to tag collection if it exists
        if (finalTag) {
          if (!Array.isArray(updatedTasks[finalTag.id])) {
            updatedTasks[finalTag.id] = [];
          }
          updatedTasks[finalTag.id].push(newTask);
        }

        onCreateTask(newTask);
      }

      // Save to localStorage and dispatch event
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
      dispatchTasksUpdated(updatedTasks);

      // Reset form and states
      setTaskTitle('');
      setTaskNotes('');
      setSelectedTag(null);
      setPendingNewTag(null);
      setDraftTag(null);
      setTagSearchText('');
      setScheduledDate(null);
      setIsAddingTask(false);
      setEditingTaskId(null);
      setTaskToEdit(null);
      handleClose();
    } catch (error) {
      console.error('Error saving task:', error);
      // You might want to show an error message to the user here
    }
  }, [taskTitle, taskNotes, selectedTag, pendingNewTag, scheduledDate, tags, editingTaskId, taskToEdit, onCreateTask, onUpdateTask, handleClose, dispatchTagsUpdated]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex justify-center">
      <AnimatePresence mode="wait">
        {(isOpen) && (
          <motion.div 
            key="commandBar-container"
            ref={containerRef}
            layout
            layoutId={`commandBar-container-${isAddingEvent ? 'event' : isAddingTask ? 'task' : isGoToDateMode ? 'go-to-date' : 'default'}`}
            initial={{ 
              opacity: 0,
              scale: 0.95,
              y: 20,
              width: 'auto',
              height: 'auto',
              backgroundColor: "var(--background-color, var(--bg-light, #ffffff))"
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              width: 'auto',
              height: 'auto',
              backgroundColor: "var(--background-color, var(--bg-light, #ffffff))"
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20,
              width: previousSizeRef.current.width || 'auto',
              height: previousSizeRef.current.height || 'auto'
            }}
            style={{

              willChange: "transform, opacity, background-color",
              transformOrigin: "bottom"
            }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              mass: 1,
              opacity: { duration: 0.15 },
              scale: { duration: 0.15 },
              y: { 
                type: "spring",
                stiffness: 500,
                damping: 30
              },
              layout: { 
                duration: 0.3, 
                type: "spring",
                bounce: 0.2,
                // Only use layout animations when not exiting or animating
                ease: exitingRef.current || isAnimating ? "linear" : "easeInOut"
              }
            }}
            className="bg-light-bg dark:!bg-dark-bg-lighter overflow-hidden shadow-lg rounded-[13px] border border-light-border dark:border-dark-border px-4"
          >
            <LayoutGroup id={`commandBar-${isAddingEvent ? 'event' : isAddingTask ? 'task' : isGoToDateMode ? 'go-to-date' : 'default'}`}>
              <motion.div 
                key={`commandBar-content-${isAddingEvent ? 'event' : isAddingTask ? 'task' : isGoToDateMode ? 'go-to-date' : 'default'}`}
                layout 
                layoutId={`commandBar-content-${isAddingEvent ? 'event' : isAddingTask ? 'task' : isGoToDateMode ? 'go-to-date' : 'default'}`}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  duration: 0.3
                }}
                className="flex items-center gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {!isAddingEvent && !isAddingTask && !isGoToDateMode && (
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <motion.button 
                            layout
                        
                            className="flex group py-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50"
                          >
                            <Add className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
                            <span className="text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text font-semibold text-sm">Add new</span>
                          </motion.button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-48 p-1 mb-2 bg-light-bg dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border rounded-[9px] shadow-lg"
                          align="start"
                        >
                          <button
                            onClick={() => {
                              setIsAddingTask(true);
                              setIsOpen(true);
                            }}
                            className="group w-full flex items-center gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
                          >
                            <Task className={`w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text  ${taskTitle.trim() ? 'text-light-text dark:text-dark-text' : 'text-light-text/50 dark:text-dark-text/50'}`}   />
                            <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Task</span>
                          </button>
                          <button
                            onClick={() => {
                              handleAddEventClick();
                              setIsOpen(true);
                            }}
                            className="group w-full flex items-center gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
                          >
                            <CalendarIcon className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 " />
                            <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Event</span>
                          </button>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {!isAddingEvent && !isAddingTask && !isGoToDateMode && (
                    <motion.div 
                      layout
                      key="commandBar-divider"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                  )}

                  {!isAddingEvent && !isAddingTask && !isGoToDateMode && (
                    <motion.div 
                      layout
                      key="commandBar-date-buttons"
                      className="flex items-center py-4 gap-2"
                    >
                      <Chevron
                        className="w-4 h-4 rotate-180 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text cursor-pointer" 
                        onClick={onPrevious}
                      />
                      <span 
                        className="text-light-text/50 select-none dark:text-dark-text/50 hover:text-primary dark:hover:text-primary font-semibold text-sm cursor-pointer"
                        onClick={onToday}
                      >
                        Today
                      </span>
                      <Chevron
                        className="w-4 h-4  text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text cursor-pointer" 
                        onClick={onNext}
                      />
                    </motion.div>
                  )}

                  {!isAddingEvent && !isAddingTask && !isGoToDateMode && (
                    <motion.div 
                      layout
                      key="commandBar-divider-2"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                  )}

                  {!isAddingEvent && !isAddingTask && !isGoToDateMode && (
                    <motion.button 
                      key="commandBar-ask-me"
                      layout
                      onClick={() => {
                        setIsGoToDateMode(true);
                        setQuery('');
                        setSuggestions([]);
                      }}
                      className="group flex py-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors cursor-pointer"
                    >
                      <ArrowAlt className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" fill="none">
                        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </ArrowAlt>
                      <span className="group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 font-semibold text-sm">Go to date</span>
                    </motion.button>
                  )}

                  {isAddingTask && (
                    <motion.div
                      layout
                      key="commandBar-adding-task"
                      transition={{
                        opacity: { duration: 0.2 },
                        filter: { duration: 0.2 },
                        y: { duration: 0.2, ease: 'easeInOut' },
                        layout: { duration: 0.2, ease: 'easeInOut' }
                      }}
                      className="flex flex-col gap-4 min-w-[450px]"
                    >
                      <div className="flex items-start justify-between -mx-4">
                        <div className="flex-1">
                          <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
                            <div className="flex flex-col">
                              <div className="flex px-4 py-4 flex-row border-b border-light-border dark:border-dark-border">
                                <Task
                                  className="w-5 h-5 text-light-text/50 dark:text-dark-text/50 rounded-[5px] mt-[5px]"
                                />
                                <div className="flex-1 flex-col gap-1 px-4">
                                  <input
                                    type="text"
                                    placeholder="Task title"
                                    value={taskTitle}
                                    onChange={(e) => {
                                      setTaskTitle(e.target.value);
                                    }}
                                    className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    placeholder="Add notes"
                                    value={taskNotes}
                                    onChange={(e) => {
                                      setTaskNotes(e.target.value);
                                    }}
                                    className="w-full bg-transparent text-light-text/50 dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-4 border-b h-[56px] border-light-border dark:border-dark-border cursor-pointer">
                              <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                                <PopoverTrigger asChild>
                                <div className="flex items-center w-full gap-2">
                                  <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                                  <span className="text-light-text/50 dark:text-dark-text/50 text-sm">{scheduledDate ? format(scheduledDate, 'MMM d') : 'Schedule'}</span>
                                </div>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-[240px] text-dark-text dark:text-dark-text p-1 ml-8 mb-8 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg shadow-lg border border-light-border dark:border-dark-border" 
                                  align="start"
                                >
                                  <div 
                                    className="flex flex-col gap-1" 
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {SCHEDULE_OPTIONS.map(option => (
                                      <button
                                        key={`schedule-option-${option.id}`}
                                        className="flex items-center gap-2 px-2 py-2 text-xs rounded-[5px] hover:bg-white/15 dark:hover:bg-white/5"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (option.id === 'custom') {
                                            setIsDatePickerOpen(true);
                                            setIsScheduleOpen(false);
                                          } else {
                                            const date = new Date();
                                            if (option.id === 'tomorrow') {
                                              date.setDate(date.getDate() + 1);
                                            } else if (option.id === 'nextWeek') {
                                              date.setDate(date.getDate() + 7);
                                            }
                                            setScheduledDate(date);
                                            setIsScheduleOpen(false);
                                          }
                                        }}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                  <div className="absolute w-0 h-0 overflow-hidden" />
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-auto ml-4 mt-3 p-0 rounded-[9px] bg-dark-bg-lighter dark:bg-dark border border-light-border dark:border-dark-border shadow-lg"
                                  align="start"
                                >
                                  <div
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Calendar
                                      mode="single"
                                      selected={scheduledDate}
                                      onSelect={(date) => {
                                        setScheduledDate(date);
                                        setIsDatePickerOpen(false);
                                      }}
                                      initialFocus
                                    />
                                  </div>
                                </PopoverContent>
                              </Popover>
                              </div>
                              <div className="flex items-center gap-2 px-4 py-4 border-b h-[56px] border-light-border dark:border-dark-border">
                                <Tag className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                                <div className="relative flex-1">
                                  <div className="flex items-center gap-1 py-1">
                                    {draftTag ? (
                                      <span 
                                        className="inline-flex items-center gap-1 px-3 py-1 rounded-[5px] text-sm"
                                        style={{ backgroundColor: `${draftTag.color}26` }}
                                      >
                                        {draftTag.label}
                                      </span>
                                    ) : null}
                                    <input
                                      type="text"
                                      placeholder={draftTag ? '' : 'Add a tag'}
                                      className="flex-1 bg-transparent text-light-text height-[56px] dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                                      onFocus={() => setIsTagDropdownOpen(true)}
                                      value={tagSearchText}
                                      onChange={(e) => {
                                        if (!e.target.value) {
                                          setSelectedTag(null);
                                          setDraftTag(null);
                                        }
                                        setTagSearchText(e.target.value);
                                        setIsTagDropdownOpen(true);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && draftTag && !tagSearchText) {
                                          e.preventDefault();
                                          setDraftTag(null);
                                          setSelectedTag(null);
                                          setPendingNewTag(null);
                                          setTagSearchText('');
                                          return;
                                        }
                                        if (e.key === 'Enter' && tagSearchText && !tags.find(t => t.label.toLowerCase() === tagSearchText.toLowerCase())) {
                                          e.preventDefault();
                                          const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
                                          const newTag = {
                                            id: tagSearchText.toLowerCase().replace(/\s+/g, '-'),
                                            label: tagSearchText,
                                            color: randomColor
                                          };
                                          setPendingNewTag(newTag);
                                          setSelectedTag(newTag);
                                          setDraftTag(newTag);
                                          setTagSearchText(newTag.label);
                                          setIsTagDropdownOpen(false);
                                        }
                                      }}
                                    />
                                  {isTagDropdownOpen && tagSearchText.length > 0 && (
                                    <div className="absolute left-0 z-50 right-0 max-w-[240px] backdrop-blur-lg p-1 top-full mt-1 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] border border-light-border dark:border-dark-border shadow-lg overflow-hidden">
                                      {tags
                                        .filter(tag => tag.label.toLowerCase().includes(tagSearchText.toLowerCase()))
                                        .map(tag => (
                                          <button
                                            key={`tag-option-${tag.id}`}
                                            className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-white/15 dark:hover:bg-white/5 rounded-[5px]"
                                            onClick={() => {
                                              setSelectedTag(tag);
                                              setDraftTag(tag);
                                              setTagSearchText('');
                                              setIsTagDropdownOpen(false);
                                            }}
                                          >
                                            <Tag className="w-4 h-4" style={{ color: tag.color }} />
                                            <span className="text-dark-text dark:text-dark-text">{tag.label}</span>
                                          </button>
                                        ))
                                      }
                                      {tagSearchText && !tags.find(t => t.label.toLowerCase() === tagSearchText.toLowerCase()) && (
                                        <button
                                          key={`new-tag-${tagSearchText}`}
                                          className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px]"
                                          onClick={() => {
                                            const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
                                            const newTag = {
                                              id: tagSearchText.toLowerCase().replace(/\s+/g, '-'),
                                              label: tagSearchText,
                                              color: randomColor
                                            };
                                            setPendingNewTag(newTag);
                                            setSelectedTag(newTag);
                                            setDraftTag(newTag);
                                            setTagSearchText('');
                                            setIsTagDropdownOpen(false);
                                          }}
                                        >
                                          <Add className="w-4 h-4 text-dark-text/50 dark:text-dark-text/50" />
                                          <span className="font-regular text-dark-text/50 dark:text-dark-text/50">Create <span className="font-semibold text-dark-text dark:text-dark-text">"{tagSearchText}"</span> tag</span>
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                              <button className="flex items-center gap-2 px-4 h-[56px] border-b border-light-border dark:border-dark-border text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <Pin className="w-4 h-4" />
                                <span>Add a location</span>
                              </button>
                              <button className="flex items-center justify-between px-4 h-[56px] text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <Repeat className="w-4 h-4" />
                                  <span>Repeat</span>
                                </div>
                              </button>
                              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-light-border dark:border-dark-border">
                          <button
                            onClick={handleClose}
                            className="px-3 py-1.5 text-sm text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors"
                          >
                            Discard
                          </button>
                          <button
                            onClick={handleSaveTask}
                            disabled={!taskTitle.trim()}
                            className={`px-4 py-2 text-sm font-semibold rounded-[79px] transition-colors ${taskTitle.trim() 
                              ? 'bg-[#FF4400] hover:bg-[#E53E00] text-white' 
                              : 'bg-black/5 dark:bg-white/5 text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
                          >
                            {editingTaskId ? 'Edit task' : 'Add task'}
                          </button>
                        </div>
                          </div>
                        </div>
                      </div>
                    
                  </div>
                </motion.div>
              )}
              {isAddingEvent && (
                <motion.div
                  layout
                  key="commandBar-adding-event"
                  onAnimationStart={() => {
                    animationInProgressRef.current = true;
                  }}
                  onAnimationComplete={() => {
                    animationInProgressRef.current = false;
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    duration: 0.3
                  }}
                  className="flex flex-col gap-4 min-w-[450px]"
                >
                  <motion.div layout 
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 30,
                      duration: 0.3
                    }}
                    className="flex flex-col -mx-4">
                    {/* Title Section with Color */}
                    <div 
                    className="flex px-4 py-4 flex-row border-b border-light-border dark:border-dark-border">
                      <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                        <PopoverTrigger asChild>
                          <motion.div 
                            
                            className="w-4 h-4 mt-1.5 rounded-md cursor-pointer hover:ring-1 hover:ring-offset-2 hover:ring-offset-light-border hover:dark:ring-offset-white/30 hover:ring-border-light-border dark:hover:ring-border-dark-border transition-all"
                            style={{ backgroundColor: selectedColor }}
                          />
                        </PopoverTrigger>
                        <PopoverContent className="w-auto rounded-[9px] bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border p-3">
                          <div className="grid grid-cols-5 gap-2">
                            {TAG_COLORS.map((color) => (
                              <motion.div
                              whileHover={{ scale: 1.02 }}
                                key={color}
                                className="w-5 h-5 rounded-[5px] cursor-pointer hover:ring-1 hover:ring-offset-1 hover:ring-light-border dark:hover:ring-dark-border transition-all"
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                  handleEventChange('color', color);
                                  setSelectedColor(color);
                                  setColorPickerOpen(false);
                                }}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div 
                        className="flex flex-col gap-1 px-4"
                      >
                        {/* Title Input */}
                        <input
                          ref={titleInputRef}
                          type="text"
                          placeholder="Event title"
                          value={eventState.title}
                          onChange={(e) => handleEventChange('title', e.target.value)}
                          className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Add description"
                          value={eventState.description}
                          onChange={(e) => handleEventChange('description', e.target.value)}
                          className="w-full bg-transparent text-light-text/50 dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                        />
                      </div>
                    </div>

                    {/* Time and Date Group - No Divider Between */}
                    <div className="flex flex-col">
                      {/* Time Section */}
                      <div className="flex items-top gap-2 px-4 py-4">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={eventState.startTime.split(':')[0]}
                                onChange={(e) => {
                                  const hours = e.target.value.padStart(2, '0');
                                  const newStartTime = `${hours}:${eventState.startTime.split(':')[1]}`;
                                  handleEventChange('startTime', newStartTime);
                                  handleEventChange('endTime', ensureMinimumGap(newStartTime, eventState.endTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newStartTime = adjustHour(eventState.startTime, e.key === 'ArrowUp');
                                    handleEventChange('startTime', newStartTime);
                                    handleEventChange('endTime', ensureMinimumGap(newStartTime, eventState.endTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] text-right cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="px-[1px]">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={eventState.startTime.split(':')[1]}
                                onChange={(e) => {
                                  const minutes = e.target.value.padStart(2, '0');
                                  const newStartTime = `${eventState.startTime.split(':')[0]}:${minutes}`;
                                  handleEventChange('startTime', newStartTime);
                                  handleEventChange('endTime', ensureMinimumGap(newStartTime, eventState.endTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newStartTime = adjustMinutes(eventState.startTime, e.key === 'ArrowUp');
                                    handleEventChange('startTime', newStartTime);
                                    handleEventChange('endTime', ensureMinimumGap(newStartTime, eventState.endTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                            <span className="text-light-text/50 dark:text-dark-text/50">→</span>
                            <div className="flex items-center">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={eventState.endTime.split(':')[0]}
                                onChange={(e) => {
                                  const hours = e.target.value.padStart(2, '0');
                                  const newEndTime = `${hours}:${eventState.endTime.split(':')[1]}`;
                                  handleEventChange('endTime', ensureMinimumGap(eventState.startTime, newEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newEndTime = adjustHour(eventState.endTime, e.key === 'ArrowUp');
                                    handleEventChange('endTime', ensureMinimumGap(eventState.startTime, newEndTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] text-right cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="px-[1px]">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={eventState.endTime.split(':')[1]}
                                onChange={(e) => {
                                  const minutes = e.target.value.padStart(2, '0');
                                  const newEndTime = `${eventState.endTime.split(':')[0]}:${minutes}`;
                                  handleEventChange('endTime', ensureMinimumGap(eventState.startTime, newEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newEndTime = adjustMinutes(eventState.endTime, e.key === 'ArrowUp');
                                    handleEventChange('endTime', ensureMinimumGap(eventState.startTime, newEndTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={eventState.isAllDay}
                                onChange={(e) => handleEventChange('isAllDay', e.target.checked)}
                              />
                              <div className="w-9 h-5 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                            <span className="text-sm text-light-text/50 dark:text-dark-text/50">All day</span>
                          </div>
                        </div>
                      </div>

                      {/* Date Section */}
                      <div className="flex items-top gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                        <Popover>
                          <PopoverTrigger asChild>
                            <div className="w-5 h-5 flex items-center justify-center cursor-pointer">
                              <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                            </div>
                          </PopoverTrigger>
                          <PopoverContent ref={datePickerRef} className="w-auto p-0 bg-dark-bg-lighter dark:bg-dark border border-light-border dark:border-dark-border rounded-lg shadow-lg">
                            <Calendar
                                  mode="single"
                                  selected={new Date(eventState.date)}
                                  onSelect={(date) => date && handleEventChange('date', format(date, 'yyyy-MM-dd'))}
                                  initialFocus
                                />
                          </PopoverContent>
                        </Popover>
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={eventState.date}
                            onChange={(e) => handleEventChange('date', e.target.value)}
                            className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-auto cursor-pointer focus:ring-0 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                          />
                          <span className="text-sm text-light-text/50 dark:text-dark-text/50">
                            {formatDateToNatural(eventState.date)}
                          </span>
                        </div>
                      </div>
                      {/* Repeat Section */}
                      <div className="flex items-top gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <Repeat className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                        </div>

                        <div className="flex flex-col gap-1">
                          <Popover open={isRepeatDropdownOpen} onOpenChange={setIsRepeatDropdownOpen}>
                            <PopoverTrigger className="flex items-center gap-2 cursor-pointer hover:text-light-text dark:hover:text-dark-text rounded-md focus:outline-none" ref={repeatDropdownRef}>
                              <span className={`text-sm font-medium text-light-text/50 dark:text-dark-text ${eventState.repeat === 'none' ? 'text-light-text/50 dark:text-dark-text/50' : ''}`}>
                                {REPEAT_OPTIONS.find(option => option.id === eventState.repeat)?.label}
                              </span>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[250px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50"
                              align="start"
                              side="top"
                            >
                              <div role="listbox" className="flex flex-col">
                                {REPEAT_OPTIONS.map((option) => {
                                  let sublabel = option.sublabel;
                                  
                                  if (option.id === 'weekly' || option.id === 'biweekly') {
                                    const date = parse(eventState.date, 'yyyy-MM-dd', new Date());
                                    const dayOfWeek = format(date, 'EEE');
                                    sublabel = `on ${dayOfWeek}`;
                                  } else if (option.id === 'monthly') {
                                    const date = parse(eventState.date, 'yyyy-MM-dd', new Date());
                                    const dayOfMonth = format(date, 'do');
                                    sublabel = `on the ${dayOfMonth}`;
                                  } else if (option.id === 'monthlyWeekday') {
                                    const date = parse(eventState.date, 'yyyy-MM-dd', new Date());
                                    const dayOfMonth = getDate(date);
                                    const weekNum = Math.ceil(dayOfMonth / 7);
                                    const dayOfWeek = format(date, 'EEE');
                                    const ordinal = weekNum === 1 ? '1st' : weekNum === 2 ? '2nd' : weekNum === 3 ? '3rd' : `${weekNum}th`;
                                    sublabel = `on the ${ordinal} ${dayOfWeek}`;
                                  } else if (option.id === 'monthlyLastWeekday') {
                                    const date = parse(eventState.date, 'yyyy-MM-dd', new Date());
                                    const dayOfWeek = format(date, 'EEE');
                                    sublabel = `on the last ${dayOfWeek}`;
                                  } else if (option.id === 'yearly') {
                                    const date = parse(eventState.date, 'yyyy-MM-dd', new Date());
                                    const monthDay = format(date, 'MMM d');
                                    sublabel = `on ${monthDay}`;
                                  }
                                  
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      className={`w-full text-left  px-2 py-2 hover:bg-white/15 dark:hover:bg-dark-bg-lighter rounded-[5px] cursor-pointer ${eventState.repeat === option.id ? 'font-semibold' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEventChange('repeat', option.id);
                                        setIsRepeatDropdownOpen(false);
                                      }}
                                      role="option"
                                      aria-selected={eventState.repeat === option.id}
                                    >
                                      <div className="flex justify-between items-center">
                                        <span className={`text-xs text-dark-text/50 dark:text-dark-text/50 ${eventState.repeat === option.id ? 'font-semibold !text-dark-text dark:!text-dark-text' : ''}`}>{option.label}</span>
                                        {sublabel && (
                                          <span className="text-xs text-dark-text/30 dark:text-dark-text/30">{sublabel}</span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>

                    

                    
                    {/* Add Edit/Discard row at the bottom with task-like styling */}
                    <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-light-border dark:border-dark-border">
                      <button
                        onClick={() => handleClose()}
                        className="px-3 py-1.5 text-sm text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveChanges}
                        disabled={!eventState.title.trim() || !hasChanges}
                        className={`px-4 py-2 text-sm font-semibold rounded-[79px] transition-colors ${eventState.title.trim() && hasChanges
                          ? 'bg-[#FF4400] hover:bg-[#E53E00] text-white' 
                          : 'bg-black/5 dark:bg-white/5 text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
                      >
                        {originalEventState?.id ? 'Edit event' : 'Add event'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
              {isGoToDateMode && (
                <motion.div
                  layout
                  key="commandBar-go-to-date"
                  className="flex flex-col min-w-[450px]"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="flex items-start justify-between -mx-4">
                    <div className="flex-1">
                      <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
                        <div className="flex flex-col">
                          <div className="flex px-4 py-4 flex-row items-center border-b border-light-border dark:border-dark-border">
                            <div 
                              className="cursor-pointer flex items-center mr-2"
                              onClick={() => {
                                // Set animating state to prevent layout bugs during transition
                                setIsAnimating(true);
                                
                                // Use timeout to ensure animation completes before state changes
                                animationTimeoutRef.current = setTimeout(() => {
                                  setIsGoToDateMode(false);
                                  setQuery('');
                                  setSuggestions([]);
                                  setIsAnimating(false);
                                }, 25); // Short delay to allow animation to start
                              }}
                            >
                              <button type="button" className=" flex group items-center justify-center cursor-pointer hover:bg-light-bg-lighter dark:hover:bg-white/5 rounded-[5px] h-[32px] w-[32px]">  
                                <ArrowAlt 
                                  className="w-5 h-5 group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors" 
                                  style={{ transform: 'rotate(180deg)' }}
                                />
                              </button>
                            </div>
                            
                            <div className="flex-1 flex-col gap-1 pl-1">
                              <input
                                type="text"
                                placeholder="e.g. nov 5, in 10 weeks"
                                value={query}
                                onChange={handleQueryChange}
                                className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                                autoFocus
                              />
                            </div>
                          </div>
                          {query && (
                            <div className="p-2">
                              {suggestions.length > 0 ? (
                                suggestions.map((suggestion, index) => (
                                  <div
                                    key={index}
                                    onClick={() => handleGoToDate(suggestion.date)}
                                    className="w-full px-3 py-2 text-sm text-left text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 rounded-[9px] cursor-pointer"
                                  >
                                    Go to <span className="font-medium">{suggestion.label}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-2 text-sm text-light-text/50 dark:text-dark-text/50">
                                  No matching date found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      </motion.div>
    )}
    </AnimatePresence>

    {/* Render modals outside of LayoutGroup */}
    {showRepeatEditModal && (
      <RepeatEditModal 
        isOpen={showRepeatEditModal}
        onClose={() => setShowRepeatEditModal(false)}
        onEditSingle={() => handleEditSeriesSelect('single')}
        onEditFuture={() => handleEditSeriesSelect('future')}
        onEditAll={() => handleEditSeriesSelect('all')}
      />
    )}
  </div>
);

}; 

// Use memo to prevent unnecessary re-renders of the entire component
export default memo(forwardRef(CommandBar));