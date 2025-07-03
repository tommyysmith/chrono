'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, CalendarClock } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import Checkbox from './Checkbox';
import { format } from 'date-fns';
import { Calendar } from '../assets/icons/Calendar';
import { Trash } from '../assets/icons/Trash';
import { Tag } from '../assets/icons/Tag';
import { More } from '../assets/icons/More';
import { Repeat } from '../assets/icons/Repeat';
import { None } from '../assets/icons/None';
import { Low } from '../assets/icons/Low';
import { Medium } from '../assets/icons/Medium';
import { High } from '../assets/icons/High';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { RRule, Weekday } from 'rrule'; // ✅ Fix: Move RRule import to top level
import EnhancedTaskContextMenu from './EnhancedTaskContextMenu';


// Helper function to get the appropriate priority icon
const getPriorityIcon = (priority) => {
  switch (priority) {
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

// Helper function to get default event color
const getDefaultEventColor = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('defaultEventColor') || '#F59E0B';
  }
  return '#F59E0B';
};

// Helper function to get priority color
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'High':
      return '#EF4444';
    case 'Medium':
      return getDefaultEventColor();
    case 'Low':
      return '#10B981';
    case 'None':
    default:
      return '#6B7280';
  }
};

// TaskDragPreview component for DragOverlay
export const TaskDragPreview = ({ task }) => {
  if (!task) return null;

  const taskIsRecurring = task.repeat && task.repeat !== 'none';
  
  // Calculate if this is a 15-minute task
  const is15MinTask = (task.duration === 15) || 
    (task.start && task.end && (new Date(task.end).getTime() - new Date(task.start).getTime()) === 15 * 60 * 1000);
  
  const hasAnyTags = taskIsRecurring || 
                     task.scheduledDate || 
                     task.tag || 
                     (task.priority && task.priority !== 'None');

  return (
    <div className={`bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[11px] ${is15MinTask ? 'p-1' : 'p-2'} shadow-lg max-w-[240px] pointer-events-none opacity-100`}>
      <div className="flex items-start gap-2">
        {/* Checkbox placeholder */}
        <div className="w-4 h-4 mt-0.5 rounded border border-light-border dark:border-dark-border bg-light-bg-light dark:bg-dark-bg-light opacity-100"></div>
        
        <div className={`flex flex-col ${is15MinTask ? 'justify-center items-center' : ''} flex-grow gap-1 min-w-0`}>
          <div className={`text-sm font-medium text-light-text dark:text-dark-text break-words ${is15MinTask ? 'flex items-center gap-1' : ''} opacity-100`}>
            <span>{task.title}</span>
            {is15MinTask && task.scheduledDate && (() => {
              const scheduledDate = new Date(task.scheduledDate);
              const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
              
              if (hasSpecificTime) {
                return (
                  <span className="text-light-text/30 dark:text-dark-text/30 opacity-100">
                    {format(scheduledDate, 'h:mm a')}
                  </span>
                );
              }
              return null;
            })()}
          </div>
          
          {hasAnyTags && !is15MinTask && (
            <div className="flex items-center flex-wrap gap-1 opacity-100">
              {task.scheduledDate && (
                <div className="inline-flex items-center px-1 h-[16px] text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-primary opacity-100">
                  <Calendar className="h-2.5 w-2.5 opacity-100" />
                  <span className="px-0.5 opacity-100">
                    {(() => {
                      const scheduledDate = new Date(task.scheduledDate);
                      const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
                      
                      // For 15-minute tasks, only show date (since time is shown inline with title)
                      if (is15MinTask && hasSpecificTime) {
                        return format(scheduledDate, 'd MMM');
                      }
                      
                      if (hasSpecificTime) {
                        // Show time for drag preview (more concise)
                        return format(scheduledDate, 'h:mm a');
                      } else {
                        // Show date for tasks without specific time
                        return format(scheduledDate, 'd MMM');
                      }
                    })()}
                  </span>
                </div>
              )}
              
              {task.tag && (
                <div 
                  className="inline-flex items-center px-1 h-[16px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] opacity-100"
                  style={{ color: task.tag.color }}
                >
                  <Tag className="h-2.5 w-2.5 opacity-100" style={{ color: task.tag.color }} />
                  <span className="px-0.5 opacity-100">{task.tag.label}</span>
                </div>
              )}
              
              {taskIsRecurring && (
                <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500 opacity-100">
                  <Repeat className="h-2.5 w-2.5 opacity-100" />
                </div>
              )}
              
              {task.priority && task.priority !== 'None' && (() => {
                const IconComponent = getPriorityIcon(task.priority);
                const priorityColor = getPriorityColor(task.priority);
                return (
                  <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light opacity-100">
                    <IconComponent className="h-2.5 w-2.5 opacity-100" style={{ color: priorityColor }} />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      
      {/* Drag hint */}
      <div className="mt-2 text-xs text-light-text/50 dark:text-dark-text/50 text-center opacity-100">
        Drag to calendar to create time block
      </div>
    </div>
  );
};

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit, onClick, hideScheduledDate, hideTag, isRecurring, checked, isSelected = false, onSelect, onUpdateTask }) {
  // If isRecurring is not explicitly passed, check the task properties
  const taskIsRecurring = isRecurring !== undefined ? isRecurring : (task.repeat && task.repeat !== 'none');
  const [isHovering, setIsHovering] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  // Draggable setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task: task
    },
    disabled: task.completed || isSelected, // Disable drag for completed tasks or when selected
  });

  // Keep original task in place during drag (no transform applied)
  const dragStyle = undefined;

  // Directional hover effect state
  const [backgroundState, setBackgroundState] = useState("hidden");
  const [entryDirection, setEntryDirection] = useState({ x: 0, y: 0 });
  const [leaveDirection, setLeaveDirection] = useState({ x: 0, y: 0 });

  const taskItemRef = useRef(null);

  const [isMultiLine, setIsMultiLine] = useState(false);
  const textSpanRef = useRef(null);

  // Enhanced context menu handlers
  const handleMarkAsDone = useCallback((task) => {
    onComplete(task.id);
  }, [onComplete]);

  const handlePriorityChange = useCallback((task, priority) => {
    if (onUpdateTask) {
      const updatedTask = {
        ...task,
        priority: priority,
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      onUpdateTask(updatedTask);
    }
    setIsContextMenuOpen(false);
  }, [onUpdateTask]);

  const handleTagChange = useCallback((task, tag) => {
    if (onUpdateTask) {
      const updatedTask = {
        ...task,
        tag: tag, // Store the full tag object, not just the ID
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      onUpdateTask(updatedTask);
    }
    setIsContextMenuOpen(false);
  }, [onUpdateTask]);

  const handleScheduleChange = useCallback((task, dateOrOption) => {
    if (onUpdateTask) {
      let scheduledDate = null;
      
      if (dateOrOption === 'custom') {
        // For now, just open the edit dialog - could enhance with date picker later
        onDoubleClickEdit(task);
        setIsContextMenuOpen(false);
        return;
      } else if (dateOrOption instanceof Date) {
        // Set the time to 9 AM by default
        const date = new Date(dateOrOption);
        date.setHours(9, 0, 0, 0);
        scheduledDate = date.toISOString();
      }
      
      const updatedTask = {
        ...task,
        scheduledDate: scheduledDate,
        addToCalendar: true,
        updatedAt: new Date().toISOString()
      };
      
      // For recurring task instances, flag for single instance update
      if (task.isRepeat === true && task.seriesId) {
        updatedTask._editScope = 'single';
      }
      
      onUpdateTask(updatedTask);
    }
    setIsContextMenuOpen(false);
  }, [onUpdateTask, onDoubleClickEdit]);

  const handleRemoveFromCalendar = useCallback((task) => {
    if (onUpdateTask) {
      const updatedTask = {
        ...task,
        addToCalendar: false,
        scheduledDate: null,
        duration: null,
        updatedAt: new Date().toISOString()
      };
      
      onUpdateTask(updatedTask);
    }
    setIsContextMenuOpen(false);
  }, [onUpdateTask]);

  const handleEdit = useCallback((task) => {
    onDoubleClickEdit(task);
    setIsContextMenuOpen(false);
  }, [onDoubleClickEdit]);

  const handleDelete = useCallback((task) => {
    onDelete(task.id);
    setIsContextMenuOpen(false);
  }, [onDelete]);

  // Create separate refs to combine functionality
  const combinedRef = useCallback((node) => {
    taskItemRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  // Directional hover effect functions
  const calculateDirection = useCallback((e) => {
    if (!taskItemRef.current) return { x: 0, y: 0 };
    
    const rect = taskItemRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;
    
    // Reduce travel distance by applying a multiplier (0.3 = 30% of original distance)
    const distanceMultiplier = 0.3;
    
    return { 
      x: offsetX * distanceMultiplier, 
      y: offsetY * distanceMultiplier 
    };
  }, []);

  const handleDirectionalMouseEnter = useCallback((e) => {
    // Don't show hover effects when dragging
    if (isDragging) return;
    // Simplified hover animation for Safari compatibility
    setBackgroundState("centered");
  }, [isDragging]);
  
  const handleDirectionalMouseLeave = useCallback((e) => {
    // Simplified leave animation for Safari compatibility
    setBackgroundState("hidden");
  }, []);

  const getBackgroundAnimation = () => {
    switch (backgroundState) {
      case "hidden":
        return {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.05, ease: "easeOut" }
        };
      case "entering":
        return {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.05, ease: "easeOut" }
        };
      case "centered":
        return {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.05, ease: "easeOut" }
        };
      case "leaving":
        return {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.05, ease: "easeOut" }
        };
      default:
        return {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.05, ease: "easeOut" }
        };
    }
  };

  useEffect(() => {
    if (textSpanRef.current) {
      const span = textSpanRef.current;
      const computedStyle = window.getComputedStyle(span);
      const lineHeightStyle = computedStyle.lineHeight;
      const fontSizeStyle = computedStyle.fontSize; // Needed for 'normal' line-height calculation
      let lineHeightPx;

      if (lineHeightStyle === 'normal') {
        const fontSizePx = parseFloat(fontSizeStyle);
        // A common approximation for 'normal' line height is 1.2 * font-size.
        // Provide a sensible fallback (e.g., 16px * 1.2) if font size cannot be parsed.
        lineHeightPx = !isNaN(fontSizePx) ? fontSizePx * 1.2 : 16 * 1.2;
      } else {
        lineHeightPx = parseFloat(lineHeightStyle);
      }

      if (!isNaN(lineHeightPx) && lineHeightPx > 0) {
        // Check if scrollHeight (total height of content) is greater than one line height.
        // Adding a small buffer (e.g., 1px) can help with sub-pixel rendering inconsistencies.
        setIsMultiLine(span.scrollHeight > lineHeightPx + 1);
      }
    }
  }, [task.title, task.completed, task.id]); // Dependencies: re-calculate if text, completion, or task itself changes.

  const [isShiftSelecting, setIsShiftSelecting] = useState(false);

  // Reset shift selecting state when parent deselects the item
  useEffect(() => {
    if (!isSelected) {
      setIsShiftSelecting(false);
    }
  }, [isSelected]);

  const handleClick = (e) => {
    // Don't trigger selection when clicking checkbox
    if (e.target.closest('.checkbox')) {
      return;
    }

    // Handle selection if onSelect is provided and Shift key is held
    if (onSelect && e.shiftKey) {
      // Enter shift selection mode
      setIsShiftSelecting(true);
      // Call selection handler
      onSelect(task.id, e, isSelected);
      // Don't call onClick when using multi-select to avoid conflicting selection states
      return;
    }

    // Regular click without shift
    onClick?.(e);
  };



  // Determine if the item should be top-aligned
  // Check for any tags: recurring, scheduled date, tag, or priority
  const hasAnyTags = taskIsRecurring || 
                     (!hideScheduledDate && task.scheduledDate) || 
                     (!hideTag && task.tag) || 
                     (task.priority && task.priority !== 'None');
  
  const shouldAlignTop = isMultiLine || hasAnyTags;
  const alignmentClass = shouldAlignTop ? 'items-start' : 'items-center';

  // Calculate if this is a 15-minute task (either from duration or start/end times)
  const is15MinTask = (task.duration === 15) || 
    (task.start && task.end && (new Date(task.end).getTime() - new Date(task.start).getTime()) === 15 * 60 * 1000);

  return (
    <div className="relative" style={dragStyle}>
      {/* Animated Background */}
      <motion.div
        className={`absolute inset-0 rounded-[11px] ${
          isShiftSelecting 
            ? 'bg-light-bg-lighter dark:bg-dark-bg-lighter opacity-100' 
            : 'bg-light-bg-lighter dark:bg-dark-bg-lighter'
        }`}
        animate={isShiftSelecting ? { opacity: 1, x: 0, y: 0, scale: 1 } : getBackgroundAnimation()}
      />
      
              <div 
         ref={combinedRef}
         data-task-item
        className={`select-none min-h-[40px] cursor-pointer flex ${alignmentClass} gap-2 ${is15MinTask ? 'p-1' : 'p-2'} rounded-[11px] relative overflow-hidden hover:bg-transparent focus:outline-none focus-visible:outline-none ${
          isDragging ? 'cursor-grabbing' : task.completed ? 'cursor-default' : 'cursor-grab'
        }`}
        onClick={handleClick}
        onDoubleClick={() => onDoubleClickEdit(task)}
        onMouseEnter={(e) => {
          setIsHovering(true);
          handleDirectionalMouseEnter(e);
        }}
        onMouseLeave={(e) => {
          setIsHovering(false);
          setIsContextMenuOpen(false);
          handleDirectionalMouseLeave(e);
        }}
        tabIndex={-1}
        style={{ outline: 'none' }}
        {...attributes}
        {...(!task.completed && !isSelected ? listeners : {})} // Only apply listeners when draggable
      >
      <div 
        className={`checkbox flex-shrink-0 ${shouldAlignTop ? 'mt-[1px]' : ''}`}
        onMouseEnter={(e) => e.stopPropagation()}
        onMouseLeave={(e) => e.stopPropagation()}
      >
        <Checkbox 
          checked={checked !== undefined ? checked : task.completed}
          onChange={() => onComplete(task.id)}
        />
      </div>
      <div className={`flex flex-col ${is15MinTask ? 'justify-center items-center flex-grow h-full' : 'justify-center flex-grow'} gap-1 min-w-0`}>
        <div className={`text-sm ${hasAnyTags && !is15MinTask ? 'mt-0 leading-4' : is15MinTask ? '' : 'mt-[2px]'} ${task.completed ? 'line-through opacity-50' : ''} break-words ${is15MinTask ? 'flex items-center gap-1' : ''}`}>
          <span ref={textSpanRef}>
            {task.title}
          </span>
          {is15MinTask && task.scheduledDate && (() => {
            const scheduledDate = new Date(task.scheduledDate);
            const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
            
            if (hasSpecificTime) {
              return (
                <span className="text-light-text/30 dark:text-dark-text/30">
                  {format(scheduledDate, 'h:mm a')}
                </span>
              );
            }
            return null;
          })()}
        </div>
        {!is15MinTask && (
        <div className="flex items-center flex-wrap flex-row gap-1">
        {/* Always show scheduled date if available, regardless of tags */}
        {!hideScheduledDate && task.scheduledDate && (
          <div className="inline-flex self-start mt-1 items-center px-1 h-[20px] text-[11px] rounded-[5px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-primary">
            <Calendar className="h-3 w-3" />
            <span className="px-1">
            {(() => {
              const scheduledDate = new Date(task.scheduledDate);
              const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
              
              // For 15-minute tasks, only show date (since time is shown inline with title)
              if (is15MinTask && hasSpecificTime) {
                return format(scheduledDate, 'd MMM');
              }
              
              if (hasSpecificTime) {
                // Show both date and time for tasks scheduled via calendar
                return `${format(scheduledDate, 'd MMM')}, ${format(scheduledDate, 'h:mma')}`;
              } else {
                // Show only date for tasks without specific time
                return format(scheduledDate, 'd MMM');
              }
            })()}
            </span>
          </div>
        )}
        {!hideTag && task.tag && (
          <div 
            key={`tag-${task.tag.id || 'default'}`}
            className="inline-flex self-start mt-1 items-center px-1 h-[20px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-[11px] rounded-[5px]"
            style={{
              color: task.tag.color
            }}
          >
            <Tag className="h-3 w-3"
            style={{ color: task.tag.color }} />
            <span className="px-1">
            {task.tag.label}
            </span>
          </div>
        )}

        {taskIsRecurring && (
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex self-start mt-1 items-center px-1 h-[20px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[5px] bg-white dark:bg-dark-bg-light text-blue-500">
                  <Repeat className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" align="center">
                {(() => {
                  if (task.repeat === 'custom' && task.rruleOptions) {
                    try {
                      // ✅ Fix: Use top-level import instead of dynamic require
                      const options = {...task.rruleOptions};
                      
                      // Ensure dtstart is a proper Date object
                      if (options.dtstart) {
                        if (typeof options.dtstart === 'string') {
                          options.dtstart = new Date(options.dtstart);
                        } else if (!(options.dtstart instanceof Date)) {
                          options.dtstart = new Date(options.dtstart);
                        }
                      }
                      
                      // Convert weekday objects to RRule Weekday instances if needed
                      if (options.byweekday) {
                        options.byweekday = options.byweekday.map(day => {
                          if (day instanceof Weekday) return day;
                          if (typeof day === 'number') return new Weekday(day);
                          if (day.weekday !== undefined) return new Weekday(day.weekday);
                          return RRule[day];
                        });
                      }
                      
                      const rule = new RRule(options);
                      return rule.toText();
                    } catch (e) {
                      console.error('Error parsing rrule options:', e);
                      return 'Custom';
                    }
                  }
                  
                  // Use the same REPEAT_OPTIONS as CommandBar.jsx
                  const repeatOptions = [
                    { id: 'none', label: 'Does not repeat' },
                    { id: 'daily', label: 'Every day' },
                    { id: 'weekday', label: 'Every weekday' },
                    { id: 'weekly', label: 'Every week' },
                    { id: 'biweekly', label: 'Every 2 weeks' },
                    { id: 'monthly', label: 'Every month' },
                    { id: 'monthlyWeekday', label: 'Every month' },
                    { id: 'monthlyLastWeekday', label: 'Every month' },
                    { id: 'yearly', label: 'Every year' },
                    { id: 'custom', label: 'Custom' }
                  ];
                  
                  return repeatOptions.find(option => option.id === task.repeat)?.label || 'Every day';
                })()}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {task.priority && task.priority !== 'None' && (() => {
          const IconComponent = getPriorityIcon(task.priority);
          const priorityColor = getPriorityColor(task.priority);
          return (
            <TooltipProvider delayDuration={500}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex self-start mt-1 items-center px-1 h-[20px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[5px] bg-white dark:bg-dark-bg-light">
                    <IconComponent className="h-3 w-3" style={{ color: priorityColor }} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="center">
                  {task.priority}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })()}

        
        </div>
        )}
      </div>

      {/* Enhanced context menu shown on hover - but hidden during drag */}
      <AnimatePresence mode="wait">
        {isHovering && !isDragging && (
          <EnhancedTaskContextMenu
            isOpen={isContextMenuOpen}
            onOpenChange={setIsContextMenuOpen}
            task={task}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRemoveFromCalendar={handleRemoveFromCalendar}
            onMarkAsDone={handleMarkAsDone}
            onPriorityChange={handlePriorityChange}
            onTagChange={handleTagChange}
            onScheduleChange={handleScheduleChange}
          >
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.05, ease: "easeOut" }}
              className={`flex items-center justify-center group absolute ${(hasAnyTags && !is15MinTask) ? 'top-2' : 'top-1/2 -translate-y-1/2'} right-2 h-[20px] w-[20px] rounded-[5px] hover:backdrop-blur-lg hover:bg-white dark:hover:bg-dark-bg hover:outline hover:outline-1 hover:outline-light-border hover-outline-offset-0 dark:hover:outline-dark-border`}
            >
              <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text" />
            </motion.button>
          </EnhancedTaskContextMenu>
        )}
      </AnimatePresence>


      </div>
    </div>
  );
}
