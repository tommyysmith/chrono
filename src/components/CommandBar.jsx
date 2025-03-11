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
import TagDropdown from './TagDropdown';
import RepeatEditModal from './RepeatEditModal';
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

const CommandBar = ({ onPrevious, onNext, onToday, onCreateEvent, onUpdateEvent, onCreateTask, onUpdateTask, onClose }, ref) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleOption, setScheduleOption] = useState('today');
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

  // Don't automatically save tags to localStorage
  // Tags will be saved when a task is created or updated
  const [taskNotes, setTaskNotes] = useState('');
  const [eventTitle, setEventTitle] = useState('New Event');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventToEdit, setEventToEdit] = useState(null);
  const [repeatOption, setRepeatOption] = useState('none');
  const [repeatSeriesId, setRepeatSeriesId] = useState(null); // Track series ID
  const [isRepeatDropdownOpen, setIsRepeatDropdownOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#808080');
  const [editMode, setEditMode] = useState(null);
  const [showRepeatEditModal, setShowRepeatEditModal] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationTimeoutRef = useRef(null);

  const originalEventId = useRef(null);

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
      exitingRef.current = false;
    };
  }, []);

  const handleClose = useCallback((options = {}) => {
    const { skipDelete = false, forceClose = false } = options;
    
    // Only delete untitled events if we're not skipping delete
    if (!skipDelete && editingEventId && !eventTitle.trim()) {
      onClose?.(editingEventId);
    }
    
    // Capture the current size before closing
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      previousSizeRef.current = { width, height };
    }
    
    // Set exiting flag to true before animation starts
    exitingRef.current = true;
    
    // Reset to default state rather than closing completely
    setIsAddingEvent(false);
    setIsAddingTask(false);
    
    // Reset all other states after animation completes
    const resetTimeout = setTimeout(() => {
      // Reset these states regardless of forceClose
      setTaskTitle('');
      setTaskNotes('');
      setSelectedTag(null);
      setDraftTag(null);
      setTagSearchText('');
      setIsTagDropdownOpen(false);
      setEventTitle('New Event');
      setEventDescription('');
      setEventStartTime('09:00');
      setEventEndTime('10:00');
      setIsAllDay(false);
      setRepeatOption('none');
      setEditingEventId(null);
      setEventToEdit(null);
      setRepeatSeriesId(null);
      setIsRepeatDropdownOpen(false);
      setShowColorPicker(false);
      setEventToEdit(null);
      setTaskToEdit(null);
      setEditingTaskId(null);
      setEditMode(null);
      setScheduledDate(null);
      setIsScheduleOpen(false);
      
      exitingRef.current = false;
    }, 300); // Match this with your animation duration

    return () => clearTimeout(resetTimeout);
  }, [onClose, editingEventId, eventTitle]);

  const openForEdit = useCallback((event) => {
    // Set all event data first
    setEventToEdit(event);
    setEditingEventId(event.id);
    setEventTitle(event.title || 'New Event');
    setEventDescription(event.description || '');
    setEventDate(format(event.start, 'yyyy-MM-dd'));
    setEventStartTime(format(event.start, 'HH:mm'));
    setEventEndTime(format(event.end, 'HH:mm'));
    setIsAllDay(event.isAllDay || false);
    setSelectedColor(event.color || '#3B82F6');
    setRepeatOption(event.repeatOption || 'none');
    
    // For repeat events, show the modal first
    if (event.seriesId || (event.repeat && event.repeat !== 'none')) {
      setShowRepeatEditModal(true);
      // Ensure we're in edit mode but not visible yet
      setIsAddingEvent(true);
      setIsOpen(true);
    } else {
      // For non-repeat events, go straight to edit mode
      setIsAddingEvent(true);
      setIsOpen(true);
    }
  }, []);

  const initializeEventState = useCallback((startTime, endTime, eventId = null, skipAnimation = false) => {
    const now = startTime || new Date();
    const end = endTime || new Date(now.getTime() + 60 * 60 * 1000);

    // Initialize all state at once to prevent flashing
    setEventDate(format(now, 'yyyy-MM-dd'));
    setEventStartTime(roundToNearest15Min(format(now, 'HH:mm')));
    setEventEndTime(roundToNearest15Min(format(end, 'HH:mm')));
    setEventTitle('New Event');
    setEventDescription('');
    setIsAllDay(false);
    setSelectedColor('#3B82F6');
    setRepeatOption('none');
    setEventToEdit(null);
    setRepeatSeriesId(null);
    setIsRepeatDropdownOpen(false);
    setShowColorPicker(false);
    setEditingEventId(eventId);
    
    // Use requestAnimationFrame to ensure state updates are batched
    requestAnimationFrame(() => {
      setIsOpen(true);
      setIsAddingEvent(true);
      
      // Focus after animation completes
      const focusTimeout = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 300); // Match this with animation duration
      
      return () => clearTimeout(focusTimeout);
    });
  }, []);

  const handleAddEventClick = useCallback(() => {
    const now = new Date();
    const endTime = new Date(now.getTime() + 60 * 60 * 1000);
    
    const newEventData = {
      title: 'New Event',
      description: '',
      start: now,
      end: endTime,
      isAllDay: false,
      color: '#3B82F6',
      repeat: 'none'
    };

    const createdEvent = onCreateEvent(newEventData);
    initializeEventState(now, endTime, createdEvent.id);
  }, [onCreateEvent, initializeEventState]);

  const handleRepeatOptionChange = useCallback((option) => {
    setRepeatOption(option);
    setIsRepeatDropdownOpen(false);
    
    if (editingEventId) {
      const startDateTime = parse(`${eventDate} ${eventStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
      const endDateTime = parse(`${eventDate} ${eventEndTime}`, 'yyyy-MM-dd HH:mm', new Date());

      const updatedFields = {
        id: editingEventId,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        start: startDateTime,
        end: endDateTime,
        isAllDay,
        color: selectedColor,
        repeat: option,
        _repeatChanged: true
      };

      if (eventToEdit?.seriesId) {
        updatedFields.seriesId = eventToEdit.seriesId;
      }

      if (eventToEdit?.seriesId || (eventToEdit?.repeat && eventToEdit.repeat !== 'none')) {
        updatedFields._editScope = editMode || 'single';
        
        if (updatedFields._editScope === 'single') {
          updatedFields._originalSeriesId = eventToEdit.seriesId;
          updatedFields.seriesId = null;
          updatedFields.repeat = 'none';
          updatedFields.isRepeat = false;
          updatedFields._preserveSeriesEvents = true;
        }
      }

      onUpdateEvent(updatedFields);
    }
  }, [editingEventId, eventTitle, eventDescription, eventDate, eventStartTime, eventEndTime, 
      isAllDay, selectedColor, eventToEdit, onUpdateEvent, editMode]);

  const handleEditSeriesSelect = useCallback((editScope) => {
    if (!eventToEdit) return;
    
    console.log('%c[CommandBar] Edit series selection:', 'background: #17a2b8; color: white', editScope);
    
    // Just hide the modal and keep CommandBar open
    setShowRepeatEditModal(false);
    setEditMode(editScope);
    
    // If it's a single event edit, update repeat option
    if (editScope === 'single') {
      setRepeatOption('none');
    }
    
    // Update the event immediately
    if (editingEventId) {
      const startDateTime = parse(`${eventDate} ${eventStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
      const endDateTime = parse(`${eventDate} ${eventEndTime}`, 'yyyy-MM-dd HH:mm', new Date());

      const updatedFields = {
        id: editingEventId,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        start: startDateTime,
        end: endDateTime,
        isAllDay,
        color: selectedColor,
        repeat: editScope === 'single' ? 'none' : (repeatOption || eventToEdit.repeat),
        _editScope: editScope
      };
      
      if (eventToEdit?.seriesId) {
        updatedFields._originalSeriesId = eventToEdit.seriesId;
        
        if (editScope === 'single') {
          updatedFields.seriesId = null;
          updatedFields.repeat = 'none';
          updatedFields.isRepeat = false;
          updatedFields._preserveSeriesEvents = true;
        } 
        else if (editScope === 'future') {
          // Keep the series ID for 'future' edits - the Calendar component will create a new series ID
          updatedFields.seriesId = eventToEdit.seriesId;
          // Check if repeat option has changed
          if (repeatOption !== eventToEdit.repeat) {
            updatedFields._repeatChanged = true;
          }
        }
        else if (editScope === 'all') {
          updatedFields.seriesId = eventToEdit.seriesId;
          // Check if repeat option has changed
          if (repeatOption !== eventToEdit.repeat) {
            updatedFields._repeatChanged = true;
          }
        }
      }

      console.log('%c[CommandBar] Initial update with scope:', 'background: #17a2b8; color: white', updatedFields);
      onUpdateEvent(updatedFields);
    }
  }, [eventToEdit, editingEventId, eventTitle, eventDescription, eventDate, eventStartTime, 
      eventEndTime, isAllDay, selectedColor, repeatOption, onUpdateEvent]);

  const openForTaskEdit = useCallback((task) => {
    setIsOpen(true);
    setIsAddingTask(true);
    setTaskTitle(task.title || '');
    setTaskNotes(task.notes || '');
    setSelectedTag(task.tag || null);
    setDraftTag(task.tag || null);
    setScheduledDate(task.scheduledDate ? new Date(task.scheduledDate) : null);
    setEditingTaskId(task.id);
    setTaskToEdit(task);
  }, []);

  // Memoize state transition handlers
  const handleOpenAddEvent = useCallback(() => {
    setIsOpen(true);
    setIsAddingEvent(true);
    setIsAddingTask(false);
  }, []);

  const handleOpenAddTask = useCallback(() => {
    setIsOpen(true);
    setIsAddingEvent(false);
    setIsAddingTask(true);
  }, []);

  const handleScheduleOptionSelect = useCallback((option) => {
    setScheduleOption(option);
    if (option === 'custom') {
      setIsDatePickerOpen(true);
    } else {
      setIsDatePickerOpen(false);
    }
  }, []);

  const handleTagSelect = useCallback((tag) => {
    setSelectedTag(tag);
    setIsTagDropdownOpen(false);
    setTagSearchText('');
  }, []);

  const toggleAllDay = useCallback(() => {
    setIsAllDay(prev => !prev);
  }, []);

  const toggleRepeatDropdown = useCallback(() => {
    setIsRepeatDropdownOpen(prev => !prev);
  }, []);

  const handleRepeatOptionSelect = useCallback((option) => {
    setRepeatOption(option);
    setIsRepeatDropdownOpen(false);
  }, []);

  const toggleColorPicker = useCallback(() => {
    setShowColorPicker(prev => !prev);
  }, []);

  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    setIsDatePickerOpen(false);
    setIsScheduleOpen(false);
  }, []);

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
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target) &&
        (!datePickerRef.current || !datePickerRef.current.contains(event.target)) &&
        !event.target.closest('.react-calendar') && 
        !event.target.closest('.calendar-popup')
      ) {
        // Only reset to default state if we're in an expanded state
        // Don't close the component completely
        if (isAddingEvent || isAddingTask) {
          handleClose({ skipDelete: false, forceClose: false });
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose, isAddingEvent, isAddingTask]);

  useEffect(() => {
    if (isAddingEvent && titleInputRef.current) {
      titleInputRef.current.focus();
    }

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && isAddingEvent) {
        handleClose({ skipDelete: true, forceClose: false });
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [isAddingEvent, handleClose]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isAddingEvent) return;
      
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAddingEvent]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setShowColorPicker(false);
      }
    };

    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker]);

  useImperativeHandle(ref, () => ({
    openWithDragData: (startTime, endTime, eventId) => {
      const newEventData = {
        title: 'New Event',
        description: '',
        start: startTime,
        end: endTime,
        isAllDay: false,
        color: '#3B82F6',
        repeat: 'none'
      };

      const createdEventId = eventId || onCreateEvent(newEventData).id;
      initializeEventState(startTime, endTime, createdEventId);
    },
    openWithTime: (date) => {
      const endTime = new Date(date.getTime() + 60 * 60 * 1000);
      const newEventData = {
        title: 'New Event',
        description: '',
        start: date,
        end: endTime,
        isAllDay: false,
        color: '#3B82F6',
        repeat: 'none'
      };

      const createdEvent = onCreateEvent(newEventData);
      initializeEventState(date, endTime, createdEvent.id);
    },
    openForEdit,
    openForTaskEdit,
  }));

  const updateEventLive = useCallback(() => {
    if (!editingEventId) return;
    
    try {
      const startDateTime = parse(`${eventDate} ${eventStartTime}`, 'yyyy-MM-dd HH:mm', new Date());
      const endDateTime = parse(`${eventDate} ${eventEndTime}`, 'yyyy-MM-dd HH:mm', new Date());
      
      console.log('%c[CommandBar] Updating with edit scope:', 'background: #28a745; color: white', editMode || 'single');
      
      const updatedFields = {
        id: editingEventId,
        title: eventTitle.trim(),
        description: eventDescription.trim(),
        start: startDateTime,
        end: endDateTime,
        isAllDay,
        color: selectedColor,
        repeat: repeatOption,
        _editScope: editMode || 'single' // Always set edit scope
      };
      
      // If this is a recurring event, add necessary metadata
      if (eventToEdit && (eventToEdit.seriesId || (eventToEdit.repeat && eventToEdit.repeat !== 'none'))) {
        // Store the original series ID
        updatedFields._originalSeriesId = eventToEdit.seriesId;
        
        if (updatedFields._editScope === 'single') {
          // For single event edits, we'll detach from the series
          updatedFields.seriesId = null;
          updatedFields.repeat = 'none';
          updatedFields.isRepeat = false;
          updatedFields._preserveSeriesEvents = true;
        } else {
          // For 'future' or 'all' edits, keep the series ID
          updatedFields.seriesId = eventToEdit.seriesId;
          
          // Check for time changes
          if (eventToEdit.start && eventToEdit.end) {
            const startDiff = startDateTime.getTime() - eventToEdit.start.getTime();
            const endDiff = endDateTime.getTime() - eventToEdit.end.getTime();
            if (startDiff !== 0 || endDiff !== 0) {
              updatedFields._timeChange = true;
            }
          }
          
          // Check for repeat option changes
          if (eventToEdit.repeat !== repeatOption) {
            updatedFields._repeatChanged = true;
          }
        }
      }
      
      console.log('%c[CommandBar] Sending update:', 'background: #28a745; color: white', updatedFields);
      onUpdateEvent(updatedFields);
    } catch (error) {
      console.error('Error updating event:', error);
    }
  }, [editingEventId, eventTitle, eventDescription, eventDate, eventStartTime, eventEndTime, 
      isAllDay, selectedColor, repeatOption, eventToEdit, onUpdateEvent, editMode]);

  useEffect(() => {
    if (editingEventId && isAddingEvent && !showRepeatEditModal) {
      const debounceTime = repeatOption !== 'none' ? 400 : 200;
      
      const timer = setTimeout(() => {
        updateEventLive();
      }, debounceTime);
      return () => clearTimeout(timer);
    }
  }, [
    editingEventId,
    eventTitle,
    eventDescription,
    eventDate,
    eventStartTime,
    eventEndTime,
    isAllDay,
    selectedColor,
    updateEventLive,
    isAddingEvent,
    showRepeatEditModal,
    repeatOption
  ]);

  useEffect(() => {
    if (eventToEdit) {
      originalEventId.current = eventToEdit.id;
      setEventTitle(eventToEdit.title || '');
      setEventDescription(eventToEdit.description || '');
      setEventDate(format(eventToEdit.start, 'yyyy-MM-dd'));
      setEventStartTime(format(eventToEdit.start, 'HH:mm'));
      setEventEndTime(format(eventToEdit.end, 'HH:mm'));
      setIsAllDay(eventToEdit.isAllDay || false);
      setSelectedColor(eventToEdit.color || '#3B82F6');
      setRepeatOption(eventToEdit.repeat || 'none');
      if (eventToEdit.seriesId) {
        setRepeatSeriesId(eventToEdit.seriesId);
      }
      setEditingEventId(eventToEdit.id);
    } else {
      originalEventId.current = null;
    }
  }, [eventToEdit]);

  const animationInProgressRef = useRef(false);
  
  const consistentTransition = {
    type: "spring",
    stiffness: 300,
    damping: 30,
    duration: 0.3
  };

  const layoutKey = useMemo(() => 
    `commandBar-${isAddingEvent ? 'event' : isAddingTask ? 'task' : 'default'}`,
    [isAddingEvent, isAddingTask]
  );

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex justify-center">
      <AnimatePresence mode="wait">
        {(isOpen) && (
          <motion.div 
            key="commandBar-container"
            ref={containerRef}
            layout
            layoutId={`commandBar-container-${layoutKey}`}
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
              backgroundColor: "var(--background-color, var(--bg-light, #ffffff))",
              willChange: "transform, opacity, background-color",
              transformOrigin: "bottom",
              visibility: animationInProgressRef.current ? "hidden" : "visible"
            }}
            onLayoutAnimationStart={() => {
              animationInProgressRef.current = true;
              setTimeout(() => {
                animationInProgressRef.current = false;
              }, 50);
            }}
            onLayoutAnimationComplete={() => {
              animationInProgressRef.current = false;
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
                ease: exitingRef.current ? "linear" : "easeInOut"
              }
            }}
            className="bg-light-bg dark:bg-dark-bg-lighter overflow-hidden shadow-lg rounded-[13px] border border-light-border dark:border-dark-border px-4"
          >
            <LayoutGroup id={layoutKey}>
              <motion.div 
                key={`commandBar-content-${layoutKey}`}
                layout 
                layoutId={`commandBar-content-${layoutKey}`}
                transition={consistentTransition}
                className="flex items-center gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {!isAddingEvent && !isAddingTask && (
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
                          <Task className={`w-4 h-4  ${taskTitle.trim() ? 'text-light-text dark:text-dark-text' : 'text-light-text/50 dark:text-dark-text/50'}`}   />
                          <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Task</span>
                        </button>
                        <button
                          onClick={() => {
                            handleAddEventClick();
                            setIsOpen(true);
                          }}
                          className="group w-full flex items-center gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
                        >
                          <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 " />
                          <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Event</span>
                        </button>
                      </PopoverContent>
                    </Popover>
                  )}

                  {!isAddingEvent && !isAddingTask && (
                    <motion.div 
                      layout
                      key="commandBar-divider"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                  )}

                  {!isAddingEvent && !isAddingTask && (
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

                  {!isAddingEvent && !isAddingTask && (
                    <motion.div 
                      layout
                      key="commandBar-divider-2"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                  )}

                  {!isAddingEvent && !isAddingTask && (
                    <motion.button 
                    key="commandBar-ask-me"
                      layout
                      className="flex py-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50"
                    >
                      <Microphone className="w-4 h-4" fill="none">
                        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </Microphone>
                      <span className="text-light-text/50 dark:text-dark-text/50 font-semibold text-sm">Ask me!</span>
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
                              <div className="flex px-4 py-3 flex-row border-b border-light-border dark:border-dark-border">
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
                              <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                                <PopoverTrigger asChild>
                                  <button 
                                    className="flex items-center gap-2 px-4 h-[56px] border-b border-light-border dark:border-dark-border text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setIsScheduleOpen(!isScheduleOpen);
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    <CalendarIcon className="w-4 h-4" />
                                    <span>{scheduledDate ? format(scheduledDate, 'MMM d') : 'Schedule'}</span>
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-[240px] text-dark-text dark:text-dark-text p-1 ml-8 mb-8 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg backdrop-blur-lg shadow-lg border border-light-border dark:border-dark-border" 
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
                              <Popover sideOffset={4} open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                <PopoverTrigger asChild>
                                  <div className="absolute w-0 h-0 overflow-hidden" />
                                </PopoverTrigger>
                                <PopoverContent 
                                  className="w-auto ml-4 mt-3 p-0 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg shadow-lg border border-light-border dark:border-dark-border" 
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
                              <div className="flex items-center gap-2 px-4 h-[56px] border-b border-light-border dark:border-dark-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
                                        }
                                        setTagSearchText(e.target.value);
                                        setIsTagDropdownOpen(true);
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Backspace' && draftTag && !tagSearchText) {
                                          e.preventDefault();
                                          setDraftTag(null);
                                          setTagSearchText('');
                                          return;
                                        }
                                        if (e.key === 'Enter' && tagSearchText && !tags.find(t => t.label.toLowerCase() === tagSearchText.toLowerCase())) {
                                          const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
                                          const newTag = {
                                            id: tagSearchText.toLowerCase().replace(/\s+/g, '-'),
                                            label: tagSearchText,
                                            color: randomColor
                                          };
                                          const updatedTags = [...tags, newTag];
                                          setTags(updatedTags);
                                          localStorage.setItem('tags', JSON.stringify(updatedTags));
                                          window.dispatchEvent(new CustomEvent('tags-updated', { detail: updatedTags }));
                                          setSelectedTag(newTag);
                                          setTagSearchText(newTag.label);
                                          setIsTagDropdownOpen(false);
                                        }
                                      }}
                                    />
                                  {isTagDropdownOpen && tagSearchText.length > 0 && (
                                    <div className="absolute left-0 z-50 right-0 max-w-[240 px] backdrop-blur-lg p-1 top-full  mt-1  bg-light-bg dark:bg-dark-bg  rounded-[9px] border border-light-border dark:border-dark-border shadow-lg overflow-hidden">
                                      {tags
                                        .filter(tag => tag.label.toLowerCase().includes(tagSearchText.toLowerCase()))
                                        .map(tag => (
                                          <button
                                            key={`tag-option-${tag.id}`}
                                            className="w-full flex items-center gap-2 px-2 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px]"
                                            onClick={() => {
                                              setDraftTag(tag);
                                              setTagSearchText('');
                                              setIsTagDropdownOpen(false);
                                            }}
                                          >
                                            <Tag className="w-4 h-4" style={{ color: tag.color }} />
                                            <span>{tag.label}</span>
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
                                            const updatedTags = [...tags, newTag];
                                            setTags(updatedTags);
                                            localStorage.setItem('tags', JSON.stringify(updatedTags));
                                            window.dispatchEvent(new CustomEvent('tags-updated', { detail: updatedTags }));
                                            setDraftTag(newTag);
                                            setTagSearchText('');
                                            setIsTagDropdownOpen(false);
                                          }}
                                        >
                                          <Add className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                                          <span className="font-regular text-light-text/50 dark:text-dark-text/50">Create <span className="font-semibold text-light-text dark:text-dark-text">"{tagSearchText}"</span> tag</span>
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
                            onClick={() => {
                              if (taskTitle.trim()) {
                                if (editingTaskId) {
                                  
                                  const updatedTask = {
                                    ...taskToEdit,
                                    title: taskTitle.trim(),
                                    notes: taskNotes.trim(),
                                    tag: draftTag,
                                    scheduledDate: scheduledDate
                                  };
                                  
                                  onUpdateTask(updatedTask);
                                } else {
                                  const newTask = {
                                    id: Date.now(),
                                    title: taskTitle.trim(),
                                    notes: taskNotes.trim(),
                                    tag: draftTag || selectedTag,
                                    completed: false,
                                    createdAt: new Date().toISOString(),
                                    scheduledDate: scheduledDate ? scheduledDate.toISOString() : null
                                  };
                                  
                                  onCreateTask(newTask);
                                  
                                  try {
                                    const savedTasks = localStorage.getItem('tasks') || '{}';
                                    const tasks = JSON.parse(savedTasks);
                                    
                                    const tagGroup = newTask.tag ? newTask.tag.id : 'all';
                                    const updatedTasks = {
                                      ...tasks,
                                      [tagGroup]: [...(tasks[tagGroup] || []), newTask],
                                      all: [...(tasks.all || []), newTask]
                                    };
                                    
                                    localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                                    window.dispatchEvent(new CustomEvent('tasks-updated', { detail: updatedTasks }));

                                  } catch (e) {
                                    console.error("Error updating localStorage:", e);
                                  }
                                }
                                handleClose({ forceClose: true });
                              }
                            }}
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
                  transition={consistentTransition}
                  className="flex flex-col gap-4 min-w-[450px]"
                >
                  <motion.div layout 
                    transition={consistentTransition}
                    className="flex flex-col -mx-4">
                    {/* Title Section with Color */}
                    <div 
                    className="flex px-4 py-3 flex-row border-b border-light-border dark:border-dark-border">
                      <div 
                      className="w-4 h-4 rounded-md cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-light-border dark:hover:ring-dark-border transition-all"
                      style={{ backgroundColor: selectedColor }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowColorPicker(!showColorPicker);
                      }}
                    />
                    <div 
                      className="flex flex-col gap-1 px-4"
                    >
                      {/* Title Input */}
                      <input
                        ref={titleInputRef}
                        type="text"
                        placeholder="Event title"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Add description"
                        value={eventDescription}
                        onChange={(e) => setEventDescription(e.target.value)}
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
                                value={eventStartTime.split(':')[0]}
                                onChange={(e) => {
                                  const hours = e.target.value.padStart(2, '0');
                                  const newStartTime = `${hours}:${eventStartTime.split(':')[1]}`;
                                  setEventStartTime(newStartTime);
                                  setEventEndTime(ensureMinimumGap(newStartTime, eventEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newStartTime = adjustHour(eventStartTime, e.key === 'ArrowUp');
                                    setEventStartTime(newStartTime);
                                    setEventEndTime(ensureMinimumGap(newStartTime, eventEndTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] text-right cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="px-[1px]">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={eventStartTime.split(':')[1]}
                                onChange={(e) => {
                                  const minutes = e.target.value.padStart(2, '0');
                                  const newStartTime = `${eventStartTime.split(':')[0]}:${minutes}`;
                                  setEventStartTime(newStartTime);
                                  setEventEndTime(ensureMinimumGap(newStartTime, eventEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newStartTime = adjustMinutes(eventStartTime, e.key === 'ArrowUp');
                                    setEventStartTime(newStartTime);
                                    setEventEndTime(ensureMinimumGap(newStartTime, eventEndTime));
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
                                value={eventEndTime.split(':')[0]}
                                onChange={(e) => {
                                  const hours = e.target.value.padStart(2, '0');
                                  const newEndTime = `${hours}:${eventEndTime.split(':')[1]}`;
                                  setEventEndTime(ensureMinimumGap(eventStartTime, newEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newEndTime = adjustHour(eventEndTime, e.key === 'ArrowUp');
                                    setEventEndTime(ensureMinimumGap(eventStartTime, newEndTime));
                                  }
                                }}
                                className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-[2ch] text-right cursor-pointer focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="px-[1px]">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={eventEndTime.split(':')[1]}
                                onChange={(e) => {
                                  const minutes = e.target.value.padStart(2, '0');
                                  const newEndTime = `${eventEndTime.split(':')[0]}:${minutes}`;
                                  setEventEndTime(ensureMinimumGap(eventStartTime, newEndTime));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const newEndTime = adjustMinutes(eventEndTime, e.key === 'ArrowUp');
                                    setEventEndTime(ensureMinimumGap(eventStartTime, newEndTime));
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
                                checked={isAllDay}
                                onChange={(e) => setIsAllDay(e.target.checked)}
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
                                  selected={new Date(eventDate)}
                                  onSelect={(date) => date && setEventDate(format(date, 'yyyy-MM-dd'))}
                                  initialFocus
                                />
                          </PopoverContent>
                        </Popover>
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-auto cursor-pointer focus:ring-0 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                          />
                          <span className="text-sm text-light-text/50 dark:text-dark-text/50">
                            {formatDateToNatural(eventDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Location Section (Placeholder) */}
                    <div className="flex items-center gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <Pin className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                      </div>
                      <input
                        type="text"
                        placeholder="Add a location"
                        className="bg-transparent text-light-text dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50 w-full"
                      />
                    </div>

                    {/* Guests Section (Placeholder) */}
                    <div className="flex items-center gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <User className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                      </div>
                      <input
                        type="text"
                        placeholder="Add guests"
                        className="bg-transparent text-light-text dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50 w-full"
                      />
                    </div>

                    {/* Repeat Section with inline color picker */}
                    <div className="flex justify-between items-center gap-2 px-4 py-3 border-t border-light-border dark:border-dark-border">
                      <div className="relative" ref={colorPickerRef}>
                        <div 
                          className="w-5 h-5 rounded-md cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-light-border dark:hover:ring-dark-border transition-all"
                          style={{ backgroundColor: selectedColor }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowColorPicker(!showColorPicker);
                          }}
                        />
                        
                        {/* Inline Color Picker */}
                        <AnimatePresence>
                          {showColorPicker && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 10 }}
                              transition={{ duration: 0.05 }}
                              className="absolute left-0 bottom-full mb-2 bg-white dark:bg-dark-bg shadow-lg rounded-[13px] border border-light-border dark:border-dark-border z-50 w-[280px]"
                            >
                              <div className="px-3 pt-2 pb-1 text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
                                Color
                              </div>
                              <div className="flex flex-wrap gap-2 p-3">
                                {TAG_COLORS.map((color) => (
                                  <div
                                    key={`color-${color.replace('#', '')}`}
                                    className={`w-6 h-6 rounded-md cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-light-border dark:hover:ring-dark-border transition-all ${selectedColor === color ? 'ring-2 ring-offset-2 ring-light-border dark:ring-dark-border' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => {
                                      setSelectedColor(color);
                                      setShowColorPicker(false);
                                    }}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="relative flex" ref={repeatDropdownRef}>
                        <button 
                          type="button"
                          className="flex items-center gap-2 cursor-pointer p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md focus:outline-none"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setIsRepeatDropdownOpen(true);
                          }}
                          aria-expanded={isRepeatDropdownOpen}
                          aria-haspopup="true"
                        >
                          <Repeat className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                          <span className="text-sm font-semibold text-light-text/50 dark:text-dark-text/50">
                            {REPEAT_OPTIONS.find(option => option.id === repeatOption)?.label}
                          </span>
                        </button>

                        <AnimatePresence>
                          {isRepeatDropdownOpen && (
                          <div 
                            className="absolute right-0 bottom-full mb-1 w-[250px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-10"
                            role="listbox"
                            tabIndex={-1}
                          >
                            {REPEAT_OPTIONS.map((option) => {
                              let sublabel = option.sublabel;
                              
                              if (option.id === 'weekly' || option.id === 'biweekly') {
                                const date = parse(eventDate, 'yyyy-MM-dd', new Date());
                                const dayOfWeek = format(date, 'EEE');
                                sublabel = `on ${dayOfWeek}`;
                              } else if (option.id === 'monthly') {
                                const date = parse(eventDate, 'yyyy-MM-dd', new Date());
                                const dayOfMonth = format(date, 'do');
                                sublabel = `on the ${dayOfMonth}`;
                              } else if (option.id === 'monthlyWeekday') {
                                const date = parse(eventDate, 'yyyy-MM-dd', new Date());
                                const dayOfMonth = getDate(date);
                                const weekNum = Math.ceil(dayOfMonth / 7);
                                const dayOfWeek = format(date, 'EEE');
                                const ordinal = weekNum === 1 ? '1st' : weekNum === 2 ? '2nd' : weekNum === 3 ? '3rd' : `${weekNum}th`;
                                sublabel = `on the ${ordinal} ${dayOfWeek}`;
                              } else if (option.id === 'monthlyLastWeekday') {
                                const date = parse(eventDate, 'yyyy-MM-dd', new Date());
                                const dayOfWeek = format(date, 'EEE');
                                sublabel = `on the last ${dayOfWeek}`;
                              } else if (option.id === 'yearly') {
                                const date = parse(eventDate, 'yyyy-MM-dd', new Date());
                                const monthDay = format(date, 'MMM d');
                                sublabel = `on ${monthDay}`;
                              }
                              
                              return (
                                <button
                                  type="button"

                                  className={`w-full text-left px-2 py-2 hover:bg-white/15 dark:hover:bg-dark-bg-lighter rounded-[5px] cursor-pointer ${repeatOption === option.id ? '' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleRepeatOptionChange(option.id);
                                  }}
                                  role="option"
                                  aria-selected={repeatOption === option.id}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-dark-text dark:text-dark-text">{option.label}</span>
                                    {sublabel && (
                                      <span className="text-xs text-dark-text/50 dark:text-dark-text/50">{sublabel}</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
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

}; // Add missing closing curly brace for the CommandBar component function

// Use memo to prevent unnecessary re-renders of the entire component
export default memo(forwardRef(CommandBar));