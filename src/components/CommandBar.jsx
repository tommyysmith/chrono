'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { format, addHours, parse, isToday, isTomorrow, isYesterday, getDate, isSameDay } from 'date-fns';
import { TAG_COLORS } from '../constants/colors';
import { Clock } from '../assets/icons/Clock';
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';
import { Return } from '../assets/icons/Return';
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
import { Shift } from '../assets/icons/Shift';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RRule, Weekday } from 'rrule'; // Import RRule and Weekday
import RecurrenceModal from './RecurrenceModal'; // Import RecurrenceModal

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
  { id: 'yearly', label: 'Every year', sublabel: 'on Dec 30' },
  { id: 'custom', label: 'Custom...' } // Add Custom option
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
    console.log('formatDateToNatural input:', dateStr);
    if (!dateStr) {
      console.error('Invalid date string provided to formatDateToNatural');
      return 'Invalid date';
    }
    try {
      const date = new Date(dateStr);
      console.log('Parsed date:', date);
      if (isNaN(date.getTime())) {
        console.error('Invalid date object created from:', dateStr);
        return 'Invalid date';
      }
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'EEEE, MMMM d');
    } catch (error) {
      console.error('Error in formatDateToNatural:', error);
      return 'Invalid date';
    }
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
  const [taskRepeatOption, setTaskRepeatOption] = useState('none');
  const [isTaskRepeatDropdownOpen, setIsTaskRepeatDropdownOpen] = useState(false);
  const [taskRepeatSeriesId, setTaskRepeatSeriesId] = useState(null);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  // State for custom task recurrence rule
  const [taskRruleOptions, setTaskRruleOptions] = useState(null);
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
    endDate: format(new Date(), 'yyyy-MM-dd'), // Add end date for multi-day events
    startTime: '09:00',
    endTime: '10:00',
    isAllDay: false,
    isMultiDay: false, // Add multi-day flag
    color: '#808080',
    repeat: 'none',
    seriesId: null,
    rruleOptions: null // Add rruleOptions to event state
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
  // State for recurrence modal
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

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
      endDate: format(new Date(), 'yyyy-MM-dd'), // Reset end date
      startTime: '09:00',
      endTime: '10:00',
      isAllDay: false,
      isMultiDay: false, // Reset multi-day flag
      color: '#808080',
      repeat: 'none',
      seriesId: null,
      rruleOptions: null // Reset rruleOptions
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
    setTaskRepeatOption('none'); // Reset task repeat option
    setIsTaskRepeatDropdownOpen(false); // Reset task repeat dropdown state
    setTaskRepeatSeriesId(null); // Reset task repeat series ID
    setTaskRruleOptions(null); // Reset task custom rule
    setIsRecurrenceModalOpen(false); // Close recurrence modal if open
    
    onClose();
  }, [onClose]);

  const openForEdit = useCallback((event) => {
    // Create a deep copy of the event to avoid reference issues
    const eventCopy = {
      ...event,
      start: new Date(event.start),
      end: new Date(event.end)
    };

    // Check both allDay and isAllDay properties to ensure compatibility
    const isAllDayEvent = eventCopy.allDay || eventCopy.isAllDay || false;

    const eventData = {
      title: eventCopy.title || '',
      description: eventCopy.description || '',
      date: format(eventCopy.start, 'yyyy-MM-dd'),
      endDate: format(eventCopy.end, 'yyyy-MM-dd'), // Load end date
      startTime: format(eventCopy.start, 'HH:mm'),
      endTime: format(eventCopy.end, 'HH:mm'),
      isAllDay: isAllDayEvent,
      isMultiDay: !isSameDay(eventCopy.start, eventCopy.end), // Determine if it's a multi-day event
      color: eventCopy.color || '#808080',
      repeat: eventCopy.repeat || 'none',
      seriesId: eventCopy.seriesId || null,
      rruleOptions: eventCopy.rruleOptions || null, // Load rruleOptions
      isRepeat: eventCopy.isRepeat || false,
      // Preserve all metadata flags from the original event
      _editScope: eventCopy._editScope || 'single',
      _seriesUpdate: eventCopy._seriesUpdate || false,
      _futureUpdate: eventCopy._futureUpdate || false,
      _repeatChanged: eventCopy._repeatChanged || (!eventCopy?.repeat && eventState.repeat && eventState.repeat !== 'none'),
      _originalSeriesId: eventCopy._originalSeriesId || eventCopy.seriesId,
      _originalEvent: eventCopy._originalEvent || eventCopy,
      _exactPosition: {
        start: new Date(eventCopy.start),
        end: new Date(eventCopy.end)
      },
      // Preserve repeat properties for series updates
      _preserveRepeat: eventCopy._preserveRepeat || false,
      // Force series update if this is a series edit
      _forceSeriesUpdate: eventCopy._seriesUpdate || false
    };

    // Set both the original state and event state
    setOriginalEventState(eventCopy);
    setEventState(eventData);
    setSelectedColor(eventCopy.color || '#808080');
    setIsAddingEvent(true);
    setHasChanges(false);
    setPreviewEvent({
      ...eventCopy,
      _isPreview: true
    });
  }, []);

  const handleEventChange = useCallback((field, value) => {
    console.log(`handleEventChange: ${field} = ${value}`);
    setEventState(prev => {
      let processedValue = value;
      // Round time values if the field is startTime or endTime
      if (field === 'startTime' || field === 'endTime') {
        processedValue = roundToNearest15Min(value);
      }
      
      // Ensure minimum 15-min gap if changing times
      let newStartTime = field === 'startTime' ? processedValue : prev.startTime;
      let newEndTime = field === 'endTime' ? processedValue : prev.endTime;
      
      if (field === 'startTime') {
        newEndTime = ensureMinimumGap(newStartTime, newEndTime);
      } else if (field === 'endTime') {
        // If setting endTime earlier than startTime + 15 min, adjust startTime?
        // Or just rely on ensureMinimumGap called when startTime changes?
        // For now, let ensureMinimumGap handle it when startTime is set.
        // We might need more robust logic if users can directly set end time before start + 15.
      }
      
      // If toggling isMultiDay on, ensure endDate is set
      if (field === 'isMultiDay' && value === true && (!prev.endDate || prev.endDate === 'Invalid Date')) {
        console.log('Setting endDate in handleEventChange to match date:', prev.date);
        processedValue = true;
        // Make sure endDate is at least the same as the start date
        prev = { ...prev, endDate: prev.date };
      }
      
      // Update the state
      const newState = { 
          ...prev, 
          [field]: processedValue, 
          // Also update the potentially adjusted opposite time field
          ...(field === 'startTime' && { endTime: newEndTime }),
          ...(field === 'endTime' && { startTime: newStartTime }) // Keep startTime if endTime adjusted it
      };

      console.log('New event state:', newState);

      // Compare with original state to determine if there are changes
      const hasChanges = Object.keys(newState).some(key => {
        // Skip internal properties starting with _
        if (key.startsWith('_')) return false;
        // Handle date comparison specially
        if (key === 'date') {
          const prevDate = format(originalEventState?.start || new Date(), 'yyyy-MM-dd');
          return newState[key] !== prevDate;
        }
        // Handle time comparison specially
        if (key === 'startTime') {
          const prevTime = format(originalEventState?.start || new Date(), 'HH:mm');
          return newState[key] !== prevTime;
        }
        if (key === 'endTime') {
          const prevTime = format(originalEventState?.end || new Date(), 'HH:mm');
          return newState[key] !== prevTime;
        }
        return newState[key] !== (originalEventState?.[key] || '');
      });
      setHasChanges(hasChanges);
      return newState;
    });
  }, [originalEventState, roundToNearest15Min, ensureMinimumGap]);

  const handleSaveChanges = useCallback(() => {
    if (!hasChanges) return;

    const eventData = {
      id: originalEventState?.id,
      title: eventState.title.trim(),
      description: eventState.description,
      start: eventState.isAllDay || eventState.isMultiDay ? parse(`${eventState.date} 00:00`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.date} ${eventState.startTime}`, 'yyyy-MM-dd HH:mm', new Date()),
      end: eventState.isMultiDay 
        ? (eventState.isAllDay ? parse(`${eventState.endDate} 23:59`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.endDate} ${eventState.endTime}`, 'yyyy-MM-dd HH:mm', new Date()))
        : (eventState.isAllDay ? parse(`${eventState.date} 23:59`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.date} ${eventState.endTime}`, 'yyyy-MM-dd HH:mm', new Date())),
      allDay: eventState.isAllDay || eventState.isMultiDay,
      isAllDay: eventState.isAllDay || eventState.isMultiDay,
      isMultiDay: eventState.isMultiDay,
      repeat: eventState.repeat,
      rruleOptions: eventState.rruleOptions,
      seriesId: eventState.seriesId,
      color: eventState.color,
      // Ensure we keep the original repeat properties if this is a series update
      isRepeat: originalEventState?.isRepeat || false,
      // Preserve all edit scope flags from the original event
      _editScope: originalEventState?._editScope || 'single',
      _seriesUpdate: originalEventState?._seriesUpdate || false,
      _futureUpdate: originalEventState?._futureUpdate || false,
      _repeatChanged: originalEventState?._repeatChanged || (!originalEventState?.repeat && eventState.repeat && eventState.repeat !== 'none'),
      _originalSeriesId: originalEventState?._originalSeriesId || originalEventState?.seriesId,
      _originalEvent: originalEventState?._originalEvent || originalEventState,
      _exactPosition: {
        start: eventState.isAllDay || eventState.isMultiDay ? parse(`${eventState.date} 00:00`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.date} ${eventState.startTime}`, 'yyyy-MM-dd HH:mm', new Date()),
        end: eventState.isMultiDay 
          ? (eventState.isAllDay ? parse(`${eventState.endDate} 23:59`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.endDate} ${eventState.endTime}`, 'yyyy-MM-dd HH:mm', new Date()))
          : (eventState.isAllDay ? parse(`${eventState.date} 23:59`, 'yyyy-MM-dd HH:mm', new Date()) : parse(`${eventState.date} ${eventState.endTime}`, 'yyyy-MM-dd HH:mm', new Date()))
      },
      // Preserve repeat properties for series updates
      _preserveRepeat: originalEventState?._preserveRepeat || false,
      // Force series update if this is a series edit
      _forceSeriesUpdate: originalEventState?._seriesUpdate || false
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
    setTaskRepeatOption(task.repeat || 'none');
    setTaskRepeatSeriesId(task.seriesId || null);
    setTaskRruleOptions(task.rruleOptions || null); // Load task rrule options
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
        endDate: format(startTime, 'yyyy-MM-dd'), // Initialize end date
        startTime: format(startTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        isMultiDay: false, // Initialize multi-day flag
        color: '#3B82F6',
        repeat: 'none',
        seriesId: null,
        rruleOptions: null // Init rruleOptions for new event
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
        endDate: format(roundedTime, 'yyyy-MM-dd'), // Initialize end date
        startTime: roundedTimeStr,
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        isMultiDay: false, // Initialize multi-day flag
        color: '#3B82F6',
        repeat: 'none',
        seriesId: null,
        rruleOptions: null // Init rruleOptions for new event
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
    if (option !== 'custom') {
      handleEventChange('rruleOptions', null); // Clear custom rule if selecting preset
    }
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
      endDate: format(now, 'yyyy-MM-dd'), // Initialize end date to same as start date
      startTime: roundedTimeStr,
      endTime: format(endTime, 'HH:mm'),
      isAllDay: false,
      isMultiDay: false, // Initialize multi-day flag
      color: '#3B82F6',
      repeat: 'none',
      seriesId: null,
      rruleOptions: null // Init rruleOptions for new event
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
      
      // Check if the repeat option has changed for an existing task
      const repeatChanged = taskToEdit && taskToEdit.repeat !== taskRepeatOption;
      
      // Generate a series ID for recurring tasks if needed
      const seriesId = taskRepeatOption !== 'none' 
        ? (taskRepeatSeriesId || `series_${Date.now().toString()}`)
        : null;

      if (editingTaskId) {
        // Update existing task
        const updatedTask = {
          ...taskToEdit,
          id: editingTaskId,
          title: taskTitle.trim(),
          notes: taskNotes.trim(),
          tag: finalTag,
          scheduledDate: scheduledDate?.toISOString(),
          updatedAt: new Date().toISOString(),
          repeat: taskRepeatOption,
          rruleOptions: taskRruleOptions, // Include task rrule options
          seriesId: seriesId,
          isRepeat: false // Base task is never a repeat instance
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
          createdAt: new Date().toISOString(),
          repeat: taskRepeatOption,
          rruleOptions: taskRruleOptions, // Include task rrule options
          seriesId: seriesId,
          isRepeat: false // Base task is never a repeat instance
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
      
      // Dispatch a custom event for in-app components to listen for
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: updatedTasks }
      }));
      
      // Trigger a storage event to notify other components about the change
      // This is particularly important for AgendaView to refresh recurring tasks
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(updatedTasks),
        url: window.location.href
      }));

      // Reset form and states
      setTaskTitle('');
      setTaskNotes('');
      setSelectedTag(null);
      setPendingNewTag(null);
      setDraftTag(null);
      setTagSearchText('');
      setScheduledDate(null);
      setTaskRepeatOption('none');
      setTaskRepeatSeriesId(null);
      setTaskRruleOptions(null); // Reset task custom rule state
      setIsAddingTask(false);
      setEditingTaskId(null);
      setTaskToEdit(null);
      handleClose();
    } catch (error) {
      console.error('Error saving task:', error);
      // You might want to show an error message to the user here
    }
  }, [taskTitle, taskNotes, selectedTag, pendingNewTag, scheduledDate, taskRepeatOption, taskRepeatSeriesId, taskRruleOptions, tags, editingTaskId, taskToEdit, onCreateTask, onUpdateTask, handleClose, dispatchTagsUpdated]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      // Handle escape key - use the same flow as clicking discard
      handleClose();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Handle enter key - use the same flow as clicking save
      if (isAddingEvent) {
        handleSaveChanges();
      } else if (isAddingTask) {
        handleSaveTask();
      }
    } else if (e.key === 'T' && e.shiftKey && !isAddingEvent && !isAddingTask && !isGoToDateMode) {
      e.preventDefault();
      // Handle Shift+T - use the same flow as clicking the Task button
      setIsAddingTask(true);
      setIsOpen(true);
    } else if (e.key === 'E' && e.shiftKey && !isAddingEvent && !isAddingTask && !isGoToDateMode) {
      e.preventDefault();
      // Handle Shift+E - use the same flow as clicking the Event button
      handleAddEventClick();
      setIsOpen(true);
    }
  }, [
    handleClose,
    handleSaveChanges,
    handleSaveTask,
    handleAddEventClick,
    isAddingEvent,
    isAddingTask,
    isGoToDateMode,
    taskRruleOptions, // Add dependency
    eventState.rruleOptions // Add dependency
  ]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handler for saving custom recurrence rule from modal
  const handleSaveRecurrenceRule = useCallback((newOptions) => {
    if (isAddingEvent) {
      handleEventChange('repeat', 'custom');
      handleEventChange('rruleOptions', newOptions);
    } else if (isAddingTask) {
      setTaskRepeatOption('custom');
      setTaskRruleOptions(newOptions);
    }
    setIsRecurrenceModalOpen(false);
  }, [isAddingEvent, isAddingTask, handleEventChange]);

  // Function to get display text for repeat option
  const getRepeatDisplayText = (repeatValue, rruleOptions) => {
    if (repeatValue === 'custom' && rruleOptions) {
      try {
        // Clone options to avoid modifying original
        const options = {...rruleOptions};
        
        // Convert weekday objects to RRule Weekday instances if needed
        if (options.byweekday) {
          options.byweekday = options.byweekday.map(day => {
            if (day instanceof Weekday) return day;
            if (typeof day === 'number') return new Weekday(day);
            if (day.weekday !== undefined) return new Weekday(day.weekday);
            return RRule[day]; // Fallback to RRule constants
          });
        }
        
        const rule = new RRule(options);
        return rule.toText();
      } catch (e) {
        console.error("Error parsing rrule options:", e);
        return "Custom"; // Fallback text
      }
    }
    return REPEAT_OPTIONS.find(option => option.id === repeatValue)?.label || 'Does not repeat';
  };

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
                            <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
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
                              <div className="flex items-center text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text gap-2 px-4 py-4 border-b h-[56px] border-light-border dark:border-dark-border cursor-pointer">
                              <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                                <PopoverTrigger asChild>
                                <div className="flex items-center w-full gap-2">
                                  <CalendarIcon className="w-4 h-4" />
                                  <span className="text-sm">{scheduledDate ? format(scheduledDate, 'MMM d') : 'Schedule'}</span>
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
                                
                                  className="w-auto ml-4 mt-3 p-0 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border shadow-lg"
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
                              <button className="flex items-center gap-2 px-4 h-[56px] border-b border-light-border dark:border-dark-border text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text text-sm transition-colors">
                                <Pin className="w-4 h-4" />
                                <span>Add a location</span>
                              </button>
                              <div className="flex items-center px-4 h-[56px] text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text text-sm transition-colors cursor-pointer">
                                <Popover open={isTaskRepeatDropdownOpen} onOpenChange={setIsTaskRepeatDropdownOpen}>
                                  <PopoverTrigger className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                      <Repeat className="w-4 h-4" />
                                      <span className={`${taskRepeatOption === 'none' ? '' : 'text-light-text dark:text-dark-text'}`}>
                                        {getRepeatDisplayText(taskRepeatOption, taskRruleOptions)}
                                      </span>
                                    </div>
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
                                          const date = scheduledDate || new Date(); // Use scheduledDate or fallback to today
                                          const dayOfWeek = format(date, 'EEE');
                                          sublabel = `on ${dayOfWeek}`;
                                        } else if (option.id === 'monthly') {
                                          const date = scheduledDate || new Date(); // Use scheduledDate or fallback to today
                                          const dayOfMonth = format(date, 'do');
                                          sublabel = `on the ${dayOfMonth}`;
                                        } else if (option.id === 'monthlyWeekday') {
                                          const date = scheduledDate || new Date(); // Use scheduledDate or fallback to today
                                          const dayOfMonth = getDate(date);
                                          const weekNum = Math.ceil(dayOfMonth / 7);
                                          const dayOfWeek = format(date, 'EEE');
                                          const ordinal = weekNum === 1 ? '1st' : weekNum === 2 ? '2nd' : weekNum === 3 ? '3rd' : `${weekNum}th`;
                                          sublabel = `on the ${ordinal} ${dayOfWeek}`;
                                        } else if (option.id === 'monthlyLastWeekday') {
                                          const date = scheduledDate || new Date(); // Use scheduledDate or fallback to today
                                          const dayOfWeek = format(date, 'EEE');
                                          sublabel = `on the last ${dayOfWeek}`;
                                        } else if (option.id === 'yearly') {
                                          const date = scheduledDate || new Date(); // Use scheduledDate or fallback to today
                                          const monthDay = format(date, 'MMM d');
                                          sublabel = `on ${monthDay}`;
                                        }
                                        
                                        return (
                                          <button
                                            key={option.id}
                                            type="button"
                                            className={`px-2 py-2 text-xs flex items-center flex-row font-semibold rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${taskRepeatOption === option.id ? 'font-semibold' : ''}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (option.id === 'custom') {
                                                setIsRecurrenceModalOpen(true); // Open modal
                                                setIsTaskRepeatDropdownOpen(false); // Close popover
                                              } else {
                                                setTaskRepeatOption(option.id);
                                                setTaskRruleOptions(null); // Clear custom rule if selecting preset
                                                setIsTaskRepeatDropdownOpen(false);
                                              }
                                            }}
                                            role="option"
                                            aria-selected={taskRepeatOption === option.id}
                                          >
                                            <div className="flex w-full justify-between items-center">
                                              <span className={`text-xs text-dark-text/50 dark:text-dark-text/50 ${taskRepeatOption === option.id ? 'font-semibold !text-dark-text dark:!text-dark-text' : ''}`}>{option.label}</span>
                                              {sublabel && (
                                                <span className="text-xs text-dark-text/30 font-medium dark:text-dark-text/30">{sublabel}</span>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="flex items-center justify-end gap-2 px-4 py-4">
                          <button
                            onClick={handleClose}
                            className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
                          >
                            <span className="flex items-center pl-1 pr-3">Discard</span>
                            <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
                              <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
                            </div>
                          </button>
                          <button
                            onClick={handleSaveTask}
                            disabled={!taskTitle.trim()}
                            className={`px-2 py-2 text-xs flex items-center flex-row font-semibold rounded-[5px] ${taskTitle.trim() 
                              ? 'bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] text-dark-text dark:text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)] shadow-sm' 
                              : 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
                          >
                            <span className="flex items-center pl-1 pr-3">{editingTaskId ? 'Edit task' : 'Add task'}</span>
                            <div className={`flex items-center px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 p-1 rounded-[5px] ${taskTitle.trim() ? 'text-dark-text dark:text-dark-text bg-white/10' : 'bg-black/5 text-light-text/30 dark:text-dark-text/30 bg-black/5'}`}>
                              <Return className="w-3 h-3" />
                            </div>
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
                              <div className="w-7 h-4 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:shadow-sm after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                            <span className="text-xs text-light-text/50 dark:text-dark-text/50">All day</span>
                          </div>
                        </div>
                      </div>

                      {/* Date Section */}
                      <div className="flex items-top gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                        <div className="w-5 h-5 flex items-center justify-center">
                          <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                        </div>
                        <div className="flex flex-col gap-1 w-full">
                          {/* Date inputs row */}
                          <div className="flex items-center h-[24px] gap-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <div className="flex items-center cursor-pointer">
                                  <input
                                    type="date"
                                    value={eventState.date}
                                    onChange={(e) => handleEventChange('date', e.target.value)}
                                    className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-auto cursor-pointer focus:ring-0 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                                  />
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
                            
                            {/* Only show arrow and end date when multi-day is enabled */}
                            {eventState.isMultiDay && (
                              <>
                                <span className="text-light-text/50 dark:text-dark-text/50">→</span>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="flex items-center cursor-pointer">
                                      <input
                                        type="date"
                                        value={eventState.endDate || eventState.date}
                                        onChange={(e) => handleEventChange('endDate', e.target.value)}
                                        className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 w-auto cursor-pointer focus:ring-0 focus:outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                                      />
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0 bg-dark-bg-lighter dark:bg-dark border border-light-border dark:border-dark-border rounded-lg shadow-lg">
                                    <Calendar
                                      mode="single"
                                      selected={new Date(eventState.endDate || eventState.date)}
                                      onSelect={(date) => date && handleEventChange('endDate', format(date, 'yyyy-MM-dd'))}
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </>
                            )}
                          </div>
                          
                          {/* Date labels row */}
                          <div className="flex items-center h-[24px] gap-2">
                            <span className="text-sm text-light-text/50 dark:text-dark-text/50">
                              {formatDateToNatural(eventState.date)}
                            </span>
                            
                            {/* Only show end date label when multi-day is enabled */}
                            {eventState.isMultiDay && (
                              <>
                                <span className="text-light-text/50 dark:text-dark-text/50 mx-1">-</span>
                                <span className="text-sm text-light-text/50 dark:text-dark-text/50">
                                  {formatDateToNatural(eventState.endDate || eventState.date)}
                                </span>
                              </>
                            )}
                          </div>
                          
                          {/* Multi-day toggle */}
                          <div className="flex items-center h-[24px] gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={eventState.isMultiDay}
                                onChange={(e) => {
                                  console.log('Multi-day toggle changed:', e.target.checked);
                                  console.log('Current eventState:', eventState);
                                  // Ensure endDate is valid when enabling multi-day
                                  if (e.target.checked && (!eventState.endDate || eventState.endDate === 'Invalid Date')) {
                                    console.log('Setting endDate to match start date');
                                    handleEventChange('endDate', eventState.date);
                                  }
                                  handleEventChange('isMultiDay', e.target.checked);
                                }}
                              />
                              <div className="w-7 h-4 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:shadow-sm after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                            <span className="text-xs text-light-text/50 dark:text-dark-text/50">Multi-day</span>
                          </div>
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
                              <span className={`text-sm font-medium ${eventState.repeat === 'none' ? 'text-light-text/50 dark:text-dark-text/50' : 'text-light-text dark:text-dark-text'}`}>
                                {getRepeatDisplayText(eventState.repeat, eventState.rruleOptions)}
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
                                      className={`px-2 py-2 text-xs flex items-center flex-row font-semibold rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${eventState.repeat === option.id ? 'font-semibold' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (option.id === 'custom') {
                                          setIsRecurrenceModalOpen(true); // Open modal
                                          setIsRepeatDropdownOpen(false); // Close popover
                                        } else {
                                          handleEventChange('repeat', option.id);
                                          handleEventChange('rruleOptions', null); // Clear custom rule
                                          setIsRepeatDropdownOpen(false);
                                        }
                                      }}
                                      role="option"
                                      aria-selected={eventState.repeat === option.id}
                                    >
                                      <div className="flex w-full justify-between items-center">
                                        <span className={`text-xs text-dark-text/50 dark:text-dark-text/50 ${eventState.repeat === option.id ? 'font-semibold !text-dark-text dark:!text-dark-text' : ''}`}>{option.label}</span>
                                        {sublabel && (
                                          <span className="text-xs text-dark-text/30 font-medium dark:text-dark-text/30">{sublabel}</span>
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
                    <div className="flex items-center justify-end gap-3 px-4 py-4">
                      <button
                        onClick={() => handleClose()}
                        className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
                      >
                        <span className="flex items-center pl-1 pr-3">Discard</span>
                        <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
                          <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
                        </div>
                      </button>
                      
                      <button
                        onClick={handleSaveChanges}
                        disabled={!eventState.title.trim() || !hasChanges}
                        className={`px-2 flex items-center flex-row py-2 text-xs font-semibold rounded-[5px] ${eventState.title.trim() && hasChanges
                          ? 'bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] text-dark-text dark:text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)] shadow-sm' 
                          : 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
                      >
                        <span className="text-xs pl-1 pr-3 ">
                          
                        {originalEventState?.id ? 'Edit event' : 'Add event'}
                        
                        </span>
                        <div className={`flex items-center px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 p-1 rounded-[5px] ${eventState.title.trim() && hasChanges ? 'text-dark-text dark:text-dark-text bg-white/10' : 'bg-black/5 text-light-text/30 dark:text-dark-text/30 bg-black/5'}`}>
                              <Return className="w-3 h-3" />
                            </div>
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

    {/* Recurrence Modal */}
    <RecurrenceModal
      isOpen={isRecurrenceModalOpen}
      onOpenChange={setIsRecurrenceModalOpen}
      initialValue={isAddingEvent ? eventState.rruleOptions : taskRruleOptions}
      onSave={handleSaveRecurrenceRule}
      startDate={isAddingEvent ? parse(eventState.date, 'yyyy-MM-dd', new Date()) : scheduledDate || new Date()}
    />
  </div>
);

}; 

// Use memo to prevent unnecessary re-renders of the entire component
export default memo(forwardRef(CommandBar));