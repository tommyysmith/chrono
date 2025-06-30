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
  const hasAnyTags = taskIsRecurring || 
                     task.scheduledDate || 
                     task.tag || 
                     (task.priority && task.priority !== 'None');

  return (
    <div className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[11px] p-2 shadow-lg max-w-[240px] pointer-events-none">
      <div className="flex items-start gap-2">
        {/* Checkbox placeholder */}
        <div className="w-4 h-4 mt-0.5 rounded border border-light-border dark:border-dark-border bg-light-bg-light dark:bg-dark-bg-light"></div>
        
        <div className="flex flex-col flex-grow gap-1 min-w-0">
          <span className="text-sm font-medium text-light-text dark:text-dark-text break-words">
            {task.title}
          </span>
          
          {hasAnyTags && (
            <div className="flex items-center flex-wrap gap-1">
              {task.scheduledDate && (
                <div className="inline-flex items-center px-1 h-[16px] text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-primary">
                  <Calendar className="h-2.5 w-2.5" />
                  <span className="px-0.5">
                    {(() => {
                      const scheduledDate = new Date(task.scheduledDate);
                      const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
                      
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
                  className="inline-flex items-center px-1 h-[16px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px]"
                  style={{ color: task.tag.color }}
                >
                  <Tag className="h-2.5 w-2.5" style={{ color: task.tag.color }} />
                  <span className="px-0.5">{task.tag.label}</span>
                </div>
              )}
              
              {taskIsRecurring && (
                <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500">
                  <Repeat className="h-2.5 w-2.5" />
                </div>
              )}
              
              {task.priority && task.priority !== 'None' && (() => {
                const IconComponent = getPriorityIcon(task.priority);
                const priorityColor = getPriorityColor(task.priority);
                return (
                  <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light">
                    <IconComponent className="h-2.5 w-2.5" style={{ color: priorityColor }} />
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
      
      {/* Drag hint */}
      <div className="mt-2 text-xs text-light-text/50 dark:text-dark-text/50 text-center">
        Drag to calendar to create time block
      </div>
    </div>
  );
};

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit, onClick, hideScheduledDate, hideTag, isRecurring, checked, isSelected = false, onSelect }) {
  // If isRecurring is not explicitly passed, check the task properties
  const taskIsRecurring = isRecurring !== undefined ? isRecurring : (task.repeat && task.repeat !== 'none');
  const [isHovering, setIsHovering] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

  const [isMultiSelected, setIsMultiSelected] = useState(false);

  // Sync internal multi-select state with external selection state
  useEffect(() => {
    setIsMultiSelected(isSelected || false);
  }, [isSelected]);

  const handleClick = (e) => {
    // Don't trigger selection when clicking checkbox
    if (e.target.closest('.checkbox')) {
      return;
    }

    // Handle selection if onSelect is provided and Shift key is held
    if (onSelect && e.shiftKey) {
      // Defer the selection call to avoid setState during render
      setTimeout(() => {
        // Toggle selection: if already selected, deselect it
        onSelect(task.id, e, isSelected);
        // Update local state to reflect the new selection state
        setIsMultiSelected(!isSelected);
      }, 0);
      // Don't call onClick when using multi-select to avoid conflicting selection states
      return;
    }

    // Clear multi-select state when clicking without shift
    setIsMultiSelected(false);
    onClick?.(e);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setIsPopoverOpen(true);
  };

  const handleEdit = () => {
    onDoubleClickEdit(task);
    setIsPopoverOpen(false);
  };

  const handleDelete = () => {
    onDelete(task.id);
    setIsPopoverOpen(false);
  };

  // Create separate refs to combine functionality
  const combinedRef = useCallback((node) => {
    taskItemRef.current = node;
    setNodeRef(node);
  }, [setNodeRef]);

  // Determine if the item should be top-aligned
  // Check for any tags: recurring, scheduled date, tag, or priority
  const hasAnyTags = taskIsRecurring || 
                     (!hideScheduledDate && task.scheduledDate) || 
                     (!hideTag && task.tag) || 
                     (task.priority && task.priority !== 'None');
  
  const shouldAlignTop = isMultiLine || hasAnyTags;
  const alignmentClass = shouldAlignTop ? 'items-start' : 'items-center';

  return (
    <div className="relative" style={dragStyle}>
      {/* Animated Background */}
      <motion.div
        className={`absolute inset-0 rounded-[11px] ${
          isMultiSelected 
            ? 'bg-light-bg-lighter dark:bg-dark-bg-lighter opacity-100' 
            : 'bg-light-bg-lighter dark:bg-dark-bg-lighter'
        }`}
        animate={isMultiSelected ? { opacity: 1, x: 0, y: 0, scale: 1 } : getBackgroundAnimation()}
      />
      
      <div 
        ref={combinedRef}
        data-task-item
        className={`select-none min-h-[40px] cursor-pointer flex ${alignmentClass} gap-2 p-2 rounded-[11px] relative overflow-hidden hover:bg-transparent ${
          isDragging ? 'cursor-grabbing' : task.completed ? 'cursor-default' : 'cursor-grab'
        }`}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        onDoubleClick={() => onDoubleClickEdit(task)}
        onMouseEnter={(e) => {
          setIsHovering(true);
          handleDirectionalMouseEnter(e);
        }}
        onMouseLeave={(e) => {
          setIsHovering(false);
          setIsPopoverOpen(false);
          handleDirectionalMouseLeave(e);
        }}
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
      <div className="flex flex-col justify-center flex-grow gap-1 min-w-0">
        <span 
          ref={textSpanRef}
          className={`text-sm ${hasAnyTags ? 'mt-0 leading-4' : 'mt-[2px]'} ${task.completed ? 'line-through opacity-50' : ''} break-words`}
        >
          {task.title}
        </span>
        <div className="flex items-center flex-wrap flex-row gap-1">
        {/* Always show scheduled date if available, regardless of tags */}
        {!hideScheduledDate && task.scheduledDate && (
          <div className="inline-flex self-start mt-1 items-center px-1 h-[20px] text-[11px] rounded-[5px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-primary">
            <Calendar className="h-3 w-3" />
            <span className="px-1">
            {(() => {
              const scheduledDate = new Date(task.scheduledDate);
              const hasSpecificTime = task.duration || (scheduledDate.getHours() !== 0 || scheduledDate.getMinutes() !== 0);
              
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
      </div>

      {/* More icon shown on hover - but hidden during drag */}
      <AnimatePresence mode="wait">
        {isHovering && !isDragging && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.05, ease: "easeOut" }}
                className={`flex items-center justify-center group absolute ${hasAnyTags ? 'top-2' : 'top-1/2 -translate-y-1/2'} right-2 h-[20px] w-[20px] rounded-[5px] hover:backdrop-blur-lg hover:bg-white dark:hover:bg-dark-bg hover:outline hover:outline-1 hover:outline-light-border hover-outline-offset-0 dark:hover:outline-dark-border focus:outline-none focus-visible:outline-none`}
              >
                <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text" />
              </motion.button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1 min-w-[120px] bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border focus:outline-none focus-visible:outline-none">
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleEdit}
                  className="w-full px-2 py-1 text-xs text-dark-text dark:text-dark-text rounded-[5px] flex items-center gap-2 hover:bg-white/15 dark:hover:bg-white/5 focus:outline-none focus-visible:outline-none"
                >
                  <Pencil className="w-3 h-3 text-dark-text dark:text-dark-text" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white text-[#EC0F0F] focus:outline-none focus-visible:outline-none"
                >
                  <Trash className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </AnimatePresence>


      </div>
    </div>
  );
}
