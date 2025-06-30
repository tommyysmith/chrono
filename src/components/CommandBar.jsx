'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useMeasure } from '@uidotdev/usehooks';
// Add addDays, isBefore, isEqual imports
import { format, addHours, parse, isToday, isTomorrow, isYesterday, getDate, isSameDay, addDays, isBefore, isEqual, differenceInMilliseconds, add, parseISO } from 'date-fns';
import { TAG_COLORS } from '../constants/colors';
import { Clock } from '../assets/icons/Clock';
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';
import { Return } from '../assets/icons/Return';
import { User } from '../assets/icons/User';
import { Flag } from '../assets/icons/Flag';
import { None } from '../assets/icons/None';
import { Low } from '../assets/icons/Low';
import { Medium } from '../assets/icons/Medium';
import { High } from '../assets/icons/High';
import { Repeat } from '../assets/icons/Repeat';
import { Add } from '../assets/icons/Add';
import { Chevron } from '../assets/icons/Chevron';
import { Microphone } from '../assets/icons/Microphone';
import { Tomorrow } from '../assets/icons/Tomorrow';
import { Soon } from '../assets/icons/Soon';
import { Anytime } from '../assets/icons/Anytime';
import { Check } from '../assets/icons/Check';
import { Calendar } from '@/components/ui/calendar';
import { Task } from '../assets/icons/Task';
import { Tag } from '../assets/icons/Tag';
import { ArrowAlt } from '../assets/icons/ArrowAlt';
import { Lightning } from '../assets/icons/Lightning'
import { Trash } from '../assets/icons/Trash'
import RepeatEditModal from './RepeatEditModal';
import RepeatTaskEditModal from './RepeatTaskEditModal';
import GoToDateCommand from './GoToDateCommand';

import { parseNaturalLanguage } from '../utils/dateUtils';
import { Shift } from '../assets/icons/Shift';
import { Completed } from '../assets/icons/Completed';

// Helper function to get default event color
const getDefaultEventColor = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('defaultEventColor') || '#F59E0B';
  }
  return '#F59E0B';
};
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { RRule, Weekday } from 'rrule'; // Import RRule and Weekday
import RecurrenceModal from './RecurrenceModal'; // Import RecurrenceModal

const SCHEDULE_OPTIONS = [
  { id: 'anytime', label: 'Anytime', icon: Anytime, color: '#6B7280' },
  { id: 'today', label: 'Today', icon: CalendarIcon, color: '#EF4444' },
  { id: 'tomorrow', label: 'Tomorrow', icon: Tomorrow, color: '#3B82F6' },
  { id: 'nextWeek', label: 'Next week', icon: Soon, color: '#A855F7' },
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

const PRIORITY_OPTIONS = [
  { id: 'High', label: 'High', color: '#EF4444' },
  { id: 'Medium', label: 'Medium', color: getDefaultEventColor() },
  { id: 'Low', label: 'Low', color: '#10B981' },
  { id: 'None', label: 'None', color: '#6B7280' }
];

// Helper function to get the appropriate priority icon
const getPriorityIcon = (priorityId) => {
  switch (priorityId) {
    case 'High':
      return High;
    case 'Medium':
      return Medium;
    case 'Low':
      return Low;
    case 'None':
    default:
      return None;
  }
};

// Helper function to generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const date = new Date();
      date.setHours(h, m);
      const value = format(date, 'HH:mm'); // 24-hour format for internal value
      const label = format(date, 'h:mm a'); // 12-hour format for display
      options.push({ value, label });
    }
  }
  return options;
};

const ALL_TIME_OPTIONS = generateTimeOptions();

// Helper to parse flexible time input
const parseTimeString = (timeStr) => {
  if (!timeStr) return null;
  try {
    // Attempt parsing common formats
    let parsedDate = parse(timeStr, 'h:mm a', new Date()); // 1:30 PM
    if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

    parsedDate = parse(timeStr, 'ha', new Date()); // 1PM
    if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

    parsedDate = parse(timeStr, 'h a', new Date()); // 1 PM
     if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

    parsedDate = parse(timeStr, 'HH:mm', new Date()); // 13:30
    if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

    parsedDate = parse(timeStr, 'H:mm', new Date()); // 3:30
     if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

     parsedDate = parse(timeStr, 'H', new Date()); // 3
     if (!isNaN(parsedDate)) return format(parsedDate, 'HH:mm');

    // Add more formats if needed

    return null; // Return null if parsing fails
  } catch (e) {
    console.error("Error parsing time string:", e);
    return null;
  }
};

// Add new tab component
const TabSelector = ({ activeTab, onTabChange, ...props }) => {
  const tabVariants = {
    initial: {
      opacity: 0,
      y: -10,
      scale: 0.95
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: "easeOut",
        staggerChildren: 0.1
      }
    },
    exit: {
      opacity: 0,
      x: -10,
      scale: 0.95,
      transition: {
        duration: 0.2,
        ease: "easeIn"
      }
    }
  };

  const buttonVariants = {
    initial: {
      opacity: 0
    },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.2,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div 
      variants={tabVariants}
      className="flex items-center justify-center gap-1"
    >
      <TooltipProvider delayDuration={500}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              variants={buttonVariants}
              onClick={() => onTabChange('task')}
              className={`flex items-center gap-1 px-2 py-2 text-sm font-medium rounded-[5px] transition-all ${
                activeTab === 'task'
                  ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text'
                  : 'text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text '
              }`}
            >
              <Completed className="w-4 h-4" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            Task
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              variants={buttonVariants}
              onClick={() => onTabChange('event')}
              className={`flex items-center gap-1 px-2 py-2 text-sm font-medium rounded-[6px] transition-all ${
                activeTab === 'event'
                  ? 'bg-light-bg-lighter dark:bg-white/5 text-light-text dark:text-dark-text'
                  : 'text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            Event
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </motion.div>
  );
};

const CommandBar = ({ onPrevious, onNext, onToday, onCreateEvent, onUpdateEvent, onCreateTask, onUpdateTask, onToggleTaskCompletion, onClose, onDateSelect, onOpenSettings, isDraggingTask = false }, ref) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleOption, setScheduleOption] = useState('anytime');
  const [isGoToDateMode, setIsGoToDateMode] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  // Multi-select state for tasks
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // Multi-select schedule state
  const [isMultiSelectScheduleOpen, setIsMultiSelectScheduleOpen] = useState(false);
  const [isMultiSelectPriorityOpen, setIsMultiSelectPriorityOpen] = useState(false);
  const [isMultiSelectTagOpen, setIsMultiSelectTagOpen] = useState(false);
  const [pendingScheduleDate, setPendingScheduleDate] = useState(null);
  const [recurringTasksInSelection, setRecurringTasksInSelection] = useState([]);
  const [currentRecurringTaskIndex, setCurrentRecurringTaskIndex] = useState(0);
  const [isRepeatTaskEditModalOpen, setIsRepeatTaskEditModalOpen] = useState(false);
  const [currentRecurringTask, setCurrentRecurringTask] = useState(null);
  const [recurringTaskScopes, setRecurringTaskScopes] = useState(new Map());
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
    if (!dateStr) {
      console.error('Invalid date string provided to formatDateToNatural');
      return 'Invalid date';
    }
    try {
      const date = new Date(dateStr);
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
  
  // Derive active tab from component state instead of managing separate state
  const activeTab = useMemo(() => {
    if (isAddingEvent) return 'event';
    if (isAddingTask) return 'task';
    return 'task'; // Default to task when in default state
  }, [isAddingEvent, isAddingTask]);
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
  // Priority state
  const [taskPriority, setTaskPriority] = useState('None');
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
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

  // Listen for tags-updated events from other components
  useEffect(() => {
    const handleTagsUpdated = (event) => {
      if (event.detail) {
        setTags(event.detail);
      }
    };

    window.addEventListener('tags-updated', handleTagsUpdated);
    return () => {
      window.removeEventListener('tags-updated', handleTagsUpdated);
    };
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
    color: getDefaultEventColor(),
    repeat: 'none',
    seriesId: null,
    rruleOptions: null, // Add rruleOptions to event state
    _preservedStartTime: '09:00', // Store original start time when all-day is enabled
    _preservedEndTime: '10:00' // Store original end time when all-day is enabled
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [repeatOption, setRepeatOption] = useState('none');
  const [repeatSeriesId, setRepeatSeriesId] = useState(null); // Track series ID
  const [isRepeatDropdownOpen, setIsRepeatDropdownOpen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultEventColor') || '#F59E0B';
    }
    return '#F59E0B';
  });
  const [editMode, setEditMode] = useState(null);
  const [showRepeatEditModal, setShowRepeatEditModal] = useState(false);
  // Removed manual animation state management - let Framer Motion handle it naturally
  // State for recurrence modal
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  // State for time pickers
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const [startTimeSearch, setStartTimeSearch] = useState('');
  const [endTimeSearch, setEndTimeSearch] = useState('');

  // Default event color state
  const [currentDefaultColor, setCurrentDefaultColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('defaultEventColor') || '#F59E0B';
    }
    return '#F59E0B';
  });

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

  const containerRef = useRef(null);
  const repeatDropdownRef = useRef(null);
  const colorPickerRef = useRef(null);
  const titleInputRef = useRef(null);
  const datePickerRef = useRef(null);

  const animationInProgressRef = useRef(false);
  const previousContentKeyRef = useRef(null);

  // Direction helper function for smooth transitions
  const getDirection = (current, previous) => {
    if (!previous || !current) return 0;
    const contentOrder = ['default', 'task', 'event'];
    const currentIndex = contentOrder.indexOf(current);
    const previousIndex = contentOrder.indexOf(previous);
    return currentIndex > previousIndex ? 1 : -1;
  };

  // Content animation variants with direction awareness
  const contentVariants = {
    initial: ({ direction, isInitial }) => ({
      opacity: 0
    }),
    animate: () => ({
      opacity: 1
    }),
    exit: ({ direction, isInitial, isCollapsing }) => ({
      opacity: isCollapsing ? 0 : 1,
      transition: {
        opacity: {
          type: "spring",
          bounce: 0,
          duration: isCollapsing ? 0 : 0.6
        }
      }
    })
  };

  // Compute active content key based on state
  const activeContentKey = useMemo(() => {
    if (selectedTasks.size > 0 && !isAddingEvent && !isAddingTask && !isGoToDateMode) return 'multiselect';
    if (isAddingEvent) return 'event';
    if (isAddingTask) return 'task';
    if (isGoToDateMode) return 'go-to-date';
    return 'default';
  }, [isAddingEvent, isAddingTask, isGoToDateMode, selectedTasks.size]);

  // Update previous content key ref
  useEffect(() => {
    previousContentKeyRef.current = activeContentKey;
  }, [activeContentKey]);

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
  
  // New state variables for jakub.kr approach
  const [contentRef, contentBounds] = useMeasure();
  const [direction, setDirection] = useState(0);
  const [previousContentKey, setPreviousContentKey] = useState(null);
  
  // Base height for the command bar (when in default state)
  const BASE_HEIGHT = 52;

  // Track content changes and calculate direction for animations
  useEffect(() => {
    const newContentKey = isAddingEvent ? 'event' : isAddingTask ? 'task' : isGoToDateMode ? 'go-to-date' : 'default';
    
    if (newContentKey !== activeContentKey) {
      const contentOrder = ['default', 'task', 'event', 'go-to-date'];
      const currentIndex = contentOrder.indexOf(activeContentKey);
      const newIndex = contentOrder.indexOf(newContentKey);
      
      setPreviousContentKey(activeContentKey);
      setDirection(newIndex > currentIndex ? 1 : -1);
    }
  }, [isAddingEvent, isAddingTask, isGoToDateMode, activeContentKey]);

  useEffect(() => {
    // Capture dimensions when component mounts or state changes
    if (containerRef.current && isOpen) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      previousSizeRef.current = { width, height };
    }
  }, [isOpen]);

  // Fix layout animation state tracking
  useEffect(() => {
    // Reset animation flags when component unmounts
    return () => {
      exitingRef.current = false;
    };
  }, []);

  // Listen for default event color changes
  useEffect(() => {
    const handleDefaultColorChange = (event) => {
      const newColor = event.detail;
      // Update selectedColor if it's currently the old default
      if (selectedColor === currentDefaultColor) {
        setSelectedColor(newColor);
      }
      // Update eventState color if it's currently the old default
      if (eventState.color === currentDefaultColor) {
        setEventState(prev => ({ ...prev, color: newColor }));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('default-event-color-updated', handleDefaultColorChange);
      return () => {
        window.removeEventListener('default-event-color-updated', handleDefaultColorChange);
      };
    }
  }, [selectedColor, eventState.color, currentDefaultColor]);

  // Update selectedColor when currentDefaultColor changes
  useEffect(() => {
    setSelectedColor(currentDefaultColor);
  }, [currentDefaultColor]);

  // Focus title input when entering event creation mode
  useEffect(() => {
    if (isAddingEvent && titleInputRef.current) {
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isAddingEvent]);

  // Combined keyboard shortcuts handler

  const [previewEvent, setPreviewEvent] = useState(null);

  // Selection change callbacks
  const [selectionChangeCallbacks, setSelectionChangeCallbacks] = useState(new Set());

  // Multi-select handlers
  const handleTaskSelect = useCallback((taskId, event, isCurrentlySelected) => {
    setSelectedTasks(prev => {
      const newSet = new Set(prev);
      // Toggle logic: if currently selected, remove it; if not selected, add it
      if (isCurrentlySelected) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      
      // Enable multi-select mode if tasks are selected
      setIsMultiSelectMode(newSet.size > 0);
      
      // Notify all registered callbacks
      console.log('[CommandBar] Notifying', selectionChangeCallbacks.size, 'callbacks of selection change');
      selectionChangeCallbacks.forEach(callback => {
        try {
          callback(Array.from(newSet));
        } catch (error) {
          console.error('Error in selection change callback:', error);
        }
      });
      
      return newSet;
    });
  }, [selectionChangeCallbacks]);

  const handleSelectAllTasks = useCallback((taskIds) => {
    setSelectedTasks(new Set(taskIds));
    setIsMultiSelectMode(taskIds.length > 0);
    
    // Notify all registered callbacks
    selectionChangeCallbacks.forEach(callback => {
      try {
        callback(taskIds);
      } catch (error) {
        console.error('Error in selection change callback:', error);
      }
    });
  }, [selectionChangeCallbacks]);

  const handleClearSelection = useCallback(() => {
    setSelectedTasks(new Set());
    setIsMultiSelectMode(false);
    
    // Notify all registered callbacks
    selectionChangeCallbacks.forEach(callback => {
      try {
        callback([]);
      } catch (error) {
        console.error('Error in selection change callback:', error);
      }
    });
  }, [selectionChangeCallbacks]);

  const handleBulkTaskUpdate = useCallback((updates) => {
    // Get all tasks from localStorage to retrieve full task objects
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];

    // Apply updates to all selected tasks
    selectedTasks.forEach(taskId => {
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return; // Skip if task not found

      const updatedTask = {
        ...task,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
        console.log('🔄 [MULTI-SELECT-DEBUG] Flagging recurring task instance for single update:', task.id);
      }

      onUpdateTask(updatedTask);
    });
    // Clear selection after bulk update
    handleClearSelection();
  }, [selectedTasks, onUpdateTask, handleClearSelection]);

  const handleBulkTaskComplete = useCallback(() => {
    selectedTasks.forEach(taskId => {
      onToggleTaskCompletion(taskId);
    });
    handleClearSelection();
  }, [selectedTasks, onToggleTaskCompletion, handleClearSelection]);

  // Multi-select schedule handler
  const handleMultiSelectSchedule = useCallback(() => {
    if (selectedTasks.size === 0) return;

    // Get all tasks from localStorage to check for recurring tasks
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];

    // Check which selected tasks are recurring
    const recurringTasks = [];
    const selectedTaskIds = Array.from(selectedTasks);

    selectedTaskIds.forEach(taskId => {
      const task = allTasks.find(t => t.id === taskId);
      if (task && (task.isRepeat === true || task.seriesId)) {
        recurringTasks.push(task);
      }
    });

    if (recurringTasks.length > 0) {
      // If there are recurring tasks, handle them one by one
      setRecurringTasksInSelection(recurringTasks);
      setCurrentRecurringTaskIndex(0);
      setCurrentRecurringTask(recurringTasks[0]);
      setIsRepeatTaskEditModalOpen(true);
    } else {
      // If no recurring tasks, open calendar directly
      setIsMultiSelectScheduleOpen(true);
    }
  }, [selectedTasks]);

  // Handle recurring task scope selection in multi-select
  const handleRecurringTaskScopeSelection = useCallback((scope) => {
    if (!currentRecurringTask) return;

    // Store the scope for this task
    setRecurringTaskScopes(prev => new Map(prev.set(currentRecurringTask.id, scope)));

    // Move to next recurring task or open calendar
    const nextIndex = currentRecurringTaskIndex + 1;
    if (nextIndex < recurringTasksInSelection.length) {
      setCurrentRecurringTaskIndex(nextIndex);
      setCurrentRecurringTask(recurringTasksInSelection[nextIndex]);
    } else {
      // All recurring tasks processed, close modal and open calendar
      setIsRepeatTaskEditModalOpen(false);
      setIsMultiSelectScheduleOpen(true);
    }
  }, [currentRecurringTask, currentRecurringTaskIndex, recurringTasksInSelection]);

  // Multi-select priority handler
  const handleMultiSelectPriority = useCallback(() => {
    if (selectedTasks.size === 0) return;
    setIsMultiSelectPriorityOpen(true);
  }, [selectedTasks]);

  // Handle multi-select priority selection
  const handleMultiSelectPrioritySelect = useCallback((priority) => {
    if (selectedTasks.size === 0) return;

    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];
    const selectedTaskIds = Array.from(selectedTasks);

    selectedTaskIds.forEach(taskId => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        const updatedTask = {
          ...task,
          priority: priority,
          updatedAt: new Date().toISOString()
        };

        // For recurring task instances, flag for single instance update
        if (task.isRepeat === true && task.seriesId) {
          updatedTask._editScope = 'single';
          console.log('🔄 [MULTI-SELECT-DEBUG] Flagging recurring task instance for single priority update:', task.id);
        }

        onUpdateTask(updatedTask);
      }
    });

    setIsMultiSelectPriorityOpen(false);
    handleClearSelection();
  }, [selectedTasks, onUpdateTask, handleClearSelection]);

  // Multi-select tag handler
  const handleMultiSelectTag = useCallback(() => {
    if (selectedTasks.size === 0) return;
    setIsMultiSelectTagOpen(true);
  }, [selectedTasks]);

  // Handle multi-select tag selection
  const handleMultiSelectTagSelect = useCallback((tag) => {
    if (selectedTasks.size === 0) return;

    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];
    const selectedTaskIds = Array.from(selectedTasks);

    selectedTaskIds.forEach(taskId => {
      const task = allTasks.find(t => t.id === taskId);
      if (task) {
        const updatedTask = {
          ...task,
          tag: tag, // Store the full tag object, not just the ID
          updatedAt: new Date().toISOString()
        };

        // For recurring task instances, flag for single instance update
        if (task.isRepeat === true && task.seriesId) {
          updatedTask._editScope = 'single';
          console.log('🔄 [MULTI-SELECT-DEBUG] Flagging recurring task instance for single tag update:', task.id);
        }

        onUpdateTask(updatedTask);
      }
    });

    setIsMultiSelectTagOpen(false);
    handleClearSelection();
  }, [selectedTasks, onUpdateTask, handleClearSelection]);

  // Handle multi-select delete
  const handleMultiSelectDelete = useCallback(() => {
    if (selectedTasks.size === 0) return;

    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const selectedTaskIds = Array.from(selectedTasks);

    // Remove selected tasks from all collections
    Object.keys(tasks).forEach(collection => {
      if (Array.isArray(tasks[collection])) {
        tasks[collection] = tasks[collection].filter(task => 
          !selectedTaskIds.includes(task.id)
        );
      }
    });

    // Save updated tasks to localStorage
    localStorage.setItem("tasks", JSON.stringify(tasks));
    
    // Dispatch tasks updated event
    dispatchTasksUpdated(tasks);
    
    // Clear selection
    handleClearSelection();
  }, [selectedTasks, handleClearSelection, dispatchTasksUpdated]);

  // Handle multi-select date selection
  const handleMultiSelectDateSelect = useCallback((date) => {
    if (selectedTasks.size === 0) return;

    // Get all tasks from localStorage to retrieve full task objects
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];

    const selectedTaskIds = Array.from(selectedTasks);
    const scheduledDate = date.toISOString();

    // Apply the date to all selected tasks, respecting recurring task scopes
    selectedTaskIds.forEach(taskId => {
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return; // Skip if task not found

      const scope = recurringTaskScopes.get(taskId);
      const updatedTask = {
        ...task,
        scheduledDate,
        updatedAt: new Date().toISOString()
      };

      // For recurring task instances, always flag for single instance update
      // The scope from the modal is handled separately but we need the _editScope flag
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
        console.log('🔄 [MULTI-SELECT-DEBUG] Flagging recurring task instance for single schedule update:', task.id);
      }

      if (scope) {
        // For recurring tasks, add the scope to the task object (legacy support)
        updatedTask._updateScope = scope;
      }

      // Call onUpdateTask with the complete task object
      onUpdateTask(updatedTask);
    });

    // Clean up and close
    setIsMultiSelectScheduleOpen(false);
    setRecurringTasksInSelection([]);
    setCurrentRecurringTaskIndex(0);
    setCurrentRecurringTask(null);
    setRecurringTaskScopes(new Map());
    handleClearSelection();
  }, [selectedTasks, recurringTaskScopes, onUpdateTask, handleClearSelection]);

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
      color: getDefaultEventColor(),
      repeat: 'none',
      seriesId: null,
      rruleOptions: null, // Reset rruleOptions
      _preservedStartTime: '09:00', // Reset preserved start time
      _preservedEndTime: '10:00' // Reset preserved end time
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
    setTaskPriority('None'); // Reset priority to default
    setIsPriorityDropdownOpen(false); // Reset priority dropdown state
    setIsRecurrenceModalOpen(false); // Close recurrence modal if open
    // Reset schedule-related fields
    setIsScheduleOpen(false); // Reset schedule dropdown state
    setScheduleOption('anytime'); // Reset schedule option to default
    // Reset multi-select state
    handleClearSelection();
    setIsScheduling(false); // Reset scheduling state
    setScheduledDate(null); // Reset scheduled date
    
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
      color: eventCopy.color || getDefaultEventColor(),
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
      _forceSeriesUpdate: eventCopy._seriesUpdate || false,
      // Store the current times as preserved times for all-day toggle
      _preservedStartTime: format(eventCopy.start, 'HH:mm'),
      _preservedEndTime: format(eventCopy.end, 'HH:mm')
    };

    // Set both the original state and event state
    setOriginalEventState(eventCopy);
    setEventState(eventData);
    setSelectedColor(eventCopy.color || getDefaultEventColor());
    setIsAddingEvent(true);
    setHasChanges(false);
    setPreviewEvent({
      ...eventCopy,
      _isPreview: true
    });
  }, []);

  const handleEventChange = useCallback((field, value) => {
    setEventState(prev => {
      let newState = { ...prev };

      if (field === 'startTime') {
        const newStartTimeStr = value;
        const currentEndTimeStr = prev.endTime;
        
        // Parse times with a common base date for calculation
        const baseDate = new Date(); 
        const currentStartDate = parse(prev.startTime, 'HH:mm', baseDate);
        const currentEndDate = parse(currentEndTimeStr, 'HH:mm', baseDate);
        const newStartDate = parse(newStartTimeStr, 'HH:mm', baseDate);
        
        // Check if parsing was successful before calculating
        if (!isNaN(currentStartDate) && !isNaN(currentEndDate) && !isNaN(newStartDate)) {
          const durationMs = differenceInMilliseconds(currentEndDate, currentStartDate);
          
          // Ensure duration is at least 15 minutes
          const minDurationMs = 15 * 60 * 1000;
          const effectiveDurationMs = Math.max(durationMs, minDurationMs);
          
          const newEndDate = new Date(newStartDate.getTime() + effectiveDurationMs);
          const newEndTimeStr = format(newEndDate, 'HH:mm');
          
          newState = { ...newState, startTime: newStartTimeStr, endTime: newEndTimeStr, _preservedStartTime: newStartTimeStr, _preservedEndTime: newEndTimeStr };
        } else {
          // Handle parsing error - maybe just update start time?
          newState = { ...newState, startTime: newStartTimeStr };
        }
      } else if (field === 'endTime') {
        // When endTime is explicitly changed, update it and ensure minimum gap
        const newEndTime = ensureMinimumGap(prev.startTime, value);
        newState = { ...newState, endTime: newEndTime, _preservedEndTime: newEndTime };
      } else if (field === 'isAllDay') {
        // Handle all-day toggle with time preservation
        if (value === true) {
          // Turning ON all-day: preserve current times
          newState = { 
            ...newState, 
            isAllDay: true,
            _preservedStartTime: prev.startTime,
            _preservedEndTime: prev.endTime
          };
        } else {
          // Turning OFF all-day: restore preserved times
          newState = { 
            ...newState, 
            isAllDay: false,
            startTime: prev._preservedStartTime || prev.startTime,
            endTime: prev._preservedEndTime || prev.endTime
          };
        }
      } else {
        // For all other fields, just update the value
        newState = { ...newState, [field]: value };
      }

      // Step 2: Handle derived state for multi-day logic
      // Parse dates consistently. Fallback endDate to date if undefined/null for initial checks.
      const startDateObj = parse(newState.date, 'yyyy-MM-dd', new Date());
      const endDateObj = parse(newState.endDate || newState.date, 'yyyy-MM-dd', new Date());

      if (field === 'isMultiDay') { // Change originated from the multi-day toggle
        if (newState.isMultiDay === true) { // Toggle switched ON
          // If endDate is same or before startDate, set endDate to startDate + 1 day
          if (isSameDay(startDateObj, endDateObj) || isBefore(endDateObj, startDateObj)) {
            newState.endDate = format(addDays(startDateObj, 1), 'yyyy-MM-dd');
          }
          // If endDate was already valid and different, it's preserved.
        } else { // Toggle switched OFF
          newState.endDate = newState.date; // Set endDate to match startDate
        }
      } else if (field === 'date') { // Change originated from start date picker (newState.date is already updated)
        if (!newState.isMultiDay) { // If multi-day is NOT active
          newState.endDate = newState.date; // End date follows start date, isMultiDay remains false
        } else { // If multi-day IS active
          const currentEndDateObj = parse(newState.endDate, 'yyyy-MM-dd', new Date()); // endDate from before this 'date' change
          // Check if this change makes it a single-day event
          if (isSameDay(startDateObj, currentEndDateObj)) {
            newState.isMultiDay = false;
            newState.endDate = newState.date; // Ensure endDate matches the new startDate
          } else if (isBefore(currentEndDateObj, startDateObj)) {
            // If new start date is after current end date, invalidating the range.
            // Adjust endDate to be one day after the new start date.
            newState.endDate = format(addDays(startDateObj, 1), 'yyyy-MM-dd');
          }
          // If new start date is before current end date and they are different,
          // isMultiDay remains true, and endDate is preserved from before this 'date' change.
        }
      } else if (field === 'endDate') { // Change originated from end date picker (newState.endDate is already updated)
        // When endDate is changed, update isMultiDay status based on comparison with current startDate.
        if (isSameDay(startDateObj, endDateObj)) {
          newState.isMultiDay = false;
        } else {
          newState.isMultiDay = true;
          // Ensure endDate is not before startDate if it became multi-day
          if (isBefore(endDateObj, startDateObj)) {
            newState.endDate = format(addDays(startDateObj, 1), 'yyyy-MM-dd');
          }
        }
      }

      // Compare with original state to determine if there are changes
      const hasChanges = Object.keys(newState).some(key => {
        // Skip internal properties starting with _
        if (key.startsWith('_')) return false;

        // Handle specific comparisons
        if (key === 'date' || key === 'endDate') {
            const originalDateKey = key === 'date' ? 'start' : 'end';
            const originalDateValue = originalEventState?.[originalDateKey];
            // If original state exists and has a valid date for this key
            if (originalEventState && originalDateValue) {
                // Compare formatted dates
                try {
                    return newState[key] !== format(new Date(originalDateValue), 'yyyy-MM-dd');
                } catch (e) {
                    // Handle invalid date in original state if necessary, maybe fallback
                    return true; // Assume change if original date is invalid
                }
            } else {
                // If no original state or original date, compare against default or assume change
                // This comparison might need refinement based on initial state defaults
                return true; 
            }
        }
        if (key === 'startTime' || key === 'endTime') {
            const originalTimeKey = key === 'startTime' ? 'start' : 'end';
            const originalTimeValue = originalEventState?.[originalTimeKey];
            if (originalEventState && originalTimeValue) {
                try {
                    return newState[key] !== format(new Date(originalTimeValue), 'HH:mm');
                } catch (e) {
                    return true; // Assume change if original time is invalid
                }
            } else {
                return true;
            }
        }
        // Default comparison for other keys
        return newState[key] !== (originalEventState?.[key] || '');
      });
      setHasChanges(hasChanges);
      return newState;
    });
  }, [originalEventState, roundToNearest15Min, ensureMinimumGap]);

  const handleSaveChanges = useCallback(() => {
    // Helper function to create timezone-aware dates
    const createLocalDateTime = (dateStr, timeStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      // Create date in local timezone, not UTC
      return new Date(year, month - 1, day, hours, minutes);
    };

    const createLocalDate = (dateStr, hours = 0, minutes = 0) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      // Create date in local timezone, not UTC
      return new Date(year, month - 1, day, hours, minutes);
    };

    const eventData = {
      id: originalEventState?.id,
      title: eventState.title.trim(),
      description: eventState.description,
      start: (eventState.isAllDay || eventState.isMultiDay) 
        ? createLocalDate(eventState.date, 0, 0)
        : createLocalDateTime(eventState.date, eventState.startTime),
      end: eventState.isMultiDay 
        ? createLocalDate(eventState.endDate, 23, 59)
        : (eventState.isAllDay 
          ? createLocalDate(eventState.date, 23, 59)
          : createLocalDateTime(eventState.date, eventState.endTime)),
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
        start: (eventState.isAllDay || eventState.isMultiDay) 
          ? createLocalDate(eventState.date, 0, 0)
          : createLocalDateTime(eventState.date, eventState.startTime),
        end: eventState.isMultiDay 
          ? createLocalDate(eventState.endDate, 23, 59)
          : (eventState.isAllDay 
            ? createLocalDate(eventState.date, 23, 59)
            : createLocalDateTime(eventState.date, eventState.endTime))
      },
      // Preserve repeat properties for series updates
      _preserveRepeat: originalEventState?._preserveRepeat || false,
      // Force series update if this is a series edit
      _forceSeriesUpdate: originalEventState?._seriesUpdate || false,
      // Remove draft flag when saving
      isDraft: false
    };

    if (originalEventState?.isDraft) {
      // For draft events, create a new event and remove the draft
      onCreateEvent(eventData);
      // Remove the draft event
      onUpdateEvent({ ...originalEventState, _shouldDelete: true });
    } else if (originalEventState?.id) {
      onUpdateEvent(eventData);
    } else {
      onCreateEvent(eventData);
    }

    handleClose({ skipDelete: true });
  }, [originalEventState, eventState, onUpdateEvent, onCreateEvent, handleClose]);

  const handleDiscardDraft = useCallback(() => {
    if (originalEventState?.isDraft) {
      // Remove the draft event
      onUpdateEvent({ ...originalEventState, _shouldDelete: true });
    }
    handleClose({ skipDelete: true });
  }, [originalEventState, onUpdateEvent, handleClose]);

  const openForTaskEdit = useCallback((task) => {
    console.log('🚀 [CHRONO-DEBUG] openForTaskEdit called with task:', {
      id: task.id,
      title: task.title,
      isRepeat: task.isRepeat,
      seriesId: task.seriesId,
      _detachedTask: task._detachedTask,
      _editScope: task._editScope
    });
    
    setIsOpen(true);
    setIsAddingTask(true);
    setIsAddingEvent(false);
    setTaskTitle(task.title || '');
    setTaskNotes(task.notes || '');
    setSelectedTag(task.tag || null);
    setDraftTag(task.tag || null);
    setTaskPriority(task.priority || 'Medium');
    setTagSearchText(''); // Don't set the tag search text when editing
    
    // CRITICAL FIX: For recurring tasks, don't set scheduledDate in UI
    // This prevents users from editing schedule dates of recurring tasks
    // which should be controlled by recurrence patterns only
    // EXCEPTION: Allow schedule editing for single instance edits
    const isRecurringTask = task.seriesId && (task.repeat || task.isRepeat) && task._editScope !== 'single';
    setScheduledDate(isRecurringTask ? null : (task.scheduledDate ? new Date(task.scheduledDate) : null));
    
    // Handle repeat options for recurring task instances
    let repeatOption = task.repeat || 'none';
    let repeatSeriesId = task.seriesId || null;
    let rruleOptions = task.rruleOptions || null;
    
    // If this is a recurring task instance (has seriesId but no repeat), get repeat info from base task
    if (task.isRepeat === true && task.seriesId && (!task.repeat || task.repeat === 'none')) {
      // Get all tasks from localStorage to find the base task
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      const allTasks = tasks.all || [];
      
      // Find the base task for this series
      const baseTask = allTasks.find(t => 
        t.seriesId === task.seriesId && 
        (t.isRepeat === false || typeof t.isRepeat === 'undefined')
      );
      
      if (baseTask) {
        repeatOption = baseTask.repeat || 'none';
        rruleOptions = baseTask.rruleOptions || null;
      }
    }
    
    // Store the task with the resolved repeat option for proper comparison later
    let taskToStore = {...task, _originalRepeatOption: repeatOption};
    
    setTaskRepeatOption(repeatOption);
    setTaskRepeatSeriesId(repeatSeriesId);
    setTaskRruleOptions(rruleOptions);
    setEditingTaskId(task.id);
    setTaskToEdit(taskToStore);
  }, []);

  useImperativeHandle(ref, () => ({
    openWithDragData: (startTime, endTime, eventId) => {
      // For draft events, we don't create the event yet - just set up the form
      const draftEventData = {
        id: eventId,
        title: '',
        description: '',
        start: new Date(startTime),
        end: new Date(endTime),
        allDay: false,
        color: currentDefaultColor,
        repeat: 'none',
        isDraft: true
      };
      
      const eventState = {
        title: '',
        description: '',
        date: format(new Date(startTime), 'yyyy-MM-dd'),
        endDate: format(new Date(startTime), 'yyyy-MM-dd'), // Initialize end date
        startTime: format(new Date(startTime), 'HH:mm'),
        endTime: format(new Date(endTime), 'HH:mm'),
        isAllDay: false,
        isMultiDay: false, // Initialize multi-day flag
        color: currentDefaultColor,
        repeat: 'none',
        seriesId: null,
        rruleOptions: null, // Init rruleOptions for new event
        _preservedStartTime: format(new Date(startTime), 'HH:mm'), // Initialize preserved start time
        _preservedEndTime: format(new Date(endTime), 'HH:mm') // Initialize preserved end time
      };

      setOriginalEventState(draftEventData);
      setEventState(eventState);
      setIsAddingEvent(true);
      setHasChanges(false);
    },
    openWithTime: (date) => {
      const inputDate = new Date(date);
      const roundedTimeStr = roundToNearest15Min(format(inputDate, 'HH:mm'));
      
      // Create timezone-aware times
      const roundedTime = new Date(inputDate);
      const [hours, minutes] = roundedTimeStr.split(':').map(Number);
      roundedTime.setHours(hours, minutes, 0, 0);
      
      const endTime = new Date(roundedTime);
      endTime.setHours(hours + 1, minutes, 0, 0);
      
      const newEventData = {
        title: '',
        description: '',
        start: roundedTime,
        end: endTime,
        allDay: false,
        color: getDefaultEventColor(),
        repeat: 'none'
      };

      const createdEvent = onCreateEvent(newEventData);
      
      const eventState = {
        title: '',
        description: '',
        date: format(roundedTime, 'yyyy-MM-dd'),
        endDate: format(roundedTime, 'yyyy-MM-dd'), // Initialize end date
        startTime: roundedTimeStr,
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        isMultiDay: false, // Initialize multi-day flag
        color: getDefaultEventColor(),
        repeat: 'none',
        seriesId: null,
        rruleOptions: null, // Init rruleOptions for new event
        _preservedStartTime: roundedTimeStr, // Initialize preserved start time
        _preservedEndTime: format(endTime, 'HH:mm') // Initialize preserved end time
      };

      setOriginalEventState(createdEvent);
      setEventState(eventState);
      setIsAddingEvent(true);
      setHasChanges(false);
    },
    openForNewEvent: (date) => {
      // Create timezone-aware date objects
      const inputDate = new Date(date);
      const startTime = new Date(inputDate);
      startTime.setHours(9, 0, 0, 0);
      
      const endTime = new Date(inputDate);
      endTime.setHours(10, 0, 0, 0);
      
      // Set up the event state without creating an actual event
      const eventState = {
        title: '',
        description: '',
        date: format(startTime, 'yyyy-MM-dd'),
        endDate: format(startTime, 'yyyy-MM-dd'),
        startTime: format(startTime, 'HH:mm'),
        endTime: format(endTime, 'HH:mm'),
        isAllDay: false,
        isMultiDay: false,
        color: getDefaultEventColor(),
        repeat: 'none',
        seriesId: null,
        rruleOptions: null,
        _preservedStartTime: format(startTime, 'HH:mm'), // Initialize preserved start time
        _preservedEndTime: format(endTime, 'HH:mm') // Initialize preserved end time
      };

      // Set original event state to null since this is a new event
      setOriginalEventState(null);
      setEventState(eventState);
      setIsAddingEvent(true);
      setHasChanges(false);
    },
    openForNewTask: (date) => {
      // Reset the task state
      setTaskTitle('');
      setTaskNotes('');
      setSelectedTag(null);
      setDraftTag(null);
      setTagSearchText('');
      setTaskRepeatOption('none');
      setTaskRepeatSeriesId(null);
      setTaskRruleOptions(null);
      setTaskPriority('None'); // Reset priority to default
      setEditingTaskId(null);
      setTaskToEdit(null);
      
      // Set the scheduled date to the provided date
      setScheduledDate(date ? new Date(date) : null);
      
      // Set schedule option based on whether a date is provided
      // If no date is provided (null), default to 'anytime'
      // If a date is provided, determine the appropriate option
      if (!date) {
        setScheduleOption('anytime');
      } else {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (date.toDateString() === today.toDateString()) {
          setScheduleOption('today');
        } else if (date.toDateString() === tomorrow.toDateString()) {
          setScheduleOption('tomorrow');
        } else {
          setScheduleOption('custom');
        }
      }
      
      // Open the CommandBar in task creation mode
      setIsOpen(true);
      setIsAddingTask(true);
      setIsAddingEvent(false);
    },
    // Expose setter methods for pre-filling task creation form
    setScheduledDate: (date) => {
      setScheduledDate(date);
    },
    setSelectedTag: (tag) => {
      setSelectedTag(tag);
      setDraftTag(tag);
    },
    openForEdit,
    openForTaskEdit,
    // Multi-select functions
    selectTask: handleTaskSelect,
    selectAllTasks: handleSelectAllTasks,
    clearSelection: handleClearSelection,
    bulkUpdateTasks: handleBulkTaskUpdate,
    bulkCompleteTasks: handleBulkTaskComplete,
    getSelectedTasks: () => Array.from(selectedTasks),
    isMultiSelectMode: () => isMultiSelectMode,
    // Selection change callback management
    onSelectionChange: (callback) => {
      console.log('[CommandBar] Registering new selection callback');
      setSelectionChangeCallbacks(prev => {
        const newSet = new Set([...prev, callback]);
        console.log('[CommandBar] Total callbacks after registration:', newSet.size);
        return newSet;
      });
      return () => {
        console.log('[CommandBar] Unregistering selection callback');
        setSelectionChangeCallbacks(prev => {
          const newSet = new Set(prev);
          newSet.delete(callback);
          console.log('[CommandBar] Total callbacks after unregistration:', newSet.size);
          return newSet;
        });
      };
    }
  }), [onCreateEvent, openForEdit, openForTaskEdit, handleTaskSelect, handleSelectAllTasks, handleClearSelection, handleBulkTaskUpdate, handleBulkTaskComplete, selectedTasks, isMultiSelectMode, setSelectionChangeCallbacks]);

  const handleGoToDate = useCallback((date) => {
    if (date) {
      // Call the onDateSelect handler directly to set the exact date
      onDateSelect(date);
      
      // Reset state immediately - let Framer Motion handle the animation timing
      setIsGoToDateMode(false);
      setQuery('');
      setSuggestions([]);
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
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRepeatDropdownOpen]);



  // Fix layout animation state tracking
  useEffect(() => {
    // Reset animation flags when component unmounts
    return () => {
      exitingRef.current = false;
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
      title: '',
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
      // Use the stored _originalRepeatOption which was resolved during task edit initialization
      const originalRepeatOption = taskToEdit?._originalRepeatOption || taskToEdit?.repeat || 'none';
      const repeatChanged = taskToEdit && originalRepeatOption !== taskRepeatOption;
      
      console.log('🚀 [CHRONO-DEBUG] Recurrence conversion check:', {
        editingTaskId,
        taskToEdit: taskToEdit ? {
          id: taskToEdit.id,
          title: taskToEdit.title,
          repeat: taskToEdit.repeat,
          _originalRepeatOption: taskToEdit._originalRepeatOption
        } : null,
        originalRepeatOption,
        taskRepeatOption,
        taskRruleOptions,
        repeatChanged,
        taskRepeatSeriesId
      });
      
      // Generate a series ID for recurring tasks if needed
      // Preserve existing seriesId if task was already recurring
      const seriesId = taskRepeatOption !== 'none' 
        ? (taskRepeatSeriesId || `series_${Date.now().toString()}`)
        : (taskToEdit && taskToEdit.seriesId && !repeatChanged ? taskToEdit.seriesId : null);
        
      console.log('🚀 [CHRONO-DEBUG] Generated seriesId:', seriesId);

      if (editingTaskId) {
        // Check if this is a single instance edit of recurring task
        if (taskToEdit && taskToEdit._editScope === 'single') {
          console.log('🚀 [CHRONO-DEBUG] Updating single task instance (keeping in series)');
          console.log('🚀 [CHRONO-DEBUG] Form values:', {
            title: taskTitle.trim(),
            notes: taskNotes.trim(),
            tag: finalTag,
            priority: taskPriority,
            scheduledDate: scheduledDate?.toISOString()
          });
          
          // Update the existing task instance with the edited data
          // Keep it as part of the series - don't detach it
          const updatedTask = {
            ...taskToEdit,
            // Apply the edited data from the form (form values take priority)
            title: taskTitle.trim() || taskToEdit.title,
            notes: taskNotes.trim() || taskToEdit.notes,
            tag: finalTag !== null ? finalTag : taskToEdit.tag,
            priority: taskPriority || taskToEdit.priority,
            scheduledDate: scheduledDate?.toISOString() || taskToEdit.scheduledDate,
            updatedAt: new Date().toISOString(),
            // Keep the task as part of the series
            isRepeat: taskToEdit.isRepeat,
            seriesId: taskToEdit.seriesId,
            originalBaseId: taskToEdit.originalBaseId,
            // Preserve the edit scope for useTaskManagement
            _editScope: taskToEdit._editScope,
            // Remove other temporary edit flags
            _detachedTask: undefined,
            _originalTask: undefined
          };
          
          console.log('🚀 [CHRONO-DEBUG] Final updated task (single instance):', updatedTask);
          console.log('🚀 [CHRONO-DEBUG] Calling onUpdateTask with single instance update...');
          
          // Update the task instance using the existing update mechanism
          const result = onUpdateTask(updatedTask);
          console.log('🚀 [CHRONO-DEBUG] onUpdateTask result:', result);
          
          // Reset form and close
          setTaskTitle('');
          setTaskNotes('');
          setSelectedTag(null);
          setPendingNewTag(null);
          setDraftTag(null);
          setTagSearchText('');
          setScheduledDate(null);
          setTaskRepeatOption('none');
          setTaskRepeatSeriesId(null);
          setTaskRruleOptions(null);
          setTaskPriority('Medium');
          setIsAddingTask(false);
          setEditingTaskId(null);
          setTaskToEdit(null);
          handleClose();
          return;
        } else {
          // Regular task update
          const updatedTask = {
            ...taskToEdit,
            id: editingTaskId,
            title: taskTitle.trim(),
            notes: taskNotes.trim(),
            tag: finalTag,
            priority: taskPriority,
            // CRITICAL FIX: For series updates, don't override scheduledDate
            // The base task should keep scheduledDate: undefined, instances keep their dates
            scheduledDate: taskToEdit._updateSeries ? taskToEdit.scheduledDate : scheduledDate?.toISOString(),
            updatedAt: new Date().toISOString(),
            repeat: taskRepeatOption !== 'none' ? taskRepeatOption : 'none',
            rruleOptions: taskRepeatOption !== 'none' ? taskRruleOptions : null,
            seriesId: seriesId,
            // Preserve the original isRepeat value - don't hardcode to false
            isRepeat: taskToEdit.isRepeat,
            // Explicitly preserve originalBaseId for recurring task instances
            originalBaseId: taskToEdit.originalBaseId,
            // Pass through scope information for series-wide updates
            _editScope: taskToEdit._editScope,
            _updateSeries: taskToEdit._updateSeries
          };
          
          console.log('🚀 [CHRONO-DEBUG] CommandBar sending task update:', {
            id: updatedTask.id,
            title: updatedTask.title,
            repeat: updatedTask.repeat,
            rruleOptions: updatedTask.rruleOptions,
            seriesId: updatedTask.seriesId,
            isRepeat: updatedTask.isRepeat,
            originalBaseId: updatedTask.originalBaseId,
            _editScope: updatedTask._editScope,
            _updateSeries: updatedTask._updateSeries,
            taskRepeatOption: taskRepeatOption,
            taskRepeatSeriesId: taskRepeatSeriesId
          });

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

          // For series updates, skip local manipulation and let useTaskManagement handle everything
          if (updatedTask._updateSeries) {
            console.log('Series update detected - skipping local manipulation, letting useTaskManagement handle it');
            console.log('🚀 [CHRONO-DEBUG] About to call onUpdateTask with:', {
            id: updatedTask.id,
            title: updatedTask.title,
            repeat: updatedTask.repeat,
            rruleOptions: updatedTask.rruleOptions,
            seriesId: updatedTask.seriesId,
            isRepeat: updatedTask.isRepeat,
            originalBaseId: updatedTask.originalBaseId,
            _editScope: updatedTask._editScope,
            _updateSeries: updatedTask._updateSeries
          });
          onUpdateTask(updatedTask);
            
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
            setTaskRruleOptions(null);
            setTaskPriority('Medium');
            setIsAddingTask(false);
            setEditingTaskId(null);
            setTaskToEdit(null);
            handleClose();
            return;
          }

          console.log('🚀 [CHRONO-DEBUG] About to call onUpdateTask (regular path) with:', {
            id: updatedTask.id,
            title: updatedTask.title,
            repeat: updatedTask.repeat,
            rruleOptions: updatedTask.rruleOptions,
            seriesId: updatedTask.seriesId,
            isRepeat: updatedTask.isRepeat,
            originalBaseId: updatedTask.originalBaseId,
            _editScope: updatedTask._editScope,
            _updateSeries: updatedTask._updateSeries
          });
          onUpdateTask(updatedTask);
        }
      } else {
        // Create new task
        const newTask = {
          id: Date.now().toString(),
          title: taskTitle.trim(),
          notes: taskNotes.trim(),
          tag: finalTag,
          priority: taskPriority,
          // For recurring tasks, don't set scheduledDate on the base task - it will be set on instances
          scheduledDate: (taskRepeatOption && taskRepeatOption !== 'none') ? undefined : scheduledDate?.toISOString(),
          completed: false,
          createdAt: new Date().toISOString(),
          repeat: taskRepeatOption !== 'none' ? taskRepeatOption : 'none',
          rruleOptions: taskRepeatOption !== 'none' ? taskRruleOptions : null,
          seriesId: seriesId,
          isRepeat: false // Base task is never a repeat instance
        };
        
        // For recurring tasks, preserve the user's scheduled date for startDateOfSeries calculation
        if (taskRepeatOption && taskRepeatOption !== 'none' && scheduledDate) {
          newTask._originalScheduledDate = scheduledDate.toISOString();
        }
        
        // Note: For recurring tasks, the scheduled date logic is handled in useTaskManagement.js
        // The base task will have scheduledDate = undefined, and instances will be generated with proper dates
        
        console.log('Creating new task with recurring options:', {
          repeat: taskRepeatOption,
          rruleOptions: taskRruleOptions,
          seriesId: seriesId
        });

        // Let onCreateTask handle all collection management
        onCreateTask(newTask);
      }

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
      setTaskPriority('Medium'); // Reset priority to default
      setIsAddingTask(false);
      setEditingTaskId(null);
      setTaskToEdit(null);
      handleClose();
    } catch (error) {
      console.error('Error saving task:', error);
      // You might want to show an error message to the user here
    }
  }, [taskTitle, taskNotes, selectedTag, pendingNewTag, scheduledDate, taskRepeatOption, taskRepeatSeriesId, taskRruleOptions, taskPriority, tags, editingTaskId, taskToEdit, onCreateTask, onUpdateTask, handleClose, dispatchTagsUpdated]);

  const handleKeyDown = useCallback((e) => {
    console.log('[CommandBar] Keyboard event received:', e.key, {
      target: e.target.tagName,
      isAddingEvent,
      isAddingTask,
      isOpen,
      selectedTasksSize: selectedTasks.size
    });

    // Check if user is typing in an input field
    const isTypingInInput = e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        e.target.closest('[contenteditable]');

    // Check if the input field is part of the CommandBar
    const isCommandBarInput = e.target.closest('[data-command-bar]');

    // Don't trigger shortcuts if user is typing in an input field OUTSIDE the CommandBar
    // ESC and Enter will be handled by their specific logic above
    if (isTypingInInput && !isCommandBarInput && e.key !== 'Escape' && e.key !== 'Enter') {
      console.log('[CommandBar] Ignoring keyboard event - user is typing in input field outside CommandBar');
      return;
    }

    // For Shift+T, Shift+E, and Shift+. always allow them to work (global shortcuts)
    if (e.key === 'T' && e.shiftKey && !isAddingEvent && !isAddingTask && !isGoToDateMode) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[CommandBar] Handling Shift+T');
      setIsAddingTask(true);
      setIsOpen(true);
      return;
    } else if (e.key === 'E' && e.shiftKey && !isAddingEvent && !isAddingTask && !isGoToDateMode) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[CommandBar] Handling Shift+E');
      handleAddEventClick();
      setIsOpen(true);
      return;
    } else if ((e.key === '.' || e.key === '>') && e.shiftKey && !isAddingEvent && !isAddingTask && !isGoToDateMode) {
      e.preventDefault();
      e.stopPropagation();
      console.log('[CommandBar] Handling Shift+. (Settings)');
      if (onOpenSettings) {
        onOpenSettings();
      }
      return;
    }

    // Check if any dropdowns or modals are open (for arrow key navigation only)
    // Note: RepeatEditModal and RepeatTaskEditModal handle their own ESC/Enter with capture
    const isModalOrDropdownOpen = isDatePickerOpen || isScheduleOpen || isTagDropdownOpen || 
      isTaskRepeatDropdownOpen || isPriorityDropdownOpen || isRepeatDropdownOpen || 
      showColorPicker || isRecurrenceModalOpen || showRepeatEditModal || 
      isMultiSelectScheduleOpen || isMultiSelectPriorityOpen || isMultiSelectTagOpen ||
      isRepeatTaskEditModalOpen;

    if (e.key === 'Escape') {
      // Check if Settings modal is open by looking for it in the DOM
      const settingsModal = document.querySelector('[data-settings-modal]');
      const isSettingsOpen = settingsModal !== null;

      if (isSettingsOpen) {
        // Let Settings handle ESC first
        console.log('[CommandBar] Settings is open, letting it handle ESC');
        return;
      }

      // Check if CommandBar should handle ESC
      const shouldHandleEsc = isRepeatDropdownOpen || isTaskRepeatDropdownOpen || 
        isPriorityDropdownOpen || isTagDropdownOpen || isScheduleOpen || 
        showRepeatEditModal || isRepeatTaskEditModalOpen || isRecurrenceModalOpen || 
        (isMultiSelectMode && selectedTasks.size > 0) || originalEventState?.isDraft || 
        isAddingEvent || isAddingTask;

      if (shouldHandleEsc) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[CommandBar] Handling ESC key');
        
        // Handle escape key - close open dropdowns first, then other actions
        if (isRepeatDropdownOpen) {
          setIsRepeatDropdownOpen(false);
        } else if (isTaskRepeatDropdownOpen) {
          setIsTaskRepeatDropdownOpen(false);
        } else if (isPriorityDropdownOpen) {
          setIsPriorityDropdownOpen(false);
        } else if (isTagDropdownOpen) {
          setIsTagDropdownOpen(false);
        } else if (isScheduleOpen) {
          setIsScheduleOpen(false);
        } else if (showRepeatEditModal) {
          setShowRepeatEditModal(false);
        } else if (isRepeatTaskEditModalOpen) {
          setIsRepeatTaskEditModalOpen(false);
        } else if (isRecurrenceModalOpen) {
          setIsRecurrenceModalOpen(false);
        } else if (isMultiSelectMode && selectedTasks.size > 0) {
          handleClearSelection();
        } else if (originalEventState?.isDraft) {
          handleDiscardDraft();
        } else if (isAddingEvent || isAddingTask) {
          console.log('[CommandBar] Closing from creation mode');
          handleClose();
        } else {
          handleClose();
        }
        return;
      } else {
        // Let ESC bubble up to other components
        console.log('[CommandBar] Letting ESC bubble up to other components');
        return;
      }
    }
    
    if (e.key === 'Enter' && !e.shiftKey) {
      // Only handle Enter when actively adding event or task
      if (isAddingEvent || isAddingTask) {
        e.preventDefault();
        e.stopPropagation(); // Only stop propagation when CommandBar should handle it
        console.log('[CommandBar] Handling ENTER key');
        
        // Handle enter key - use the same flow as clicking save
        if (isAddingEvent) {
          console.log('[CommandBar] Saving event');
          handleSaveChanges();
        } else if (isAddingTask) {
          console.log('[CommandBar] Saving task');
          handleSaveTask();
        }
        return;
      } else {
        // Let Enter bubble up to other components when not actively using CommandBar
        console.log('[CommandBar] Letting ENTER bubble up to other components');
        return;
      }
    }
    
    if (e.key === 'ArrowLeft' && !isModalOrDropdownOpen) {
      e.preventDefault();
      onPrevious();
    } else if (e.key === 'ArrowRight' && !isModalOrDropdownOpen) {
      e.preventDefault();
      onNext();
    } else if (isMultiSelectMode && selectedTasks.size > 0) {
      // Multi-select toolbar shortcuts - only work when in multi-select mode
      if (e.key.toLowerCase() === 'd' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Handle 'D' key - trigger Done button
        handleBulkTaskComplete();
      } else if (e.key.toLowerCase() === 'p' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Handle 'P' key - trigger Priority button
        handleMultiSelectPriority();
      } else if (e.key.toLowerCase() === 't' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Handle 'T' key - trigger Tag button (only in multi-select mode, without Shift)
        handleMultiSelectTag();
      }
    }
  }, [
    handleClose,
    handleSaveChanges,
    handleSaveTask,
    handleAddEventClick,
    handleDiscardDraft,
    handleClearSelection,
    isAddingEvent,
    isAddingTask,
    isGoToDateMode,
    isMultiSelectMode,
    selectedTasks.size,
    originalEventState?.isDraft,
    taskRruleOptions,
    eventState.rruleOptions,
    eventState.title,
    hasChanges,
    taskTitle,
    handleBulkTaskComplete,
    handleMultiSelectPriority,
    handleMultiSelectTag,
    onPrevious,
    onNext,
    onOpenSettings,
    isDatePickerOpen,
    isScheduleOpen,
    isTagDropdownOpen,
    isTaskRepeatDropdownOpen,
    isPriorityDropdownOpen,
    isRepeatDropdownOpen,
    showColorPicker,
    isRecurrenceModalOpen,
    showRepeatEditModal,
    isMultiSelectScheduleOpen,
    isMultiSelectPriorityOpen,
    isMultiSelectTagOpen,
    setIsRepeatDropdownOpen,
    setIsTaskRepeatDropdownOpen,
    setIsPriorityDropdownOpen,
    setIsTagDropdownOpen,
    setIsScheduleOpen,
    isRepeatTaskEditModalOpen,
    setShowRepeatEditModal,
    setIsRepeatTaskEditModalOpen,
    setIsRecurrenceModalOpen
  ]);

  useEffect(() => {
    // Use normal bubbling so that modal overlays (like Settings) get events first
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Handler for saving custom recurrence rule from modal
  const handleSaveRecurrenceRule = useCallback((newOptions) => {
    console.log('🚀 [CHRONO-DEBUG] handleSaveRecurrenceRule called:', {
      newOptions,
      isAddingEvent,
      isAddingTask,
      editingTaskId,
      taskRepeatSeriesId
    });
    
    if (isAddingEvent) {
      handleEventChange('repeat', 'custom');
      handleEventChange('rruleOptions', newOptions);
    } else if (isAddingTask) {
      setTaskRepeatOption('custom');
      setTaskRruleOptions(newOptions);
      // Generate seriesId when applying custom recurrence
      if (!taskRepeatSeriesId) {
        const newSeriesId = `series_${Date.now().toString()}`;
        setTaskRepeatSeriesId(newSeriesId);
        console.log('🚀 [CHRONO-DEBUG] Generated new seriesId for custom recurrence:', newSeriesId);
      }
    }
    setIsRecurrenceModalOpen(false);
  }, [isAddingEvent, isAddingTask, handleEventChange, editingTaskId, taskRepeatSeriesId]);

  // Function to get display text for repeat option
  const getRepeatDisplayText = (repeatValue, rruleOptions) => {
    if (repeatValue === 'custom' && rruleOptions) {
      try {
        // Clone options to avoid modifying original
        const options = {...rruleOptions};
        
        // Ensure dtstart is a proper Date object
        if (options.dtstart) {
          if (typeof options.dtstart === 'string') {
            options.dtstart = new Date(options.dtstart);
          } else if (!(options.dtstart instanceof Date)) {
            // If it's not a Date object, try to convert it
            options.dtstart = new Date(options.dtstart);
          }
        }
        
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

  // Filtered time options based on search
  const filteredStartTimeOptions = useMemo(() => {
    if (!startTimeSearch) return ALL_TIME_OPTIONS;
    const lowerSearch = startTimeSearch.toLowerCase();
    return ALL_TIME_OPTIONS.filter(({ label }) => 
      label.toLowerCase().includes(lowerSearch)
    );
  }, [startTimeSearch]);

  const filteredEndTimeOptions = useMemo(() => {
    // Calculate start time in minutes once
    const [startH, startM] = eventState.startTime.split(':').map(Number);
    const startTotalMinutes = startH * 60 + startM;

    // Filter all options to be strictly after the start time (+15 min minimum gap)
    let timeFilteredOptions = ALL_TIME_OPTIONS.filter(({ value }) => {
      const [optH, optM] = value.split(':').map(Number);
      const optTotalMinutes = optH * 60 + optM;
      return optTotalMinutes >= startTotalMinutes + 15;
    });

    // If there's a search term, filter the time-filtered options further
    if (endTimeSearch) {
      const lowerSearch = endTimeSearch.toLowerCase();
      return timeFilteredOptions.filter(({ label }) => 
        label.toLowerCase().includes(lowerSearch)
      );
    }

    // Otherwise, return the time-filtered options
    return timeFilteredOptions;
  }, [endTimeSearch, eventState.startTime]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex justify-center">
      <AnimatePresence mode="wait">
        {(isOpen || selectedTasks.size > 0) && !isDraggingTask && (
          <motion.div 
            key="commandBar-container"
            ref={containerRef}
            initial={{ 


              y: 140,
              backgroundColor: "var(--background-color, var(--bg-light, #ffffff))"
            }}
            animate={{              opacity: 1,              scale: 1,              y: 0,              width: activeContentKey === 'default' ? (contentBounds.width || 'auto') : ((contentBounds.width || 0) + 32),              height: Math.max(contentBounds.height || BASE_HEIGHT, BASE_HEIGHT),              backgroundColor: "var(--background-color, var(--bg-light, #ffffff))"            }}
            exit={{


              y: 140,
              width: previousSizeRef.current.width || 'auto',
              height: previousSizeRef.current.height || 'auto'
            }}
            style={{
              willChange: "transform, opacity, background-color, width, height",
              transformOrigin: "bottom"
            }}
            transition={{
              type: "spring",
              stiffness: 600,
              damping: 60,
              mass: 1,
              opacity: { duration: 0.15 },
              scale: { duration: 0.15 },
              y: { 
                type: "spring",
                stiffness: 600,
                damping: 40,
                duration: 0.15
              },
              width: {
                type: "spring",
                stiffness: 800,
                damping: 50,
                duration: 0.02
              },
              height: {
                type: "spring",
                stiffness: 800,
                damping: 50,
                duration: 0.02
              }
            }}
            data-command-bar
            className={`bg-light-bg dark:!bg-dark-bg-lighter overflow-hidden shadow-lg rounded-[13px] outline outline-1 outline-light-border dark:outline-dark-border dark:hover:bg-white/10 border-light-border dark:border-dark-border ${!isAddingEvent && !isAddingTask && !isGoToDateMode && selectedTasks.size === 0 ? 'px-0' : 'px-4'}`}
          >
            <div 
              ref={contentRef}
              className="relative flex flex-col"
              style={{
                width: 'max-content',
                minHeight: BASE_HEIGHT
              }}
            >
              <div className="flex-1">
              {/* Tabs moved to fixed buttons container */}
              
            <AnimatePresence 
              mode="wait" 
              initial={false}
              custom={{
                direction: getDirection(activeContentKey, previousContentKeyRef.current),
                isInitial: previousContentKeyRef.current === null,
                isCollapsing: activeContentKey === 'default'
              }}
            >
              <motion.div
                key={activeContentKey}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                custom={{
                  direction: getDirection(activeContentKey, previousContentKeyRef.current),
                  isInitial: previousContentKeyRef.current === null,
                  isCollapsing: activeContentKey === 'default'
                }}
                transition={{
                  type: "spring",
                  bounce: 0,
                  duration: 0.2
                }}
                className={`flex items-center w-full ${(activeContentKey === 'task' || activeContentKey === 'event') ? 'pb-20' : ''}`}
                style={{
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
              >
                {activeContentKey === 'multiselect' && (
                  <div className="flex items-center justify-between w-full py-4" data-multiselect-toolbar>
                    <div className="flex items-center gap-2 text-sm">
                      <button
                        onClick={handleClearSelection}
                        className="text-light-text/50 dark:text-dark-text/50 p-2 hover:bg-light-bg-lighter dark:hover:bg-white/5 rounded-[5px] hover:text-light-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                      >
                        
                        <ArrowAlt className="w-4 h-4 rotate-180" />
                      </button>
                      <div className="h-5 w-[1px] bg-light-border dark:bg-dark-border mr-2"></div>

                      <span className="font-medium text-light-text/50 mr-4 dark:text-dark-text/50 text-xs">{selectedTasks.size} selected</span>
                    </div>

                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBulkTaskComplete}
                        className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
                      >
                        <Check className="h-3 w-3 text-green-500" />
                        <span className="text-xs px-0.5">Done</span>
                      </button>
                      <Popover open={isMultiSelectPriorityOpen} onOpenChange={setIsMultiSelectPriorityOpen}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={handleMultiSelectPriority}
                            className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
                          >
                            <Lightning className="h-3 w-3 text-blue-500" />
                            <span className="text-xs px-0.5">Priority</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 focus:outline-none focus-visible:outline-none"
                          align="center"
                          side="top"
                          sideOffset={8}
                        >
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            role="listbox"
                            className="flex flex-col"
                          >
                            {PRIORITY_OPTIONS.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMultiSelectPrioritySelect(option.id);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const IconComponent = getPriorityIcon(option.id);
                                    return (
                                      <IconComponent 
                                        className={`w-4 h-4 ${option.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`} 
                                        style={option.id === 'None' ? {} : { color: option.color }} 
                                      />
                                    );
                                  })()} 
                                  <span className="text-xs">{option.label}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Popover open={isMultiSelectTagOpen} onOpenChange={setIsMultiSelectTagOpen}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={handleMultiSelectTag}
                            className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
                          >
                            <Tag className="h-3 w-3 text-purple-500" />
                            <span className="text-xs px-0.5">Tag</span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 focus:outline-none focus-visible:outline-none"
                          align="center"
                          side="top"
                          sideOffset={8}
                        >
                          <div
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            role="listbox"
                            className="flex flex-col"
                          >
                            {/* No tag option */}
                            <button
                              type="button"
                              className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMultiSelectTagSelect(null);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full flex-shrink-0 border border-light-border dark:border-dark-border" />
                                <span className="text-xs">No tag</span>
                              </div>
                            </button>
                            {tags.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMultiSelectTagSelect(tag);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: tag.color }}
                                  />
                                  <span className="text-xs">{tag.label}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div className="h-5 w-[1px] bg-light-border dark:bg-dark-border ml-2"></div>
                        
                      <button 
                        onClick={handleMultiSelectDelete}
                        className="flex items-center gap-1 flex-row px-2 h-[32px] ml-2 font-medium shadow-sm bg-gradient-to-b from-red-500/5 to-red-500/10 hover:bg-gradient-to-b hover:from-red-500/10 hover:to-red-500/20 outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
                      >
                        <Trash className="h-3 w-3 text-red-500" />
                        <span className="text-xs px-0.5">Delete</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {activeContentKey === 'default' && (
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <motion.button 
                          layout
                      
                          className="flex group py-4 px-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50"
                        >
                          <Add className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
                          <span className="text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text font-semibold text-sm">Add new</span>
                        </motion.button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-44 flex flex-col p-1 mb-2 bg-light-bg dark:bg-dark-bg-lighter outline outline-1 outline-offset-0 outline-light-border dark:outline-dark-border rounded-[9px] shadow-lg"
                        align="start"
                        sideOffset={2}
                        

                      >
                        <button
                          onClick={() => {
                            setIsAddingTask(true);
                            setIsOpen(true);

                          }}
                          className="group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
                        >
                          <div className="flex flex-row gap-2 items-center">
                          <Completed className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
                          <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Task</span>
                          </div>
                          <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
                           <span className="text-[10px] font-semibold flex flex-row items-center gap-1 tracking-wide text-light-text/50 dark:text-dark-text/50"> <Shift className="w-2.5 h-2.5" />+<span className="pl-[1px] pr-[1px]">T</span></span>
                          </div>
                          </button>
                        <button
                          onClick={() => {
                            handleAddEventClick();
                            setIsOpen(true);

                          }}
                          className="group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
                        >
                          <div className="flex flex-row gap-2 items-center">
                          <CalendarIcon className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
                          <span className='group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium'>Event</span>
                          </div>
                          <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
                           <span className="text-[10px] font-semibold flex flex-row items-center gap-1 tracking-wide text-light-text/50 dark:text-dark-text/50"> <Shift className="w-2.5 h-2.5" />+<span className="pl-[1px] pr-[1px]">E</span></span>
                          </div>
                        </button>
                      </PopoverContent>
                    </Popover>
                    
                    <motion.div 
                      layout
                      key="commandBar-divider"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                    
                    <motion.div 
                      layout
                      key="commandBar-date-buttons"
                      className="flex items-center py-4 px-4 gap-2"
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
                    
                    <motion.div 
                      layout
                      key="commandBar-divider-2"
                      className='h-[24px] w-[1px] bg-light-border dark:bg-dark-border'
                    />
                    
                    <motion.button 
                      key="commandBar-ask-me"
                      layout
                      onClick={() => {
                        setIsGoToDateMode(true);
                        setQuery('');
                        setSuggestions([]);
                      }}
                      className="group flex py-4 px-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors cursor-pointer"
                    >
                      <ArrowAlt className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" fill="none">
                        <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </ArrowAlt>
                      <span className="group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 font-semibold text-sm">Go to date</span>
                    </motion.button>
                  </div>
                )}
                
                {activeContentKey === 'task' && (
                    <motion.div
                      key="commandBar-adding-task"
                      variants={contentVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      custom={{
                        direction: getDirection('task', previousContentKeyRef.current),
                        isInitial: previousContentKeyRef.current === null,
                        isCollapsing: false
                      }}
                      onAnimationStart={() => {
                        animationInProgressRef.current = true;
                      }}
                      onAnimationComplete={() => {
                        animationInProgressRef.current = false;
                      }}
                      transition={{
                        type: "spring",
                        bounce: 0,
                        duration: 0.5
                      }}
                      className="flex flex-col gap-4 min-w-[450px]"
                      style={{
                        transform: 'translateZ(0)',
                        backfaceVisibility: 'hidden'
                      }}
                    >
                      <div className="flex items-start justify-between -mx-4">
                        <div className="flex-1">
                          <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
                            <div className="flex flex-col">
                              <div className="flex items-start gap-2 px-4 py-4 border-b border-light-border dark:border-dark-border">
                                <Task
                                  className="w-5 h-5 text-light-text/50 dark:text-dark-text/50 rounded-[5px] mt-[5px]"
                                />
                                <div className="flex-1 flex-col gap-1 px-2">
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
                              <div className="flex items-center text-light-text/50 dark:text-dark-text/50 gap-2 px-4 py-4 border-b h-[72px] border-light-border dark:border-dark-border">
                              {(() => {
                                // Check if editing a recurring task - disable schedule editing
                                // EXCEPTION: Allow schedule editing for single instance edits
                                const isEditingRecurringTask = taskToEdit && taskToEdit.seriesId && (taskToEdit.repeat || taskToEdit.isRepeat) && taskToEdit._editScope !== 'single';
                                
                                if (isEditingRecurringTask) {
                                  return (
                                    <div className="flex flex-col gap-1.5 opacity-50">
                                      <span className="text-[11px] font-medium">Schedule</span>
                                      <div className="flex items-center w-full gap-2">
                                        <CalendarIcon className="w-4 h-4" />
                                        <span className="text-sm">Controlled by recurrence</span>
                                      </div>
                                    </div>
                                  );
                                }
                                
                                return (
                                  <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                                    <div className="flex flex-col gap-1.5">
                                      <span className="text-[11px] font-medium">Schedule</span>
                                      <PopoverTrigger asChild>
                                        <div className="flex cursor-pointer items-center hover:text-light-text dark:hover:text-dark-text w-full gap-2">
                                  {(() => {
                                    if (!scheduledDate) {
                                      // Show Anytime icon when no date is selected
                                      const anytimeOption = SCHEDULE_OPTIONS.find(opt => opt.id === 'anytime');
                                      const IconComponent = anytimeOption?.icon || CalendarIcon;
                                      return <IconComponent className="w-4 h-4" style={{ color: anytimeOption?.color }} />;
                                    }
                                    
                                    const today = new Date();
                                    const tomorrow = new Date(today);
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    const nextWeek = new Date(today);
                                    nextWeek.setDate(nextWeek.getDate() + 7);
                                    
                                    // Check if scheduled date matches today
                                    if (scheduledDate.toDateString() === today.toDateString()) {
                                      const todayOption = SCHEDULE_OPTIONS.find(opt => opt.id === 'today');
                                      const IconComponent = todayOption?.icon || CalendarIcon;
                                      return <IconComponent className="w-4 h-4" style={{ color: todayOption?.color }} />;
                                    }
                                    
                                    // Check if scheduled date matches tomorrow
                                    if (scheduledDate.toDateString() === tomorrow.toDateString()) {
                                      const tomorrowOption = SCHEDULE_OPTIONS.find(opt => opt.id === 'tomorrow');
                                      const IconComponent = tomorrowOption?.icon || CalendarIcon;
                                      return <IconComponent className="w-4 h-4" style={{ color: tomorrowOption?.color }} />;
                                    }
                                    
                                    // Check if scheduled date matches next week (7 days from today)
                                    if (scheduledDate.toDateString() === nextWeek.toDateString()) {
                                      const nextWeekOption = SCHEDULE_OPTIONS.find(opt => opt.id === 'nextWeek');
                                      const IconComponent = nextWeekOption?.icon || CalendarIcon;
                                      return <IconComponent className="w-4 h-4" style={{ color: nextWeekOption?.color }} />;
                                    }
                                    
                                    // For any other custom date, use Calendar icon
                                    return <CalendarIcon className="w-4 h-4" />;
                                  })()}
                                  <motion.span whileTap={{scale: 0.98}} className="text-sm">{scheduledDate ? format(scheduledDate, 'MMM d') : 'Anytime'}</motion.span>
                                </div>
                                </PopoverTrigger>
                                </div>
                                <PopoverContent 
                                  className="w-[200px] font-medium text-dark-text/50 dark:text-dark-text/50 p-1 mb-8 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg shadow-lg border border-light-border dark:border-dark-border" 
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
                                        className={`flex items-center justify-between px-2 py-2 text-xs rounded-[5px] hover:bg-white/15 dark:hover:bg-white/5 ${
                                          (() => {
                                            if (option.id === 'anytime' && !scheduledDate) return 'text-dark-text dark:text-dark-text font-semibold';
                                            if (option.id === 'today' && scheduledDate && isToday(scheduledDate)) return 'text-dark-text dark:text-dark-text font-semibold';
                                            if (option.id === 'tomorrow' && scheduledDate && isTomorrow(scheduledDate)) return 'text-dark-text dark:text-dark-text font-semibold';
                                            if (option.id === 'nextWeek' && scheduledDate) {
                                              const nextWeek = new Date();
                                              nextWeek.setDate(nextWeek.getDate() + 7);
                                              if (isSameDay(scheduledDate, nextWeek)) return 'text-dark-text dark:text-dark-text';
                                            }
                                            if (option.id === 'custom' && scheduledDate && !isToday(scheduledDate) && !isTomorrow(scheduledDate)) {
                                              const nextWeek = new Date();
                                              nextWeek.setDate(nextWeek.getDate() + 7);
                                              if (!isSameDay(scheduledDate, nextWeek)) return 'text-dark-text dark:text-dark-text';
                                            }
                                            return '';
                                          })()
                                        }`}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (option.id === 'custom') {
                                            setIsDatePickerOpen(true);
                                            setIsScheduleOpen(false);
                                          } else if (option.id === 'anytime') {
                                            setScheduledDate(null);
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
                                        <div className="flex items-center gap-2">
                                          {option.icon && <option.icon className="w-4 h-4" style={{ color: option.color }} />}
                                          {option.label}
                                        </div>
                                        {(() => {
                                          if (option.id === 'anytime' && !scheduledDate) return <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />;
                                          if (option.id === 'today' && scheduledDate && isToday(scheduledDate)) return <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />;
                                          if (option.id === 'tomorrow' && scheduledDate && isTomorrow(scheduledDate)) return <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />;
                                          if (option.id === 'nextWeek' && scheduledDate) {
                                            const nextWeek = new Date();
                                            nextWeek.setDate(nextWeek.getDate() + 7);
                                            if (isSameDay(scheduledDate, nextWeek)) return <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />;
                                          }
                                          if (option.id === 'custom' && scheduledDate && !isToday(scheduledDate) && !isTomorrow(scheduledDate)) {
                                            const nextWeek = new Date();
                                            nextWeek.setDate(nextWeek.getDate() + 7);
                                            if (!isSameDay(scheduledDate, nextWeek)) return <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />;
                                          }
                                          return null;
                                        })()}
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                                );
                              })()}
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
                              

                                  
                              
                              <div className="flex items-center gap-2 px-4 py-4 border-b h-[72px] border-light-border dark:border-dark-border">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[11px] font-medium text-light-text/50 dark:text-dark-text/50">Tag group</span>
                                <div className="flex flex-row h-[20px] items-center gap-2">
                
                                <Tag className={`w-4 h-4 ${draftTag ? '' : 'text-light-text/50 dark:text-dark-text/50'}`} style={draftTag ? { color: draftTag.color } : {}} />
                                <div className="relative flex-1">
                                  <div className="flex items-center gap-1 py-1">
                                    {draftTag ? (
                                      <span 
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] text-xs"
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
                                    </div>
                                    
                                  {isTagDropdownOpen && tagSearchText.length > 0 && (
                                    <div className="absolute  left-0 z-50 right-0 !w-[240px] max-w-[240px] p-1 top-full mt-1 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] outline outline-1 outline-light-border dark:outline-dark-border shadow-lg overflow-hidden">
                                      {tags
                                        .filter(tag => tag.label.toLowerCase().includes(tagSearchText.toLowerCase()))
                                        .map(tag => (
                                          <button
                                            key={`tag-option-${tag.id}`}
                                            className="w-full flex items-center gap-2 px-2 py-2 text-xs hover:bg-white/15 dark:hover:bg-white/5 rounded-[5px]"
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
                                          className="w-full flex items-center gap-2 px-2 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px]"
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
                                          <span className="font-regular text-xs text-left text-dark-text/50 dark:text-dark-text/50">Create <span className="font-semibold text-dark-text dark:text-dark-text">"{tagSearchText}"</span> tag</span>
                                        </button>
                                      )}
                                      
                                    </div>

                                  )}

                                </div>
                                </div>
                              </div>
                            </div>
                              <div className="flex items-center px-4 h-[72px] border-b border-light-border dark:border-dark-border text-light-text/50 dark:text-dark-text/50 text-sm transition-colors">

                                <Popover open={isPriorityDropdownOpen} onOpenChange={setIsPriorityDropdownOpen}>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-start gap-1.5 flex-col">
                                      <span className="text-[11px] font-medium">Priority</span>
                                    <PopoverTrigger>
                                    <div className="flex group cursor-pointer items-center gap-2">
                                      {(() => {
                                        const IconComponent = getPriorityIcon(taskPriority);
                                        return (
                                          <IconComponent 
                                            className={`w-4 h-4 ${taskPriority === 'None' ? 'text-light-text/50 dark:text-dark-text/50' : ''}`} 
                                            style={taskPriority === 'None' ? {} : { color: PRIORITY_OPTIONS.find(p => p.id === taskPriority)?.color }} 
                                          />
                                        );
                                      })()}
                                      <motion.span whileTap={{scale: 0.98}} className="group-hover:text-light-text dark:group-hover:text-dark-text">
                                        {taskPriority}
                                      </motion.span>
                                    </div>
                                    </PopoverTrigger>
                                    </div>
                                  </div>
                                  <PopoverContent 
                                    className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50"
                                    align="start"
                                    side="bottom"
                                  >
                                    <div role="listbox" className="flex flex-col">
                                      {PRIORITY_OPTIONS.map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          className={`px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${taskPriority === option.id ? 'font-semibold text-dark-text dark:text-dark-text' : 'font-medium text-dark-text/50 dark:text-dark-text/50'}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setTaskPriority(option.id);
                                            setIsPriorityDropdownOpen(false);
                                          }}
                                        >
                                          <div className="flex items-center gap-2">
                                            {(() => {
                                              const IconComponent = getPriorityIcon(option.id);
                                              return (
                                                <IconComponent 
                                                  className={`w-4 h-4 ${option.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`} 
                                                  style={option.id === 'None' ? {} : { color: option.color }} 
                                                />
                                              );
                                            })()} 
                                            <span className="text-xs group-hover:text-light-text dark:group-hover:text-dark-text">{option.label}</span>
                                          </div>
                                          {taskPriority === option.id && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                                        </button>
                                      ))}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                              <div className="flex items-center px-4 h-[72px] text-light-text/50 dark:text-dark-text/50 text-sm transition-colors">
                                <Popover open={isTaskRepeatDropdownOpen} onOpenChange={setIsTaskRepeatDropdownOpen}>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-start flex-col gap-1.5">
                                      <span className="text-[11px] font-medium">Repeat</span>
                                    <PopoverTrigger>
                                    <div className="flex group items-center gap-2 cursor-pointer">
                                      <Repeat className="w-4 h-4" />
                                      <motion.span whileTap={{scale: 0.98}} className={`${taskRepeatOption === 'none' ? 'group-hover:text-light-text dark:group-hover:text-dark-text' : 'group-hover:text-light-text dark:group-hover:text-dark-text'}`}>
                                        {getRepeatDisplayText(taskRepeatOption, taskRruleOptions)}
                                      </motion.span>
                                    </div>
                                    </PopoverTrigger>
                                    </div>
                                  </div>
                                  <PopoverContent 
                                    className="w-[250px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 
                                      scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
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
                                            className={`px-2 py-2 text-xs flex items-center flex-row font-medium rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${taskRepeatOption === option.id ? 'font-semibold' : ''}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (option.id === 'custom') {
                                                setIsRecurrenceModalOpen(true); // Open modal
                                                setIsTaskRepeatDropdownOpen(false); // Close popover
                                              } else {
                                                console.log('🚀 [CHRONO-DEBUG] Task repeat option selected:', {
                                                  selectedOption: option.id,
                                                  previousOption: taskRepeatOption,
                                                  editingTaskId,
                                                  isAddingTask
                                                });
                                                
                                                setTaskRepeatOption(option.id);
                                                setTaskRruleOptions(null); // Clear custom rule if selecting preset
                                                // Generate seriesId when switching from 'none' to any repeat pattern
                                                if (taskRepeatOption === 'none' && option.id !== 'none') {
                                                  const newSeriesId = `series_${Date.now().toString()}`;
                                                  setTaskRepeatSeriesId(newSeriesId);
                                                  console.log('🚀 [CHRONO-DEBUG] Generated seriesId for repeat option:', newSeriesId);
                                                } else if (option.id === 'none') {
                                                  setTaskRepeatSeriesId(null);
                                                  console.log('🚀 [CHRONO-DEBUG] Cleared seriesId for none option');
                                                }
                                                setIsTaskRepeatDropdownOpen(false);
                                              }
                                            }}
                                            role="option"
                                            aria-selected={taskRepeatOption === option.id}
                                          >
                                            <div className="flex w-full justify-between items-center">
                                              <span className={`text-xs text-dark-text/50 dark:text-dark-text/50 ${taskRepeatOption === option.id ? 'font-semibold !text-dark-text dark:!text-dark-text' : ''}`}>{option.label}</span>
                                              <div className="flex items-center gap-2">
                                                {sublabel && (
                                                  <span className="text-xs text-dark-text/30 font-medium dark:text-dark-text/30">{sublabel}</span>
                                                )}
                                                {taskRepeatOption === option.id && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                                              </div>
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
                      </div>
                    
                  </div>
                </motion.div>
              )}

                {activeContentKey === 'event' && (
                  <motion.div
                  key="commandBar-adding-event"
                  variants={contentVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  custom={{
                    direction: getDirection('event', previousContentKeyRef.current),
                    isInitial: previousContentKeyRef.current === null,
                    isCollapsing: false
                  }}
                  onAnimationStart={() => {
                    animationInProgressRef.current = true;
                  }}
                  onAnimationComplete={() => {
                    animationInProgressRef.current = false;
                  }}
                  transition={{
                    type: "spring",
                    bounce: 0,
                    duration: 0.5
                  }}
                  className="flex flex-col gap-4 min-w-[450px]"
                  style={{
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <div className="flex flex-col -mx-4">
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
                        <PopoverContent className="w-auto rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border p-3">
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
                          autoFocus={isAddingEvent}
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
                      <div className={`flex items-top gap-2 px-4 py-4 ${(eventState.isMultiDay || eventState.isAllDay) ? 'opacity-50' : ''}`}>
                        <div className="flex flex-col gap-2">
                      <span className="text-[11px] text-light-text/50 dark:text-dark-text/50">Time</span>

                            <div className="flex items-start gap-2">
                              
                          <Clock className={`w-4 h-4 ${(eventState.isMultiDay || eventState.isAllDay) ? 'text-light-text/30 dark:text-dark-text/30' : 'text-light-text/50 dark:text-dark-text/50'}`} />

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 h-[16px]">
                            {/* Start Time Popover Input */}
                            <Popover open={!(eventState.isMultiDay || eventState.isAllDay) && isStartTimePickerOpen} onOpenChange={(eventState.isMultiDay || eventState.isAllDay) ? () => {} : setIsStartTimePickerOpen}>
                              <PopoverTrigger asChild>
                                <motion.input
                                  whileTap={{scale: 0.98}}
                                  type="text"
                                  placeholder="Start"
                                  value={startTimeSearch || format(parse(eventState.startTime, 'HH:mm', new Date()), 'h:mm a')}
                                  disabled={eventState.isMultiDay || eventState.isAllDay}
                                  onFocus={(e) => {
                                    if (!(eventState.isMultiDay || eventState.isAllDay)) {
                                      setTimeout(() => e.target.select(), 0);
                                      setStartTimeSearch(''); // Clear search on focus to show all
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (!(eventState.isMultiDay || eventState.isAllDay)) {
                                      const inputText = e.target.value;
                                      setStartTimeSearch(inputText); // Update search term for filtering
                                      const parsedTime = parseTimeString(inputText);
                                      if (parsedTime) {
                                        // Only update if valid parse - popover selection handles other cases
                                        handleEventChange('startTime', parsedTime);
                                      } 
                                    }
                                  }}
                                  className={`text-sm bg-transparent border-none w-[64px] p-0 focus:ring-0 focus:outline-none inline-block shrink-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden ${
                                    (eventState.isMultiDay || eventState.isAllDay) 
                                      ? 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed' 
                                      : 'text-light-text dark:text-dark-text cursor-pointer'
                                  }`}
                                />
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-[160px] max-h-[200px] overflow-auto p-1 bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 
                                  scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
                                align="start"
                                side="top"
                                onOpenAutoFocus={(e) => e.preventDefault()} // Prevent auto-focus stealing
                              >
                                <div role="listbox" className="flex flex-col">
                                  {filteredStartTimeOptions.map((option) => {
                                    const isSelected = eventState.startTime === option.value;
                                    return (
                                      <button
                                        key={`start-${option.value}`}
                                        ref={isSelected ? (el) => {
                                          if (el && isStartTimePickerOpen) {
                                            setTimeout(() => {
                                              el.scrollIntoView({ behavior: 'instant', block: 'center' });
                                            }, 0);
                                          }
                                        } : null}
                                        type="button"
                                        className={`flex items-center justify-between px-2 py-1.5 text-xs font-medium rounded-[5px] cursor-pointer hover:bg-white/15 dark:hover:bg-white/5 ${isSelected ? 'font-semibold text-dark-text dark:text-dark-text' : 'text-dark-text/50 dark:text-dark-text/50'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventChange('startTime', option.value);
                                          setIsStartTimePickerOpen(false);
                                          setStartTimeSearch(''); // Reset search
                                        }}
                                        role="option"
                                        aria-selected={isSelected}
                                      >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>

                            <span className={`${(eventState.isMultiDay || eventState.isAllDay) ? 'text-light-text/30 dark:text-dark-text/30' : 'text-light-text/50 dark:text-dark-text/50'}`}>→</span>

                            {/* End Time Popover Input */}
                            <Popover open={!(eventState.isMultiDay || eventState.isAllDay) && isEndTimePickerOpen} onOpenChange={(eventState.isMultiDay || eventState.isAllDay) ? () => {} : setIsEndTimePickerOpen}>
                              <PopoverTrigger asChild>
                                 <motion.input
                                  whileTap={{scale: 0.98}}
                                  type="text"
                                  placeholder="End"
                                  value={endTimeSearch || format(parse(eventState.endTime, 'HH:mm', new Date()), 'h:mm a')}
                                  disabled={eventState.isMultiDay || eventState.isAllDay}
                                  onFocus={(e) => {
                                    if (!(eventState.isMultiDay || eventState.isAllDay)) {
                                      setTimeout(() => e.target.select(), 0);
                                      setEndTimeSearch(''); // Clear search on focus
                                    }
                                  }}
                                  onChange={(e) => {
                                    if (!(eventState.isMultiDay || eventState.isAllDay)) {
                                      const inputText = e.target.value;
                                      setEndTimeSearch(inputText);
                                      const parsedTime = parseTimeString(inputText);
                                       if (parsedTime) {
                                          // Only update if valid parse
                                         handleEventChange('endTime', ensureMinimumGap(eventState.startTime, parsedTime));
                                       }
                                    }
                                  }}
                                  className={`text-sm bg-transparent border-none w-[64px] p-0 focus:ring-0 focus:outline-none inline-block shrink-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden ${
                                    (eventState.isMultiDay || eventState.isAllDay) 
                                      ? 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed' 
                                      : 'text-light-text dark:text-dark-text cursor-pointer'
                                  }`}
                                />
                              </PopoverTrigger>
                              <PopoverContent 
                                className="w-[160px] max-h-[200px] overflow-y-auto p-1 bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 
                                  scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
                                align="start"
                                side="top"
                                onOpenAutoFocus={(e) => e.preventDefault()} // Prevent auto-focus stealing
                              >
                                <div role="listbox" className="flex flex-col">
                                  {filteredEndTimeOptions.map((option) => {
                                    // Calculate duration
                                    const [startH, startM] = eventState.startTime.split(':').map(Number);
                                    const [endH, endM] = option.value.split(':').map(Number);
                                    const startTotalMinutes = startH * 60 + startM;
                                    const endTotalMinutes = endH * 60 + endM;
                                    const diffMinutes = endTotalMinutes - startTotalMinutes;
                                    
                                    let durationStr = '';
                                    if (diffMinutes >= 0) { // Ensure non-negative duration
                                      if (diffMinutes >= 60) {
                                        const hours = Math.floor(diffMinutes / 60);
                                        const minutes = diffMinutes % 60;
                                        durationStr = `${hours}h`;
                                        if (minutes > 0) {
                                          durationStr += ` ${minutes}m`;
                                        }
                                      } else {
                                        durationStr = `${diffMinutes}m`;
                                      }
                                    }

                                    const isSelected = eventState.endTime === option.value;
                                    return (
                                      <button
                                        key={`end-${option.value}`}
                                        ref={isSelected ? (el) => {
                                           if (el && isEndTimePickerOpen) {
                                             setTimeout(() => {
                                               el.scrollIntoView({ behavior: 'instant', block: 'center' });
                                             }, 0);
                                           }
                                         } : null}
                                        type="button"
                                        className={`flex justify-between items-center text-left px-2 py-1.5 text-xs font-medium rounded-[5px] cursor-pointer hover:bg-white/15 dark:hover:bg-white/5 ${isSelected ? 'bg-white/15 dark:bg-white/10 font-semibold text-dark-text dark:text-dark-text ' : 'text-dark-text/50 dark:text-dark-text/50'}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEventChange('endTime', ensureMinimumGap(eventState.startTime, option.value));
                                          setIsEndTimePickerOpen(false);
                                          setEndTimeSearch(''); // Reset search
                                        }}
                                        role="option"
                                        aria-selected={isSelected}
                                      >
                                        <span>{option.label}</span>
                                        <div className="flex items-center gap-2">
                                          {durationStr && (
                                            <span className="text-xs text-dark-text/30 dark:text-dark-text/40">
                                              ({durationStr})
                                            </span>
                                          )}
                                          {isSelected && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="flex items-center gap-2 mt-1"> { /* Add margin-top */}
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

                        </div>

                      </div>

                      {/* Date Section */}
                      <div className="flex items-top gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                        <div className="flex flex-col gap-2">
                        <span className="text-[11px] text-light-text/50 dark:text-dark-text/50">Date</span>
                        <div className="flex flex-row gap-2">
                          <div className="w-4 h-4">      
                          <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                          </div>  

                        <div className="flex flex-col gap-1 w-full">
                          {/* Date inputs row */}
                          <div className="flex items-center h-[16px] gap-2 w-fit"> {/* <-- Add w-fit */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <motion.span
                                  whileTap={{scale: 0.98}}
                                  className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 cursor-pointer focus:ring-0 focus:outline-none whitespace-nowrap"
                                >
                                  {format(parse(eventState.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                                </motion.span>
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
                                    <motion.span
                                      whileTap={{scale: 0.98}}
                                      className="text-sm text-light-text dark:text-dark-text bg-transparent border-none p-0 cursor-pointer focus:ring-0 focus:outline-none whitespace-nowrap"
                                    >
                                      {format(parse(eventState.endDate || eventState.date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}
                                    </motion.span>
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
                          <div className="flex items-center h-[24px] gap-1">
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
                                  handleEventChange('isMultiDay', e.target.checked);
                                }}
                              />
                              <div className="w-7 h-4 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:shadow-sm after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500"></div>
                            </label>
                            <span className="text-xs text-light-text/50 dark:text-dark-text/50">Multi-day</span>
                          </div>
                        </div>
                        </div>
                        </div>
                      </div>
                      {/* Repeat Section */}
                      <div className="flex items-top group gap-2 px-4 py-4 border-t border-light-border dark:border-dark-border">
                        <div className="flex flex-col gap-2">
                          <span className="text-[11px] text-light-text/50 dark:text-dark-text/50">Repeat</span>
                          
                        <div className="flex flex-row w-auto gap-2 hover:text-light-text dark:hover:text-dark-text">

                          <Repeat className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />


                        <div className="flex flex-col gap-1">
                          <Popover open={isRepeatDropdownOpen} onOpenChange={setIsRepeatDropdownOpen}>
                            <PopoverTrigger className="flex items-center gap-2 cursor-pointer rounded-md focus:outline-none" ref={repeatDropdownRef}>
                              <motion.span whileTap={{scale: 0.98}} className={`text-sm/[16px] font-medium ${eventState.repeat === 'none' ? 'group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50' : 'text-light-text dark:text-dark-text'}`}>
                                {getRepeatDisplayText(eventState.repeat, eventState.rruleOptions)}
                              </motion.span>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-[250px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 
                                scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
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
                                      className={`px-2 py-2 text-xs flex items-center flex-row font-medium rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${eventState.repeat === option.id ? 'font-semibold' : ''}`}
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
                                        <div className="flex items-center gap-2">
                                          {sublabel && (
                                            <span className="text-xs text-dark-text/30 font-medium dark:text-dark-text/30">{sublabel}</span>
                                          )}
                                          {eventState.repeat === option.id && (
                                            <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />
                                          )}
                                        </div>
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
                      </div>
                    </div>

                    

                    

                  </div>
                </motion.div>
              )}

                {activeContentKey === 'go-to-date' && (
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
                          <div className="flex items-center gap-2 px-4 py-4 border-b border-light-border dark:border-dark-border">
                            <div 
                              className="cursor-pointer flex items-center mr-2"
                              onClick={() => {
                                // Reset state immediately - let Framer Motion handle the animation timing
                                setIsGoToDateMode(false);
                                setQuery('');
                                setSuggestions([]);
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
            </motion.div>
          </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Form buttons section with tabs - positioned absolutely to be completely static */}
      {(activeContentKey === 'task' || activeContentKey === 'event') && (
        <motion.div 
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 pb-4"
          style={{height: '68px'}}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.15 }}
        >
          {/* Tab selector on the left */}
          <TabSelector 
            activeTab={activeTab} 
            onTabChange={(tab) => {
              if (tab === 'task') {
                setIsAddingTask(true);
                setIsAddingEvent(false);
              } else {
                setIsAddingEvent(true);
                setIsAddingTask(false);
              }
            }} 
          />
          
          {/* Buttons on the right */}
          <motion.div 
            className="flex items-center gap-2"
            layout
            style={{ transformOrigin: "right center" }}
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 30,
              duration: 0.2
            }}
          >
          <button
            onClick={originalEventState?.isDraft ? handleDiscardDraft : handleClose}
            className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
          >
            <span className="flex items-center pl-1 pr-3">Discard</span>
            <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
              <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
            </div>
          </button>
          
          {activeContentKey === 'task' && (
            <motion.button
              layoutId="save-button"
              onClick={handleSaveTask}
              disabled={!taskTitle.trim()}
              className={`px-2 w-[120px] justify-center py-2 text-xs flex items-center flex-row font-semibold rounded-[5px] ${taskTitle.trim() 
                ? 'bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] text-dark-text dark:text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)] shadow-sm' 
                : 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
              style={{ minWidth: '100px', transformOrigin: 'right center' }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  duration: 0.2
                }
              }}
            >
              <span className="text-xs pl-1 pr-3" style={{ minWidth: '60px', display: 'inline-block' }}>
                {editingTaskId ? 'Edit task' : 'Add task'}
              </span>
              <div className={`flex items-center px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 p-1 rounded-[5px] ${taskTitle.trim() ? 'text-dark-text dark:text-dark-text bg-white/10' : 'bg-black/5 text-light-text/30 dark:text-dark-text/30 bg-black/5'}`}>
                <Return className="w-3 h-3" />
              </div>
            </motion.button>
          )}
          
          {activeContentKey === 'event' && (
            <motion.button
              layoutId="save-button"
              onClick={handleSaveChanges}
              disabled={!eventState.title.trim() || (!hasChanges && !originalEventState?.isDraft)}
              className={`w-[120px] flex items-center justify-center flex-row py-2 text-xs font-semibold rounded-[5px] ${eventState.title.trim() && (hasChanges || originalEventState?.isDraft)
                ? 'bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] text-dark-text dark:text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)] shadow-sm' 
                : 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'}`}
              style={{ minWidth: '100px', transformOrigin: 'right center' }}
              transition={{
                layout: {
                  type: "spring",
                  stiffness: 500,
                  damping: 30,
                  duration: 0.2
                }
              }}
            >
              <span className="text-xs pl-1 pr-3" style={{ minWidth: '65px', display: 'inline-block' }}>
                {originalEventState?.id && !originalEventState?.isDraft ? 'Edit event' : 'Add event'}
              </span>
              <div className={`flex items-center px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 p-1 rounded-[5px] ${eventState.title.trim() && (hasChanges || originalEventState?.isDraft) ? 'text-dark-text dark:text-dark-text bg-white/10' : 'bg-black/5 text-light-text/30 dark:text-dark-text/30 bg-black/5'}`}>
                <Return className="w-3 h-3" />
              </div>
            </motion.button>
          )}
          </motion.div>
        </motion.div>
      )}

    {/* Recurrence Modal */}
    <RecurrenceModal
      isOpen={isRecurrenceModalOpen}
      onOpenChange={setIsRecurrenceModalOpen}
      initialValue={isAddingEvent ? eventState.rruleOptions : taskRruleOptions}
      onSave={handleSaveRecurrenceRule}
      startDate={isAddingEvent ? createLocalDateTime(eventState.date, eventState.startTime) : scheduledDate || new Date()}
    />

    {/* RepeatTaskEditModal for Multi-select */}
    {isRepeatTaskEditModalOpen && currentRecurringTask && (
      <RepeatTaskEditModal
        isOpen={isRepeatTaskEditModalOpen}
        onClose={() => {
          setIsRepeatTaskEditModalOpen(false);
          setCurrentRecurringTask(null);
          setRecurringTasksInSelection([]);
          setCurrentRecurringTaskIndex(0);
          setRecurringTaskScopes(new Map());
        }}
        task={currentRecurringTask}
        onSave={(scope) => {
          handleRecurringTaskScopeSelection(scope);
        }}
        mode="schedule"
        title={`Schedule ${currentRecurringTask.title}`}
        description={`Choose how to apply the new schedule to this recurring task (${currentRecurringTaskIndex + 1} of ${recurringTasksInSelection.length})`}
      />
    )}
  </div>
);

}; 

// Use memo to prevent unnecessary re-renders of the entire component
export default memo(forwardRef(CommandBar));